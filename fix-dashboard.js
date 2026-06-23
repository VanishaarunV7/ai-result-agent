const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const startStr = "    // Update Course Comparison UI";
const endStr = "} else {\n      ccCourseName.textContent = '';\n      ccContent.innerHTML = `<div style=\"color: var(--muted); font-size: 13px;\">Not enough exam history for comparison.</div>`;\n    }";

const startIdx = html.indexOf(startStr);
const endIdx = html.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  // Add length of endStr and following newline/brace if needed
  html = html.substring(0, startIdx) + html.substring(endIdx + endStr.length);
  fs.writeFileSync('index.html', html);
  console.log("Fixed dashboard JS logic by removing ccCourseName assignments.");
} else {
  console.log("Could not find the target string.");
}
