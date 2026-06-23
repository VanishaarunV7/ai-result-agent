const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Inject HTML
const marker = '</div>\n    </div>\n\n    <!-- ── RAG PDF COPILOT SECTION ── -->';
const injectedHTML = `
    <!-- ── CHARTS SECTION ── -->
    <div id="chartsContainer" style="display: none; flex-direction: column; gap: 16px; margin-bottom: 24px;">
      <h3 style="font-size: 13px; color: var(--accent2); text-transform: uppercase; letter-spacing: 0.05em; margin: 0; font-weight: 700;">📈 Performance Analytics</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        <!-- Pie Chart -->
        <div class="feature-card" style="padding: 16px; display: flex; flex-direction: column; align-items: center;">
          <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 12px; color: var(--muted); text-transform: uppercase;">📊 Topic Performance</h4>
          <div style="position: relative; width: 100%; max-width: 250px; aspect-ratio: 1/1;">
            <canvas id="topicPieChart"></canvas>
          </div>
        </div>
        
        <!-- Line Chart -->
        <div class="feature-card" style="padding: 16px; display: flex; flex-direction: column; align-items: center;">
          <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 12px; color: var(--muted); text-transform: uppercase;">📈 Performance Trend</h4>
          <div style="position: relative; width: 100%; aspect-ratio: 4/3;">
            <canvas id="trendLineChart"></canvas>
          </div>
        </div>

        <!-- Radar Chart -->
        <div class="feature-card" style="padding: 16px; display: flex; flex-direction: column; align-items: center;">
          <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 12px; color: var(--muted); text-transform: uppercase;">🎯 Outcome Strengths</h4>
          <div style="position: relative; width: 100%; max-width: 250px; aspect-ratio: 1/1;">
            <canvas id="outcomeRadarChart"></canvas>
          </div>
        </div>
      </div>
    </div>
`;

if (html.includes(marker)) {
  html = html.replace(marker, injectedHTML + marker);
  console.log('Injected HTML successfully.');
} else {
  console.log('Could not find HTML marker to inject.');
}

// 2. Inject JS rendering function
const jsMarker = '  function updateAlerts(topicResults) {';
const renderChartsJS = `
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

  function updateAlerts(topicResults) {`;

if (html.includes(jsMarker)) {
  html = html.replace(jsMarker, renderChartsJS);
  console.log('Injected renderCharts function successfully.');
} else {
  console.log('Could not find JS marker to inject renderCharts.');
}

// 3. Call renderCharts inside loadStudentDashboard
const callMarker = 'updateAlerts(summary.topicResults);';
if (html.includes(callMarker)) {
  html = html.replace(callMarker, callMarker + '\\n    renderCharts(summary);');
  console.log('Injected renderCharts call successfully.');
} else {
  console.log('Could not find marker to call renderCharts.');
}

fs.writeFileSync('index.html', html);
