const fs = require('fs');
let code = fs.readFileSync('controllers/resultAgentController.js', 'utf8');

const searchLogic = `
  let targetCourse = null;
  let targetExams = [];
  if (courseName) {
    if (courseGroups[courseName]) {
      targetCourse = courseName;
      
      // Deduplicate by examName
      const uniqueExamsMap = new Map();
      courseGroups[courseName].forEach(e => {
        uniqueExamsMap.set(e.examName, e);
      });
      targetExams = Array.from(uniqueExamsMap.values());
    }
  } else {
    for (let i = sortedAttempts.length - 1; i >= 0; i--) {
      const course = examIdToCourse[sortedAttempts[i].examId] || 'Unknown';
      if (courseGroups[course].length >= 1) {
        targetCourse = course;
        
        // Deduplicate by examName
        const uniqueExamsMap = new Map();
        courseGroups[course].forEach(e => {
          uniqueExamsMap.set(e.examName, e);
        });
        targetExams = Array.from(uniqueExamsMap.values());
        break;
      }
    }
  }
`;

const oldLogicStart = code.indexOf('  let targetCourse = null;');
const oldLogicEnd = code.indexOf('  if (!targetCourse || targetExams.length === 0) {');

if (oldLogicStart !== -1 && oldLogicEnd !== -1) {
  code = code.substring(0, oldLogicStart) + searchLogic + code.substring(oldLogicEnd);
  fs.writeFileSync('controllers/resultAgentController.js', code);
  console.log('Backend deduplication applied.');
} else {
  console.log('Could not find logic blocks');
}
