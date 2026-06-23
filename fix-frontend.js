const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Make courses clickable in loadProgramInfo
// We replace:
// const li = document.createElement('li');
// li.textContent = c;
// listEl.appendChild(li);
const oldCourseLi = "const li = document.createElement('li');\\n            li.textContent = c;\\n            listEl.appendChild(li);";
const newCourseLi = `const li = document.createElement('li');
            li.textContent = c;
            li.style.cursor = 'pointer';
            li.style.textDecoration = 'underline';
            li.style.color = 'var(--accent)';
            li.onclick = () => loadExamComparison(studentId, c);
            listEl.appendChild(li);`;
html = html.replace(oldCourseLi, newCourseLi);

// 2. Modify loadExamComparison to accept courseName
html = html.replace(
  'async function loadExamComparison(studentId) {',
  'async function loadExamComparison(studentId, courseName = "") {'
);
html = html.replace(
  "const res = await fetch(`http://127.0.0.1:5000/api/result-agent/exam-comparison?studentId=${studentId}`);",
  "const res = await fetch(`http://127.0.0.1:5000/api/result-agent/exam-comparison?studentId=${studentId}` + (courseName ? `&courseName=${encodeURIComponent(courseName)}` : ''));"
);

// Wait, earlier I might have replaced API_BASE or hardcoded http://127.0.0.1:5000. Let's use regex or just try both.
html = html.replace(
  "const res = await fetch(`${API_BASE}/result-agent/exam-comparison?studentId=${studentId}`);",
  "const res = await fetch(`${API_BASE}/result-agent/exam-comparison?studentId=${studentId}` + (courseName ? `&courseName=${encodeURIComponent(courseName)}` : ''));"
);

// 3. Remove ORIGINAL charts grid completely.
const chartsGridStart = '    <!-- ── ORIGINAL CHARTS GRID ── -->';
const examCompStart = '    <!-- ── ORIGINAL EXAM WISE COMPARISON ── -->';
const startIdx = html.indexOf(chartsGridStart);
const endIdx = html.indexOf(examCompStart);
if (startIdx !== -1 && endIdx !== -1) {
  html = html.substring(0, startIdx) + html.substring(endIdx);
}

// 4. Remove chart initialization and rendering from renderDashboardCharts
const renderFuncStart = html.indexOf('function renderDashboardCharts(summary) {');
const renderFuncEnd = html.indexOf('function renderExamTable(exams)', renderFuncStart);
if (renderFuncStart !== -1 && renderFuncEnd !== -1) {
  let renderFuncBlock = html.substring(renderFuncStart, renderFuncEnd);
  
  // We need to delete the initialization of pie, line, and radar.
  // We'll replace the block with an empty function body just doing return if we don't need it.
  // Actually, wait, maybe other charts are there? "Remove ONLY these sections: ...".
  // Was there anything else in renderDashboardCharts?
  // Let's just remove the Chart instantiations.
  
  const chartDestroyStart = renderFuncBlock.indexOf('if (chartInstances.pie) chartInstances.pie.destroy();');
  if (chartDestroyStart !== -1) {
     renderFuncBlock = renderFuncBlock.substring(0, chartDestroyStart) + '\\n}';
  }
  
  html = html.substring(0, renderFuncStart) + renderFuncBlock + '\\n\\n  ' + html.substring(renderFuncEnd);
}

fs.writeFileSync('index.html', html);
console.log('index.html updated successfully');
