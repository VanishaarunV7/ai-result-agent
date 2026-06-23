const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split('\n');
const targets = [
  'id="courseComparisonCard"',
  'id="examComparisonSection"',
  'id="ragCopilotCard"',
  'id="assignedCoursesCard"',
  'id="timetableSection"',
  'class="charts-grid"',
  'class="table-container exam-comparison-container"'
];
targets.forEach(t => {
  const lineNum = lines.findIndex(l => l.includes(t));
  console.log(lineNum + ': ' + t);
});
