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
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const examsCol = db.collection('exams');
    const attemptsCol = db.collection('studentexamattempts');
    const studentsCol = db.collection('students');

    const students = await studentsCol.find({}).toArray();
    console.log(`Found ${students.length} students.`);

    for (const course of coursesToSeed) {
      console.log(`Seeding data for ${course}...`);

      const examBaseId = course.toLowerCase().replace(/[^a-z0-9]/g, '_');

      for (let i = 1; i <= 3; i++) {
        const examName = `${course} Internal Test ${i}`;
        const examId = `${examBaseId}_it${i}`;

        // Upsert Exam
        await examsCol.updateOne(
          { examId: examId },
          {
            $set: {
              _id: examId,
              courseName: course,
              examName: examName,
              totalQuestions: 10,
              totalMarks: 100,
              status: 'COMPLETED',
              examDate: new Date(2026, 5, i * 5).toISOString() // space out by 5 days
            }
          },
          { upsert: true }
        );

        // For each student, insert an attempt if it doesn't exist
        for (const student of students) {
          const attemptId = `attempt_${student._id}_${examId}`;
          const existingAttempt = await attemptsCol.findOne({ _id: attemptId });

          if (!existingAttempt) {
            const score = randomScore();
            await attemptsCol.insertOne({
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

    console.log("Seeding complete.");

  } catch (err) {
    console.error("Error during seeding:", err);
  } finally {
    await client.close();
  }
}

run();
