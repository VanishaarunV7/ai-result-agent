require('dotenv').config();
const { MongoClient } = require('mongodb');

const coursesToSeed = [
  "Mathematics",
  "DBMS",
  "Python Programming",
  "Data Structures",
  "Computer Networks"
];

function randomScore() {
  return Math.floor(Math.random() * (95 - 50 + 1)) + 50;
}

async function run() {
  const client = new MongoClient(process.env.MONGO_URI, { maxPoolSize: 50 });
  try {
    await client.connect();
    const db = client.db();
    const examsCol = db.collection('exams');
    const attemptsCol = db.collection('studentexamattempts');
    const studentsCol = db.collection('students');

    const students = await studentsCol.find({}).toArray();
    console.log(`Found ${students.length} students.`);

    const newExams = [];
    const newAttempts = [];

    // Pre-fetch existing
    const existingExams = await examsCol.find({}).toArray();
    const existingExamIds = new Set(existingExams.map(e => e._id));
    const existingAttempts = await attemptsCol.find({}).toArray();
    const existingAttemptIds = new Set(existingAttempts.map(a => a._id));

    for (const course of coursesToSeed) {
      const examBaseId = course.toLowerCase().replace(/[^a-z0-9]/g, '_');

      for (let i = 1; i <= 3; i++) {
        const examName = `${course} Internal Test ${i}`;
        const examId = `${examBaseId}_it${i}`;

        if (!existingExamIds.has(examId)) {
          newExams.push({
            _id: examId,
            examId: examId,
            courseName: course,
            examName: examName,
            totalQuestions: 10,
            totalMarks: 100,
            status: 'COMPLETED',
            examDate: new Date(2026, 5, i * 5).toISOString()
          });
        }

        for (const student of students) {
          const attemptId = `attempt_${student._id}_${examId}`;
          if (!existingAttemptIds.has(attemptId)) {
            const score = randomScore();
            newAttempts.push({
              _id: attemptId,
              examId: examId,
              examName: examName,
              studentId: student._id,
              academicNo: student.academicNo,
              status: 'SUBMITTED',
              totalMarks: 100,
              marksScored: score,
              percentage: score,
              submittedAt: new Date(2026, 5, i * 5, 10, 0, 0).toISOString()
            });
          }
        }
      }
    }

    console.log(`Inserting ${newExams.length} new exams and ${newAttempts.length} new attempts...`);

    if (newExams.length > 0) await examsCol.insertMany(newExams);
    if (newAttempts.length > 0) await attemptsCol.insertMany(newAttempts);

    console.log("Fast Seeding complete.");

  } catch (err) {
    console.error("Error during fast seeding:", err);
  } finally {
    await client.close();
  }
}

run();
