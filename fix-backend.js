const fs = require('fs');
let code = fs.readFileSync('controllers/resultAgentController.js', 'utf8');

code = code.replace(
  'async function generateExamComparisonData(studentId) {',
  'async function generateExamComparisonData(studentId, courseName) {'
);

const oldLogicStart = code.indexOf('  // Find latest course');
const oldLogicEnd = code.indexOf("  const sign = improvementVal > 0 ? '+' : '';");

const searchLogic = `
  let targetCourse = null;
  let targetExams = [];
  if (courseName) {
    if (courseGroups[courseName]) {
      targetCourse = courseName;
      targetExams = courseGroups[courseName];
    }
  } else {
    for (let i = sortedAttempts.length - 1; i >= 0; i--) {
      const course = examIdToCourse[sortedAttempts[i].examId] || 'Unknown';
      if (courseGroups[course].length >= 1) {
        targetCourse = course;
        targetExams = courseGroups[course];
        break;
      }
    }
  }

  if (!targetCourse || targetExams.length === 0) {
    return { error: "No exams found for the selected course." };
  }

  const firstExam = targetExams[0];
  const latestExam = targetExams[targetExams.length - 1];

  const sum = targetExams.reduce((s, e) => s + e.percentage, 0);
  const averagePercentage = Math.round((sum / targetExams.length) * 100) / 100;
  
  let highestPercentage = targetExams[0].percentage;
  let lowestPercentage = targetExams[0].percentage;
  targetExams.forEach(e => {
    if (e.percentage > highestPercentage) highestPercentage = e.percentage;
    if (e.percentage < lowestPercentage) lowestPercentage = e.percentage;
  });

  const improvementVal = targetExams.length > 1 ? latestExam.percentage - firstExam.percentage : 0;
`;

if (oldLogicStart !== -1 && oldLogicEnd !== -1) {
  code = code.substring(0, oldLogicStart) + searchLogic + code.substring(oldLogicEnd);
} else {
  console.log("Could not find logic bounds");
}

code = code.replace(
  'const { studentId } = req.query;',
  'const { studentId, courseName } = req.query;'
);
code = code.replace(
  'const data = await generateExamComparisonData(studentId);',
  'const data = await generateExamComparisonData(studentId, courseName);'
);

fs.writeFileSync('controllers/resultAgentController.js', code);
console.log('Done');
