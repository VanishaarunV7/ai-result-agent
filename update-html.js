const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Remove courseComparisonCard
const ccStart = html.indexOf('    <!-- NEW COURSE COMPARISON CARD -->');
const ccEnd = html.indexOf('    <!-- ── EXAM COMPARISON SECTION ── -->');
if (ccStart !== -1 && ccEnd !== -1) {
  html = html.substring(0, ccStart) + html.substring(ccEnd);
  console.log('Removed courseComparisonCard.');
} else {
  console.log('Could not find courseComparisonCard bounds.');
}

// 2. Add generateStudyPlan function
const scriptEndIdx = html.lastIndexOf('</script>');
const genFunc = `
  function generateStudyPlan() {
    const input = document.getElementById('chatInput');
    input.value = "Give me a study plan";
    sendMessage();
  }
`;
html = html.substring(0, scriptEndIdx) + genFunc + html.substring(scriptEndIdx);
console.log('Added generateStudyPlan.');

fs.writeFileSync('index.html', html);
