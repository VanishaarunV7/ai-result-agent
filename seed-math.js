const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const StudentAnswer = require('./models/studentAnswer');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const attemptsCol = mongoose.connection.db.collection('studentexamattempts');
    const examsCol = mongoose.connection.db.collection('exams');

    const attempts = await attemptsCol.find({ studentId: 'stu_001' }).toArray();
    console.log(`Found ${attempts.length} attempts for stu_001`);

    let mathAttempt = null;
    let mathExamId = null;

    for (let att of attempts) {
      const ex = await examsCol.findOne({ $or: [{ _id: att.examId }, { examId: att.examId }] });
      if (ex && ex.courseName === 'Mathematics') {
        mathAttempt = att;
        mathExamId = ex.examId || ex._id;
        break;
      }
    }

    if (!mathAttempt) {
      console.log('No Mathematics attempt found for stu_001. Using any attempt to duplicate as Math...');
      mathAttempt = attempts[0];
    } else {
      console.log(`Found Math attempt: ${mathAttempt.examName} (${mathAttempt.examId})`);
    }

    const newExams = [
      { id: 'math_mock_02', name: 'Mathematics Internal Test 2', pct: 62 },
      { id: 'math_mock_03', name: 'Mathematics Internal Test 3', pct: 70 }
    ];

    for (let i = 0; i < newExams.length; i++) {
      const mockExam = newExams[i];
      
      // Check if already exists
      const existing = await attemptsCol.findOne({ studentId: 'stu_001', examId: mockExam.id });
      if (existing) {
        console.log(`Mock attempt ${mockExam.id} already exists. Skipping.`);
        continue;
      }

      // Insert exam
      await examsCol.insertOne({
        examId: mockExam.id,
        courseName: 'Mathematics',
        examName: mockExam.name,
        type: 'INTERNAL'
      });

      // Calculate total scored based on max marks and requested percentage
      const totalMarks = mathAttempt.totalMarks;
      const targetScored = Math.round((mockExam.pct / 100) * totalMarks);

      // Insert attempt
      await attemptsCol.insertOne({
        studentId: 'stu_001',
        examId: mockExam.id,
        examName: mockExam.name,
        status: 'SUBMITTED',
        submittedAt: new Date(Date.now() + (i + 1) * 86400000), // Add days
        totalMarks: totalMarks,
        marksScored: targetScored,
        percentage: mockExam.pct,
        studentName: mathAttempt.studentName,
        courseName: 'Mathematics'
      });

      // Duplicate answers
      const answers = await StudentAnswer.find({ studentId: 'stu_001', examId: mathAttempt.examId }).lean();
      for (let ans of answers) {
        delete ans._id;
        ans.examId = mockExam.id;
        
        // Adjust marks slightly to fit percentage trend
        let max = ans.maxMarks;
        let p = mockExam.pct / 100;
        // add some random noise
        p += (Math.random() * 0.1) - 0.05;
        if (p < 0) p = 0;
        if (p > 1) p = 1;
        
        ans.marksScored = Math.round(max * p);
        await new StudentAnswer(ans).save();
      }
      console.log(`Created mock exam & attempt & answers for ${mockExam.name}`);
    }

    console.log('Seeding completed!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit();
  }
}

seed();
