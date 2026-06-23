const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:\\ai-result-agent\\.env' });

async function test() {
  const studentId = 'stu_001';
  
  const res = await fetch(`http://127.0.0.1:5000/api/result-agent/overall-summary?studentId=${studentId}`);
  const data = await res.json();
  
  console.log("Total exams:", data.totalExamsAttended);
  console.log("Exam summaries length:", data.examSummaries?.length);
  console.log("Dashboard comparison:", data.dashboardComparison);
  
  process.exit(0);
}
test();
