
  // ── Theme Management ──
  const themeBtn = document.getElementById('themeBtn');
  let isDark = localStorage.getItem('theme') !== 'light';
  
  function applyTheme() {
    if (!isDark) {
      document.documentElement.setAttribute('data-theme', 'light');
      themeBtn.textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeBtn.textContent = '🌙';
    }
  }
  
  function toggleTheme() {
    isDark = !isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyTheme();
    // Update charts text colors based on theme
    Chart.defaults.color = isDark ? '#e8eaf6' : '#0f172a';
    loadDashboard(); // Re-render charts to apply colors immediately
  }
  
  applyTheme();
  Chart.defaults.color = isDark ? '#e8eaf6' : '#0f172a';
  Chart.defaults.font.family = 'Inter';

  // ── Global Variables ──
  const API_BASE = 'http://127.0.0.1:5000/api';
  let currentConversationId = null;
  let chartInstances = {}; let compChartInstances = {};
  let currentSummaryData = null;

  const suggestionsList = [
    "Which topic should I improve?",
    "How was my last exam?",
    "Am I improving?",
    "What is my program?",
    "What courses are assigned to me?",
    "Show my program details",
    "Give me a study plan",
    "Which outcome is weak?",
    "Compare my last two exams",
    "What is my overall percentage?",
    "Which topic is my strongest?"
  ];

  const chat = document.getElementById('chat');
  const input = document.getElementById('msgInput');
  const sendBtn = document.getElementById('sendBtn');

  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

  function quickAsk(q) {
    input.value = q;
    sendMessage();
  }

  function getStudentId() {
    return document.getElementById('studentSelect').value;
  }
  
  function getStudentName() {
    const sel = document.getElementById('studentSelect');
    return sel.options[sel.selectedIndex].text.split(' (')[0];
  }

  // ── Dashboard Data Fetching ──
  
  async function loadTimetable(studentId) {
    console.log("Selected Student:", studentId);
    const nextContainer  = document.getElementById('nextExamContainer');
    const noExamsContainer = document.getElementById('noExamsContainer');
    const timetableSection = document.getElementById('timetableSection');
    const timetableBody  = document.getElementById('timetableBody');
    const kpiEl          = document.getElementById('kpiNextExam');

    // Reset state
    nextContainer.style.display    = 'none';
    noExamsContainer.style.display = 'none';
    timetableSection.style.display = 'none';
    timetableBody.innerHTML        = '';

    try {
      // ── Fetch full schedule ──────────────────────────────────────────────
      const schedRes = await fetch(`http://127.0.0.1:5000/students/${studentId}/exam-schedule`);
      if (schedRes.ok) {
        const exams = await schedRes.json();
        if (exams.length > 0) {
          timetableSection.style.display = 'block';
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          exams.forEach(ex => {
            const dateObj = new Date(ex.exam_date + 'T00:00:00');
            const fDate = dateObj.toLocaleDateString(undefined, {day: '2-digit', month: 'short', year: 'numeric'});
            const diffMs = dateObj - today;
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const countdownText = daysLeft > 0 ? `${daysLeft} Days` : daysLeft === 0 ? 'Today' : 'Past';
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${fDate}</td>
              <td>${ex.start_time}</td>
              <td style="font-weight:600;">${ex.exam_name}</td>
              <td>${ex.course}</td>
              <td>${ex.room}</td>
              <td style="color:var(--accent); font-weight:600;">${countdownText}</td>
            `;
            timetableBody.appendChild(tr);
          });
        } else {
          // Show no-exams container only when confirmed empty
          const pEl = noExamsContainer.querySelector('p');
          if (pEl) pEl.textContent = "No exam schedules found for this student.";
          noExamsContainer.style.display = 'flex';
        }
      } else {
        const pEl = noExamsContainer.querySelector('p');
        if (pEl) pEl.textContent = "No exam schedules found for this student.";
        noExamsContainer.style.display = 'flex';
      }

      // ── Fetch next exam ───────────────────────────────────────────────────
      const nextRes = await fetch(`http://127.0.0.1:5000/students/${studentId}/next-exam`);
      if (nextRes.ok) {
        const nextExam = await nextRes.json();

        if (nextExam && nextExam.exam_date) {
          // Populate the Next Exam card
          const dateObj  = new Date(nextExam.exam_date + 'T00:00:00');
          const fDate    = dateObj.toLocaleDateString(undefined, {day: '2-digit', month: 'short', year: 'numeric'});

          document.getElementById('nextExamName').textContent = nextExam.exam_name;
          document.getElementById('nextExamDate').textContent = `Date: ${fDate}`;
          document.getElementById('nextExamTime').textContent = `Time: ${nextExam.start_time} – ${nextExam.end_time}`;
          document.getElementById('nextExamRoom').textContent = `Room: ${nextExam.room}`;

          // ── Countdown (Math.ceil so partial days round up) ────────────────
          const today   = new Date();
          today.setHours(0, 0, 0, 0);
          const examDay = new Date(nextExam.exam_date + 'T00:00:00');
          const diffMs  = examDay - today;
          const days    = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          const daysEl = document.getElementById('nextExamDays');
          daysEl.textContent = days > 0 ? days : 'Today';
          kpiEl.textContent  = days > 0 ? `${days}d` : 'Today';

          nextContainer.style.display = 'block';
        } else {
          noExamsContainer.style.display = 'flex';
          kpiEl.textContent = '--';
        }
      } else {
        noExamsContainer.style.display = 'flex';
        kpiEl.textContent = '--';
      }
    } catch (e) {
      console.error('Timetable load failed:', e);
      noExamsContainer.style.display = 'flex';
      kpiEl.textContent = '--';
    }
  }

  let countdownInterval; // kept for legacy startCountdown calls (not used for days anymore)

  async function loadProgramInfo(studentId) {
    const nameEl = document.getElementById('programName');
    const listEl = document.getElementById('programCoursesList');
    const batchEl = document.getElementById('dashBatch');
    nameEl.textContent = '—';
    listEl.innerHTML = '<li style="color: var(--muted);">Loading...</li>';

    try {
      const res = await fetch(`http://127.0.0.1:5000/students/${studentId}/courses`);
      if (res.ok) {
        const data = await res.json();
        nameEl.textContent = data.program_name;
        batchEl.textContent = `Program: ${data.program_name}`;
        listEl.innerHTML = '';
        if (data.courses && data.courses.length > 0) {
          data.courses.forEach(c => {
            const li = document.createElement('li');
            li.textContent = c;
            li.style.cursor = 'pointer';
            li.style.textDecoration = 'underline';
            li.style.color = 'var(--accent)';
            li.onclick = () => loadExamComparison(studentId, c);
            listEl.appendChild(li);
          });
        } else {
          listEl.innerHTML = '<li style="color: var(--muted);">No courses in program.</li>';
        }
      } else {
        nameEl.textContent = 'Not assigned';
        batchEl.textContent = 'Program: Not assigned';
        listEl.innerHTML = '<li style="color: var(--muted);">No academic program has been assigned yet.</li>';
      }
    } catch (e) {
      console.error('Failed to load program info', e);
      nameEl.textContent = 'Error';
      listEl.innerHTML = '<li style="color: var(--muted);">Could not load program.</li>';
    }
  }

  async function loadAssignedCourses(studentId) {
    const listEl = document.getElementById('assignedCoursesList');
    listEl.innerHTML = '<span style="color: var(--muted); font-size: 12px;">Loading assigned courses...</span>';
    try {
      const res = await fetch(`http://127.0.0.1:5000/students/${studentId}/assigned-courses`);
      if (res.ok) {
        const courses = await res.json();
        listEl.innerHTML = '';
        if (courses.length > 0) {
          courses.forEach(c => {
            const badge = document.createElement('span');
            badge.className = 'course-badge';
            badge.innerHTML = `📖 ${c.course_name} <span style="font-size: 10px; color: var(--muted); font-weight: 500;">(${c.department})</span>`;
            listEl.appendChild(badge);
          });
        } else {
          listEl.innerHTML = '<span style="color: var(--muted); font-size: 12px;">No courses assigned.</span>';
        }
      } else {
        listEl.innerHTML = '<span style="color: var(--muted); font-size: 12px;">Failed to load courses.</span>';
      }
    } catch (e) {
      console.error("Failed to load assigned courses", e);
      listEl.innerHTML = '<span style="color: var(--muted); font-size: 12px;">Error loading courses.</span>';
    }
  }

  async function loadDashboard() {
    const studentId = getStudentId();
    const name = getStudentName();
    
    console.log(`[Dashboard] Loading data for student: ${name} (${studentId})`);
    
    // Update Profile Card
    document.getElementById('dashName').textContent = name;
    document.getElementById('dashId').textContent = `ID: ${studentId}`;
    document.getElementById('dashAvatar').textContent = name.charAt(0);

    try {
      console.log(`[API] Fetching overall summary...`);
      const res = await fetch(`${API_BASE}/result-agent/overall-summary?studentId=${studentId}`);
      if (!res.ok) throw new Error('Data not found');
      
      const summary = await res.json();
      console.log(`[API] Received summary data:`, summary);
      currentSummaryData = summary;
      
      updateKPIs(summary);
      console.log(`[Dashboard] KPIs updated.`);
      
      updateAlerts(summary.topicResults);
    renderCharts(summary);
      console.log(`[Dashboard] Alerts updated.`);
      
      renderDashboardCharts(summary);
      console.log(`[Dashboard] Charts rendered.`);
      
      renderExamTable(summary.examSummaries);
      console.log(`[Dashboard] Exam table rendered.`);
      
      loadTimetable(studentId);
      loadProgramInfo(studentId);
      loadAssignedCourses(studentId);
      loadExamComparison(studentId);
      
      loadChatHistory(studentId);
      
      if (summary.topicResults) {
        const weakTopics = summary.topicResults.filter(t => t.level === 'Critical' || t.level === 'Weak');
        if (weakTopics.length > 0) {
           showNotification(`Focus needed: ${weakTopics[0].topic} is your weakest area!`);
        }
      }
    } catch (e) {
      console.warn('Dashboard load error:', e);
      document.getElementById('alertsContainer').innerHTML = `<div class="alert-banner critical">⚠️ No dashboard data found for this student.</div>`;
    }
    
    // Reset conversation
    currentConversationId = null;
  }

  let topicTrendChartInstance = null;

  async function loadExamComparison(studentId, courseName = "") {
    const section = document.getElementById('examComparisonSection');
    const fallback = document.getElementById('examCompFallback');
    const content = document.getElementById('examCompContent');
    
    section.style.display = 'flex';
    fallback.style.display = 'none';
    content.style.display = 'none';
    
    try {
      const res = await fetch(`${API_BASE}/result-agent/exam-comparison?studentId=${studentId}` + (courseName ? `&courseName=${encodeURIComponent(courseName)}` : ''));
      if (!res.ok) throw new Error('Failed to load comparison');
      const data = await res.json();
      
      if (data.message) {
        fallback.textContent = data.message;
        fallback.style.display = 'block';
        return;
      }
      
      content.style.display = 'flex';
      document.getElementById('examCompCourseName').textContent = data.course;
      
      // Render Summary Cards
      const cardsContainer = document.getElementById('examCompCards');
      let cardsHtml = '';
      
      data.exams.forEach((ex, idx) => {
        cardsHtml += `
          <div class="feature-card" style="padding: 16px; text-align: center;">
            <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">${ex.examName}</div>
            <div style="font-size: 24px; font-weight: 700; color: var(--text); margin-top: 4px;">${ex.percentage}%</div>
          </div>
        `;
      });
      
      cardsHtml += `
        <div class="feature-card" style="padding: 16px; text-align: center;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Average</div>
          <div style="font-size: 24px; font-weight: 700; color: var(--text); margin-top: 4px;">${data.averagePercentage}%</div>
        </div>
        <div class="feature-card" style="padding: 16px; text-align: center;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Trend</div>
          <div style="font-size: 20px; font-weight: 700; color: ${data.improvement.trend === 'Improving' ? 'var(--green)' : 'var(--text)'}; margin-top: 8px;">
            ${data.improvement.trend === 'Improving' ? '↗️ ' : (data.improvement.trend === 'Declining' ? '↘️ ' : '➖ ')}${data.improvement.trend}
          </div>
        </div>
      `;
      cardsContainer.innerHTML = cardsHtml;
      
    } catch (e) {
      console.error(e);
      fallback.textContent = 'Failed to load exam comparison.';
      fallback.style.display = 'block';
    }
  }

  function updateKPIs(summary) {
    const exams = summary.examSummaries || [];
    
    console.log("Selected Student:", summary.studentId);
    console.log("Student Exams:", exams);
    console.log("Exam Count:", exams.length);

    document.getElementById('kpiExams').textContent = exams.length;
    
    if (exams.length > 0) {
      const sortedExams = [...exams].sort((a,b) => new Date(a.submittedAt) - new Date(b.submittedAt));
      const latest = sortedExams[sortedExams.length - 1];
      console.log("Latest Exam:", latest);
      
      document.getElementById('kpiOverall').textContent = `${latest.percentage}%`;
      
      const badgeObj = assignBadge(latest.percentage);
      const badgeEl = document.getElementById('badge');
      badgeEl.textContent = badgeObj.badge;
      badgeEl.style.color = badgeObj.color;
      
      if (exams.length > 1) {
        const previousExams = sortedExams.slice(0, sortedExams.length - 1);
        const prevSum = previousExams.reduce((s, e) => s + e.percentage, 0);
        const previousAverage = prevSum / previousExams.length;
        console.log("Previous Average:", previousAverage);
        
        const difference = latest.percentage - previousAverage;
        const improvementPercent = previousAverage > 0 ? ((difference / previousAverage) * 100).toFixed(1) : '100.0';
        
        const sign = difference > 0 ? '+' : '';
        const trendIcon = difference > 0 ? '📈 ' : (difference < 0 ? '📉 ' : '');
        document.getElementById('kpiImprovement').textContent = `${trendIcon}${sign}${improvementPercent}%`;
        document.getElementById('kpiImprovement').style.color = difference >= 0 ? 'var(--green)' : 'var(--red)';
      } else {
        document.getElementById('kpiImprovement').textContent = 'Not enough history';
        document.getElementById('kpiImprovement').style.color = 'var(--text)';
      }
    } else {
      document.getElementById('kpiOverall').textContent = '--%';
      document.getElementById('kpiImprovement').textContent = '--%';
      const badgeEl = document.getElementById('badge');
      badgeEl.textContent = 'No Exams Yet';
      badgeEl.style.color = 'var(--muted)';
    }
  }


  let pieChartInstance = null;
  let lineChartInstance = null;
  let radarChartInstance = null;

  function renderCharts(summary) {
    const container = document.getElementById('chartsContainer');
    if (!container) return;
    
    // Check if we have data
    if (!summary.topicResults || summary.topicResults.length === 0) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'flex';

    if (pieChartInstance) pieChartInstance.destroy();
    if (lineChartInstance) lineChartInstance.destroy();
    if (radarChartInstance) radarChartInstance.destroy();

    // 1. Topic Performance Pie Chart
    const pieCtx = document.getElementById('topicPieChart').getContext('2d');
    const pieLabels = summary.topicResults.map(t => t.topic);
    const pieData = summary.topicResults.map(t => t.percentage);
    
    pieChartInstance = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: pieLabels.length ? pieLabels : ['No Data'],
        datasets: [{
          data: pieData.length ? pieData : [100],
          backgroundColor: pieData.length ? [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)'
          ] : ['rgba(100,100,100,0.2)'],
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // 2. Performance Trend Line Chart
    let lineLabels = ['No Data'];
    let lineData = [0];
    let labelText = 'No Data';
    
    if (summary.examSummaries && summary.examSummaries.length > 0) {
        const courseMap = {};
        summary.examSummaries.forEach(ex => {
          if (!courseMap[ex.courseName]) courseMap[ex.courseName] = [];
          courseMap[ex.courseName].push(ex);
        });
        
        let targetCourse = Object.values(courseMap).find(exams => exams.length >= 3);
        if (!targetCourse) {
           targetCourse = Object.values(courseMap)[0] || [];
        }
        
        targetCourse.sort((a,b) => a.examName.localeCompare(b.examName));
        
        lineLabels = targetCourse.map(t => {
          if(t.examName.includes('Internal Test 1')) return 'IT 1';
          if(t.examName.includes('Internal Test 2')) return 'IT 2';
          if(t.examName.includes('Internal Test 3')) return 'IT 3';
          return t.examName.substring(0, 10);
        });
        lineData = targetCourse.map(t => t.percentage);
        labelText = targetCourse.length ? targetCourse[0].courseName : 'No Data';
    }

    const lineCtx = document.getElementById('trendLineChart').getContext('2d');
    lineChartInstance = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: lineLabels,
        datasets: [{
          label: labelText,
          data: lineData,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          fill: true,
          tension: 0.4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
    });

    // 3. Outcome Radar Chart
    const radarCtx = document.getElementById('outcomeRadarChart').getContext('2d');
    let radarLabels = ['No Data'];
    let radarData = [0];
    if (summary.outcomeResults && summary.outcomeResults.length > 0) {
        radarLabels = summary.outcomeResults.map(o => o.outcome.split(' - ')[0]);
        radarData = summary.outcomeResults.map(o => o.percentage);
    }

    radarChartInstance = new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: radarLabels,
        datasets: [{
          label: 'Outcome Strengths',
          data: radarData,
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          pointBackgroundColor: 'rgba(16, 185, 129, 1)'
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false,
        scales: { r: { min: 0, max: 100, ticks: { display: false } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  function updateAlerts(topicResults) {
    const alerts = document.getElementById('alertsContainer');
    alerts.innerHTML = '';
    
    if (!topicResults || !topicResults.length) return;
    
    const critical = topicResults.filter(t => t.level === 'Critical');
    const weak = topicResults.filter(t => t.level === 'Weak');
    const good = topicResults.filter(t => t.level === 'Good');
    
    if (critical.length > 0) {
      alerts.innerHTML += `<div class="alert-banner critical">🚨 <strong>Critical Attention Needed:</strong> You are failing in ${critical.map(t=>t.topic).join(', ')}.</div>`;
    }
    if (weak.length > 0) {
      alerts.innerHTML += `<div class="alert-banner weak">⚠️ <strong>Needs Improvement:</strong> Weak performance in ${weak.map(t=>t.topic).join(', ')}.</div>`;
    }
    if (good.length > 0) {
      alerts.innerHTML += `<div class="alert-banner good">✅ <strong>Excellent Work:</strong> Strong performance in ${good.map(t=>t.topic).join(', ')}. Keep it up!</div>`;
    }
  }

  function renderDashboardCharts(summary) {
    // Removed
  }

  // ── New Features (PDF, Table, Badge, Suggestions, Notifications, History) ──

  function showNotification(message) {
    const notif = document.createElement('div');
    notif.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: var(--surface);
      border: 1px solid var(--yellow); color: var(--yellow); padding: 16px 20px;
      border-radius: 10px; z-index: 9999; animation: fadeUp 0.3s ease; max-width: 300px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    notif.innerHTML = `⚠️ ${message}`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
  }

  function downloadPDF() {
    const studentId = getStudentId();
    
    doc.text('Topic-wise Performance:', 20, 80);
    const topicResults = currentSummaryData.topicResults || [];
    topicResults.forEach((t, i) => {
      doc.text(
        `${t.topic}: ${t.percentage}% (${t.level})`, 
        20, 
        95 + (i * 10)
      );
    });
    
    doc.save(`report_${studentId}.pdf`);
  }

  function getLevel(percentage) {
    if (percentage >= 90) return 'Good';
    if (percentage >= 75) return 'Average';
    if (percentage >= 60) return 'Weak';
    return 'Critical';
  }

  function renderExamTable(examSummaries) {
    const tbody = document.getElementById('examTableBody');
    if (!examSummaries || examSummaries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--muted); padding: 24px;">No exam records available.</td></tr>';
      return;
    }
    const sortedExams = [...examSummaries].sort((a, b) => {
      const da = a.submittedAt ? new Date(a.submittedAt) : 0;
      const db = b.submittedAt ? new Date(b.submittedAt) : 0;
      return db - da;
    });
    tbody.innerHTML = sortedExams.map(exam => {
      const level = getLevel(exam.percentage);
      const marksScored = exam.marksScored ?? 0;
      const totalMarks = exam.totalMarks ?? 0;
      const pct = exam.percentage ?? 0;
      return `
      <tr>
        <td>${exam.examName || '—'}</td>
        <td>${marksScored}/${totalMarks}</td>
        <td>${pct}%</td>
        <td><span class="badge ${level}">${level}</span></td>
      </tr>`;
    }).join('');
  }

  function assignBadge(percentage) {
    if (percentage >= 90) return { badge: '🏆 Gold Scholar', color: '#ffd700' };
    if (percentage >= 75) return { badge: '🥈 Silver Achiever', color: '#c0c0c0' };
    if (percentage >= 60) return { badge: '🥉 Bronze Learner', color: '#cd7f32' };
    if (percentage >= 40) return { badge: '📚 Keep Learning', color: '#60a5fa' };
    return { badge: '💪 Rising Star', color: '#f87171' };
  }

  document.getElementById('msgInput').addEventListener('input', function() {
    const val = this.value.toLowerCase();
    if (!val) {
      hideSuggestions();
      return;
    }
    const filtered = suggestionsList.filter(s => s.toLowerCase().includes(val));
    showSuggestions(filtered);
  });

  function showSuggestions(list) {
    const div = document.getElementById('suggestions');
    if (list.length === 0) {
      hideSuggestions();
      return;
    }
    div.innerHTML = list.map(s => `
      <div class="suggestion-item" onclick="selectSuggestion('${s.replace(/'/g, "\\'")}')">
        ${s}
      </div>
    `).join('');
    div.style.display = 'block';
  }

  function hideSuggestions() {
    document.getElementById('suggestions').style.display = 'none';
  }

  function selectSuggestion(text) {
    document.getElementById('msgInput').value = text;
    hideSuggestions();
    sendMessage();
  }
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-area')) {
      hideSuggestions();
    }
  });

  function saveChat(studentId, role, message, topicResults = null, showTopics = false) {
    const key = `chat_${studentId}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    
    history.push({ role, message, topicResults, showTopics, timestamp: new Date().toISOString() });
    if (history.length > 20) history.shift();
    
    localStorage.setItem(key, JSON.stringify(history));
  }

  function loadChatHistory(studentId) {
    const key = `chat_${studentId}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    
    const chatContainer = document.getElementById('chat');
    chatContainer.innerHTML = `
      <div class="msg bot">
        <div class="avatar">🤖</div>
        <div class="bubble">
          👋 Hi! I'm your <strong>EduAgent</strong>.<br/>
          Select a student and view their dashboard or ask me a question!
        </div>
      </div>
    `;

    history.forEach(msg => {
      appendMsg(msg.role, msg.message, msg.topicResults, msg.showTopics, false);
    });
  }

  // ── Chat Functions ──
  function renderChatChart(topicResults, canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topicResults.map(t => t.topic),
        datasets: [{
          label: 'Performance %',
          data: topicResults.map(t => t.percentage),
          backgroundColor: topicResults.map(t => {
            if (t.level === 'Critical') return '#ef4444';
            if (t.level === 'Weak') return '#f59e0b';
            if (t.level === 'Average') return '#3b82f6';
            return '#10b981';
          })
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
    });
  }

  function renderTopics(items, label) {
    if (!items || items.length === 0) return '';
    let html = `<div class="result-section"><h4>${label}</h4>`;
    items.forEach(item => {
      const name  = item.topic || item.outcome;
      const pct   = item.percentage;
      const level = item.level;
      const colorClass = level === 'Critical' ? 'red' : level === 'Weak' ? 'yellow' : level === 'Good' ? 'green' : 'text';
      html += `
        <div class="topic-card">
          <span class="topic-name">${name}</span>
          <div class="topic-bar-wrap"><div class="topic-bar bar-${level}" style="width:${pct}%"></div></div>
          <span class="topic-pct" style="color:var(--${colorClass})">${pct}%</span>
          <span class="badge ${level}">${level}</span>
        </div>`;
    });
    html += '</div>';
    return html;
  }

  function appendMsg(role, content, topicResults = null, showTopics = false, save = true) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    const isBot = role === 'bot';
    
    let html = `<div>${content}</div>`;
    
    let chartId = null;
    let sorted = null;

    if (showTopics && topicResults && topicResults.length > 0) {
      sorted = [...topicResults].sort((a, b) => a.percentage - b.percentage);
      html += renderTopics(sorted, '📊 Topic-wise Performance');
      chartId = 'chart_' + Date.now() + Math.floor(Math.random() * 1000);
      html += `<div style="margin-top: 15px; background: var(--card); padding: 10px; border-radius: 8px;"><canvas id="${chartId}"></canvas></div>`;
    }
    
    div.innerHTML = `
      <div class="avatar">${isBot ? '🤖' : '🧑'}</div>
      <div class="bubble">${html}</div>`;
    
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;

    if (chartId && sorted) {
      renderChatChart(sorted, chartId);
    }

    if (save) {
      saveChat(getStudentId(), role, content, topicResults, showTopics);
    }
    
    return div;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'msg bot'; div.id = 'typing';
    div.innerHTML = `<div class="avatar">🤖</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('typing');
    if (t) t.remove();
  }

  async function sendMessage() {
    const q = input.value.trim();
    if (!q) return;

    const studentId = getStudentId();
    input.value = '';
    sendBtn.disabled = true;

    appendMsg('user', q);
    showTyping();

    try {
      const reqBody = { studentId, question: q };
      if (currentConversationId) {
        reqBody.conversationId = currentConversationId;
      }

      const res = await fetch(`${API_BASE}/result-agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });
      const data = await res.json();
      
      if (data.conversationId) {
        currentConversationId = data.conversationId;
      }

      removeTyping();

      if (data.studyPlan && data.studyPlan.generated) {
        // Show success message
        appendMsg('bot', data.answer, null, false);
        
        // Show download button
        const downloadDiv = document.createElement('div');
        downloadDiv.className = 'msg bot';
        downloadDiv.innerHTML = `
          <div class="avatar">🤖</div>
          <div class="bubble" style="background: linear-gradient(135deg, #6c63ff22, #34d39922); border: 1px solid #6c63ff;">
            <div style="font-size:13px; font-weight:600; color:#34d399; margin-bottom:8px;">
              ✅ Study Plan Generated Successfully!
            </div>
            <div style="font-size:12px; color:#7b82a8; margin-bottom:12px;">
              Your personalized 7-day plan with sleep schedule and nutrition guide is ready!
            </div>
            <a href="http://127.0.0.1:5000${data.studyPlan.downloadUrl}" 
               target="_blank"
               style="display:inline-block; background: linear-gradient(135deg, #6c63ff, #a78bfa); 
                      color:white; padding:10px 20px; border-radius:8px; 
                      text-decoration:none; font-size:12px; font-weight:600;">
              📥 Download Study Plan PDF
            </a>
          </div>`;
        chat.appendChild(downloadDiv);
        chat.scrollTop = chat.scrollHeight;
        
        sendBtn.disabled = false;
        input.focus();
        return;
      }

      const qLower = q.toLowerCase();
      const shouldShowTopics = qLower.includes('topic') || qLower.includes('improve') || qLower.includes('weak') || qLower.includes('performance');
      const isUnknownExam = data.answer.toLowerCase().includes('has not been conducted');
      
      if (isUnknownExam || !shouldShowTopics || !data.topicResults) {
        appendMsg('bot', data.answer);
      } else {
        appendMsg('bot', data.answer, data.topicResults, true);
      }

    } catch (err) {
      removeTyping();
      appendMsg('bot', `⚠️ Error: ${err.message}`);
    }

    sendBtn.disabled = false;
    input.focus();
  }

  // ── RAG PDF Copilot Handlers ──
  let currentDocId = null;

  async function uploadPDF() {
    const fileInput = document.getElementById('pdfInput');
    const file = fileInput.files[0];
    
    if (!file) {
      alert('Please select a PDF file');
      return;
    }

    if (file.type !== 'application/pdf') {
      alert('Only PDF files allowed');
      return;
    }

    // Show loading
    document.getElementById('uploadStatusText').textContent = '⏳ Uploading...';
    document.getElementById('pdfDropzone').style.opacity = "0.7";

    // Fix: Use FormData correctly
    // Do NOT set Content-Type header manually
    // Let browser set multipart/form-data automatically
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/rag/upload-pdf', {
        method: 'POST',
        body: formData
        // DO NOT add headers here - multer handles it
      });

      const data = await res.json();

      if (data.success) {
        currentDocId = data.docId;
        document.getElementById('uploadStatusText').textContent = 
          '✅ ' + data.fileName + ' uploaded! (' + data.pages + ' pages)';
        
        document.getElementById('uploadedFileName').textContent = data.fileName;
        document.getElementById('pdfDropzone').style.display = 'none';
        document.getElementById('uploadedFileInfo').style.display = 'flex';
        
        // Hide generated questions / answers from any previous document
        document.getElementById('generatedQuestionsSection').style.display = 'none';
        document.getElementById('pdfAnswerSection').style.display = 'none';
        
        showNotification(`Successfully uploaded ${data.fileName}!`);
      } else {
        document.getElementById('uploadStatusText').textContent = 
          '❌ Failed: ' + data.error;
        document.getElementById('pdfDropzone').style.opacity = "1";
      }

    } catch (error) {
      document.getElementById('uploadStatusText').textContent = 
        '❌ Upload failed: ' + error.message;
      document.getElementById('pdfDropzone').style.opacity = "1";
    }
  }

  function clearUploadedPdf(event) {
    if (event) event.stopPropagation();
    currentDocId = null;
    document.getElementById('pdfInput').value = '';
    document.getElementById('pdfDropzone').style.display = 'flex';
    document.getElementById('pdfDropzone').style.opacity = '1';
    document.getElementById('uploadStatusText').textContent = "Click to upload PDF";
    document.getElementById('uploadedFileInfo').style.display = 'none';
    document.getElementById('generatedQuestionsSection').style.display = 'none';
    document.getElementById('pdfAnswerSection').style.display = 'none';
  }

  async function askPdfQuestion() {
    if (!currentDocId) {
      showNotification("Please upload a PDF document first!");
      return;
    }

    const qInput = document.getElementById('pdfQuestionInput');
    const question = qInput.value.trim();
    if (!question) return;

    const askBtn = document.getElementById('askPdfBtn');
    const answerSection = document.getElementById('pdfAnswerSection');
    const answerText = document.getElementById('pdfAnswerText');
    const sourceTextDiv = document.getElementById('pdfSourceText');
    const sourceSection = document.getElementById('pdfSourceSection');
    const toggleBtn = document.getElementById('toggleSourceBtn');

    askBtn.disabled = true;
    askBtn.textContent = "Thinking...";
    answerSection.style.display = 'block';
    answerText.textContent = "Analyzing document context and generating answer...";
    
    // Reset source text view
    sourceSection.style.display = 'none';
    toggleBtn.textContent = "Show Reference Source";

    try {
      const studentId = getStudentId();
      const res = await fetch(`${API_BASE}/rag/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, question, docId: currentDocId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get response');

      answerText.textContent = data.answer;
      sourceTextDiv.textContent = data.sourceText || "No source chunk available.";
    } catch (err) {
      console.error(err);
      answerText.textContent = `⚠️ Error: ${err.message}`;
    } finally {
      askBtn.disabled = false;
      askBtn.textContent = "Ask PDF";
    }
  }

  async function generateQuestions() {
    if (!currentDocId) {
      showNotification("Please upload a PDF document first!");
      return;
    }

    const topicInput = document.getElementById('topicInput');
    const topic = topicInput.value.trim();
    if (!topic) {
      showNotification("Please enter a topic/chapter name!");
      return;
    }

    const genBtn = document.getElementById('genQuestionsBtn');
    const questionsSection = document.getElementById('generatedQuestionsSection');
    const questionsGrid = document.getElementById('questionsGrid');

    genBtn.disabled = true;
    genBtn.textContent = "Generating...";
    questionsSection.style.display = 'flex';
    questionsGrid.innerHTML = '<span style="color: var(--muted); font-size: 12px; grid-column: 1/-1;">Generating practice questions from the PDF...</span>';

    try {
      const res = await fetch(`${API_BASE}/rag/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: currentDocId, topic, count: 5 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate questions');

      questionsGrid.innerHTML = '';
      if (data.questions && data.questions.length > 0) {
        data.questions.forEach(q => {
          const card = document.createElement('div');
          card.style.cssText = `
            background: var(--card); border: 1px solid var(--border); border-radius: 8px;
            padding: 12px; font-size: 12px; cursor: pointer; color: var(--text);
            transition: all 0.2s; min-height: 50px; display: flex; align-items: center;
          `;
          card.textContent = q;
          card.onclick = () => {
            document.getElementById('pdfQuestionInput').value = q;
            askPdfQuestion();
          };
          card.onmouseover = () => {
            card.style.borderColor = 'var(--accent)';
            card.style.background = 'rgba(108, 99, 255, 0.05)';
          };
          card.onmouseout = () => {
            card.style.borderColor = 'var(--border)';
            card.style.background = 'var(--card)';
          };
          questionsGrid.appendChild(card);
        });
      } else {
        questionsGrid.innerHTML = '<span style="color: var(--muted); font-size: 12px; grid-column: 1/-1;">No questions could be generated.</span>';
      }
    } catch (err) {
      console.error(err);
      questionsGrid.innerHTML = `<span style="color: var(--red); font-size: 12px; grid-column: 1/-1;">⚠️ Error: ${err.message}</span>`;
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = "Generate 5 Questions";
    }
  }

  function toggleSourceText() {
    const sourceSection = document.getElementById('pdfSourceSection');
    const toggleBtn = document.getElementById('toggleSourceBtn');
    if (sourceSection.style.display === 'none') {
      sourceSection.style.display = 'block';
      toggleBtn.textContent = "Hide Reference Source";
    } else {
      sourceSection.style.display = 'none';
      toggleBtn.textContent = "Show Reference Source";
    }
  }

  // Load initial dashboard on startup
  window.onload = loadDashboard;

  function generateStudyPlan() {
    const input = document.getElementById('chatInput');
    input.value = "Give me a study plan";
    sendMessage();
  }
