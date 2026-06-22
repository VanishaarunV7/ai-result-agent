
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
  const API_BASE = 'http://localhost:5000/api';
  let currentConversationId = null;
  let chartInstances = {};
  let currentSummaryData = null;

  const suggestionsList = [
    "Which topic should I improve?",
    "How was my last exam?",
    "Am I improving?",
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
      console.log(`[Dashboard] Alerts updated.`);
      
      renderDashboardCharts(summary);
      console.log(`[Dashboard] Charts rendered.`);
      
      renderExamTable(summary.examSummaries);
      console.log(`[Dashboard] Exam table rendered.`);
      
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

  function updateKPIs(summary) {
    const exams = summary.examSummaries || [];
    document.getElementById('kpiExams').textContent = exams.length;
    
      if (exams.length > 0) {
      const sortedExams = [...exams].sort((a,b) => new Date(a.submittedAt) - new Date(b.submittedAt));
      const latest = sortedExams[sortedExams.length - 1];
      document.getElementById('kpiOverall').textContent = `${latest.percentage}%`;
      
      const badgeObj = assignBadge(latest.percentage);
      const badgeEl = document.getElementById('badge');
      badgeEl.textContent = badgeObj.badge;
      badgeEl.style.color = badgeObj.color;
      
      if (exams.length > 1) {
        const prev = sortedExams[sortedExams.length - 2];
        const diff = (latest.percentage - prev.percentage).toFixed(1);
        const sign = diff > 0 ? '+' : '';
        document.getElementById('kpiImprovement').textContent = `${sign}${diff}%`;
        document.getElementById('kpiImprovement').style.color = diff >= 0 ? 'var(--green)' : 'var(--red)';
      } else {
        document.getElementById('kpiImprovement').textContent = 'N/A';
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
    const { topicResults, outcomeResults, examSummaries } = summary;
    
    Object.values(chartInstances).forEach(c => c.destroy());
    chartInstances = {};

    // 1. Pie Chart (Topic Performance)
    if (topicResults && topicResults.length) {
      const ctxPie = document.getElementById('pieChart').getContext('2d');
      chartInstances.pie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: topicResults.map(t => t.topic),
          datasets: [{
            data: topicResults.map(t => t.percentage),
            backgroundColor: topicResults.map(t => {
              if (t.level === 'Critical') return '#ef4444';
              if (t.level === 'Weak') return '#f59e0b';
              if (t.level === 'Average') return '#3b82f6';
              return '#10b981';
            }),
            borderWidth: 0
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
      });
    }

    // 2. Line Chart (Exam Trend)
    if (examSummaries && examSummaries.length) {
      const sorted = [...examSummaries].sort((a,b) => new Date(a.submittedAt) - new Date(b.submittedAt));
      const ctxLine = document.getElementById('lineChart').getContext('2d');
      chartInstances.line = new Chart(ctxLine, {
        type: 'line',
        data: {
          labels: sorted.map(e => e.examName),
          datasets: [{
            label: 'Score %',
            data: sorted.map(e => e.percentage),
            borderColor: '#6c63ff',
            backgroundColor: 'rgba(108,99,255,0.1)',
            fill: true,
            tension: 0.3
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
      });
    }

    // 3. Radar Chart (Outcome Strengths)
    if (outcomeResults && outcomeResults.length) {
      const ctxRadar = document.getElementById('radarChart').getContext('2d');
      chartInstances.radar = new Chart(ctxRadar, {
        type: 'radar',
        data: {
          labels: outcomeResults.map(o => o.outcome.substring(0, 15) + '...'),
          datasets: [{
            label: 'Outcome Mastery %',
            data: outcomeResults.map(o => o.percentage),
            borderColor: '#a78bfa',
            backgroundColor: 'rgba(167,139,250,0.2)',
            pointBackgroundColor: '#a78bfa'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false } } } }
      });
    }
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
    if (!currentSummaryData) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const studentName = getStudentName();
    const studentId = getStudentId();
    
    let overallPercentage = '--';
    const exams = currentSummaryData.examSummaries || [];
    if (exams.length > 0) {
      const sortedExams = [...exams].sort((a,b) => new Date(a.submittedAt) - new Date(b.submittedAt));
      overallPercentage = sortedExams[sortedExams.length - 1].percentage;
    }

    doc.setFontSize(20);
    doc.text('Student Performance Report', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Student: ${studentName}`, 20, 40);
    doc.text(`ID: ${studentId}`, 20, 50);
    doc.text(`Overall: ${overallPercentage}%`, 20, 60);
    
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
    if (!examSummaries) {
      document.getElementById('examTable').innerHTML = '';
      return;
    }
    const sortedExams = [...examSummaries].sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt)); // Latest first
    const rows = sortedExams.map(exam => {
      const level = getLevel(exam.percentage);
      return `
      <tr>
        <td>${exam.examName}</td>
        <td>${exam.marksScored}/${exam.totalMarks}</td>
        <td>${exam.percentage}%</td>
        <td>
          <span class="badge ${level}">
            ${level}
          </span>
        </td>
      </tr>
    `}).join('');
    
    document.getElementById('examTable').innerHTML = rows;
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

  // Load initial dashboard on startup
  window.onload = loadDashboard;
