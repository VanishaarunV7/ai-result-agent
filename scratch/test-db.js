const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:\\ai-result-agent\\.env' });

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const col = mongoose.connection.db.collection('studentexamattempts');
  const attempts = await col.find({ status: 'SUBMITTED' }).toArray();
  
  const examsCol = mongoose.connection.db.collection('exams');
  const allExams = await examsCol.find({}).toArray();
  const examIdToCourse = {};
  allExams.forEach(ex => {
    examIdToCourse[ex._id] = ex.courseName || '';
    examIdToCourse[ex.examId] = ex.courseName || '';
  });
  
  const studentMap = {};
  attempts.forEach(a => {
    if (!studentMap[a.studentId]) studentMap[a.studentId] = [];
    studentMap[a.studentId].push(`${a.examName} (${examIdToCourse[a.examId]})`);
  });
  
  console.log('All attempts per student:');
  for (const [student, exams] of Object.entries(studentMap)) {
    console.log(`\nStudent ${student}:`);
    exams.forEach(e => console.log(`- ${e}`));
  }
  
  process.exit(0);
}
test();
