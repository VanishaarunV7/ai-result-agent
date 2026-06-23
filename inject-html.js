const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Inject HTML
const marker = '<div class="feature-card" id="ragCopilotCard"';
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

fs.writeFileSync('index.html', html);
