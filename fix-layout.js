const fs = require('fs');

function extractBlock(html, startMarker, endMarker) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;
  const endIdx = html.indexOf(endMarker, startIdx);
  if (endIdx === -1) return null;
  return html.substring(startIdx, endIdx);
}

function removeBlock(html, startMarker, endMarker) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return html;
  const endIdx = html.indexOf(endMarker, startIdx);
  if (endIdx === -1) return html;
  return html.substring(0, startIdx) + html.substring(endIdx);
}

let html = fs.readFileSync('index.html', 'utf8');

const courseCompStart = '    <!-- NEW COURSE COMPARISON CARD -->';
const ragCopilotStart = '    <!-- ── RAG PDF COPILOT SECTION ── -->';
const assignedCoursesStart = '    <!-- ── ASSIGNED COURSES SECTION ── -->';
const timetableStart = '    <!-- ── UPCOMING EXAM SCHEDULE TABLE ── -->';
const examCompStart = '    <!-- ── EXAM COMPARISON SECTION ── -->';
const studyPlanStart = '    <!-- ── STUDY PLAN DASHBOARD ── -->';

// 1. Extract the examComparisonSection (the new charts)
const examCompBlock = extractBlock(html, examCompStart, studyPlanStart);

// 2. Remove it from its current location
html = removeBlock(html, examCompStart, studyPlanStart);

// 3. Re-insert it exactly after courseComparisonCard (before ragCopilotStart)
if (examCompBlock) {
  const insertIdx = html.indexOf(ragCopilotStart);
  if (insertIdx !== -1) {
    html = html.substring(0, insertIdx) + examCompBlock + '\n' + html.substring(insertIdx);
  }
}

// 4. Restore the original .charts-grid that I deleted (before exam-comparison-container)
// I will append it right before "  </div>\n\n  <!-- Chat Widget -->"
const chartsGridOld = `
    <!-- ── ORIGINAL CHARTS GRID ── -->
    <div class="charts-grid">
      <div class="chart-container">
        <h3>Topic Performance (Pie)</h3>
        <div class="chart-wrapper"><canvas id="pieChart"></canvas></div>
      </div>
      <div class="chart-container">
        <h3>Performance Trend (Line)</h3>
        <div class="chart-wrapper"><canvas id="lineChart"></canvas></div>
      </div>
      <div class="chart-container">
        <h3>Outcome Strengths (Radar)</h3>
        <div class="chart-wrapper"><canvas id="radarChart"></canvas></div>
      </div>
    </div>
`;

// Also restore examTableWrapper that was deleted.
const examTableContainerOld = `
    <!-- ── ORIGINAL EXAM WISE COMPARISON ── -->
    <div class="table-container exam-comparison-container">
      <h3>Exam-wise Comparison</h3>
      <div class="table-wrapper" id="examTableWrapper">
        <table>
          <thead>
            <tr>
              <th>Exam</th>
              <th>Marks</th>
              <th>Percentage</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody id="examTableBody">
            <tr><td colspan="4" style="text-align:center; color:var(--muted); padding: 24px;">No exam records available.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
`;

// Insert them at the very bottom of the dashboard, before the closing </div>
const dashboardEndIdx = html.indexOf('  </div>\n\n  <!-- Chat Widget -->');
if (dashboardEndIdx !== -1) {
  html = html.substring(0, dashboardEndIdx) + chartsGridOld + '\n' + examTableContainerOld + '\n' + html.substring(dashboardEndIdx);
}

// 5. Rename the new charts inside examCompBlock to avoid ID collisions:
// In the newly inserted HTML, we need to change id="pieChart" to id="pieChartComp"
// But since we just inserted it, we can just replace globally inside the file, being careful.
// The new charts are in .charts-grid-new
const newGridStart = html.indexOf('<div class="charts-grid-new">');
if (newGridStart !== -1) {
  const newGridEnd = html.indexOf('</div>\n    </div>\n\n    <!-- ── RAG', newGridStart);
  if (newGridEnd !== -1) {
    let newGridHtml = html.substring(newGridStart, newGridEnd);
    newGridHtml = newGridHtml.replace('id="pieChart"', 'id="pieChartComp"');
    newGridHtml = newGridHtml.replace('id="lineChart"', 'id="lineChartComp"');
    newGridHtml = newGridHtml.replace('id="radarChart"', 'id="radarChartComp"');
    html = html.substring(0, newGridStart) + newGridHtml + html.substring(newGridEnd);
  }
}

// 6. Update the JS in loadExamComparison to use the new IDs!
html = html.replace("document.getElementById('pieChart').getContext('2d')", "document.getElementById('pieChartComp').getContext('2d')");
html = html.replace("document.getElementById('lineChart').getContext('2d')", "document.getElementById('lineChartComp').getContext('2d')");
html = html.replace("document.getElementById('radarChart').getContext('2d')", "document.getElementById('radarChartComp').getContext('2d')");

fs.writeFileSync('index.html', html);
console.log('Layout fixed successfully.');
