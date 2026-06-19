const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// ─── Schemas (inline for seed script) ────────────────────────────────────────

const Course = mongoose.models.Course || mongoose.model('Course', new mongoose.Schema({ _id: String, courseId: String, name: String }));
const Student = mongoose.models.Student || mongoose.model('Student', new mongoose.Schema({ _id: String, academicNo: String, name: String }));
const Exam = mongoose.models.Exam || mongoose.model('Exam', new mongoose.Schema({ _id: String, examId: String, courseId: String, courseName: String, examName: String, examDate: String, totalQuestions: Number, totalMarks: Number, status: String }));
const Topic = mongoose.models.Topic || mongoose.model('Topic', new mongoose.Schema({ _id: String, name: String }));
const Outcome = mongoose.models.Outcome || mongoose.model('Outcome', new mongoose.Schema({ _id: String, code: String, name: String }));
const ExamQuestion = mongoose.models.ExamQuestion || mongoose.model('ExamQuestion', new mongoose.Schema({
  _id: String, examId: String, examName: String, questionNo: Number,
  questionText: String, maxMarks: Number,
  topic: { _id: String, name: String },
  outcomes: [{ _id: String, code: String, name: String }]
}));
const StudentExamAttempt = mongoose.models.StudentExamAttempt || mongoose.model('StudentExamAttempt', new mongoose.Schema({
  _id: String, examId: String, examName: String, studentId: String,
  academicNo: String, status: String, totalMarks: Number,
  marksScored: Number, percentage: Number, submittedAt: String
}));
const StudentAnswer = mongoose.models.StudentAnswer || mongoose.model('StudentAnswer', new mongoose.Schema({
  _id: String, examId: String, examName: String, attemptId: String,
  studentId: String, academicNo: String, questionId: String, questionNo: Number,
  topic: { _id: String, name: String },
  outcomes: [{ _id: String, code: String, name: String }],
  maxMarks: Number, marksScored: Number, isCorrect: Boolean
}));

// ─── Master Data ──────────────────────────────────────────────────────────────

const courses = [
  { _id: 'course_001', courseId: 'C_PHY', name: 'Physics' },
  { _id: 'course_002', courseId: 'C_ENG', name: 'English' },
  { _id: 'course_003', courseId: 'C_MAT', name: 'Mathematics' },
  { _id: 'course_004', courseId: 'C_TAM', name: 'Tamil' },
  { _id: 'course_005', courseId: 'C_CHE', name: 'Chemistry' }
];

const students = [
  { _id: 'stu_001', academicNo: 'ACD001', name: 'Arun Kumar' },
  { _id: 'stu_002', academicNo: 'ACD002', name: 'Priya Sharma' },
  { _id: 'stu_003', academicNo: 'ACD003', name: 'Rahul Mehta' },
  { _id: 'stu_004', academicNo: 'ACD004', name: 'Sneha Iyer' },
  { _id: 'stu_005', academicNo: 'ACD005', name: 'Karthik Raj' },
  { _id: 'stu_006', academicNo: 'ACD006', name: 'Divya Nair' },
  { _id: 'stu_007', academicNo: 'ACD007', name: 'Vikram Singh' },
  { _id: 'stu_008', academicNo: 'ACD008', name: 'Ananya Pillai' },
  { _id: 'stu_009', academicNo: 'ACD009', name: 'Arjun Das' },
  { _id: 'stu_010', academicNo: 'ACD010', name: 'Meera Krishnan' },
];

// English, Chemistry, Mathematics should have exams initially
// Tamil and Physics should have no exams
const exams = [
  { _id: 'exam_001', examId: 'exam_001', courseId: 'course_002', courseName: 'English', examName: 'English Internal Test 1', examDate: '2026-06-13', totalQuestions: 10, totalMarks: 100, status: 'COMPLETED' },
  { _id: 'exam_002', examId: 'exam_002', courseId: 'course_005', courseName: 'Chemistry', examName: 'Chemistry Internal Test 1', examDate: '2026-06-15', totalQuestions: 10, totalMarks: 100, status: 'COMPLETED' },
  { _id: 'exam_003', examId: 'exam_003', courseId: 'course_003', courseName: 'Mathematics', examName: 'Mathematics Internal Test 1', examDate: '2026-06-18', totalQuestions: 10, totalMarks: 100, status: 'COMPLETED' },
];

const topics = [
  { _id: 'topic_001', name: 'Journal Entries' },
  { _id: 'topic_002', name: 'Ledger Posting' },
  { _id: 'topic_003', name: 'Trial Balance' },
  { _id: 'topic_004', name: 'Final Accounts' },
];

const outcomes = [
  { _id: 'outcome_001', code: 'CO1', name: 'Understand Concepts' },
  { _id: 'outcome_002', code: 'CO2', name: 'Apply Rules' },
  { _id: 'outcome_003', code: 'CO3', name: 'Analyze Transactions' },
  { _id: 'outcome_004', code: 'CO4', name: 'Prepare Statements' },
];

// ─── Exam 1 Questions (English) ─────────────────────────────────────────
const exam1Questions = [
  { _id: 'q_e1_01', examId: 'exam_001', examName: 'English Internal Test 1', questionNo: 1,  questionText: 'What is a journal entry?',                        maxMarks: 10, topic: { _id: 'topic_001', name: 'Journal Entries' }, outcomes: [{ _id: 'outcome_001', code: 'CO1', name: 'Understand Concepts' }] },
  { _id: 'q_e1_02', examId: 'exam_001', examName: 'English Internal Test 1', questionNo: 2,  questionText: 'Record a purchase transaction in journal.',         maxMarks: 10, topic: { _id: 'topic_001', name: 'Journal Entries' }, outcomes: [{ _id: 'outcome_002', code: 'CO2', name: 'Apply Rules' }] },
  { _id: 'q_e1_03', examId: 'exam_001', examName: 'English Internal Test 1', questionNo: 3,  questionText: 'Post a journal entry to the ledger.',              maxMarks: 10, topic: { _id: 'topic_002', name: 'Ledger Posting' },  outcomes: [{ _id: 'outcome_002', code: 'CO2', name: 'Apply Rules' }] },
  { _id: 'q_e1_04', examId: 'exam_001', examName: 'English Internal Test 1', questionNo: 4,  questionText: 'Analyze debit and credit in ledger accounts.',     maxMarks: 10, topic: { _id: 'topic_002', name: 'Ledger Posting' },  outcomes: [{ _id: 'outcome_003', code: 'CO3', name: 'Analyze Transactions' }] },
  { _id: 'q_e1_05', examId: 'exam_001', examName: 'English Internal Test 1', questionNo: 5,  questionText: 'What is the purpose of a trial balance?',         maxMarks: 10, topic: { _id: 'topic_003', name: 'Trial Balance' },   outcomes: [{ _id: 'outcome_001', code: 'CO1', name: 'Understand Concepts' }] },
  { _id: 'q_e1_06', examId: 'exam_001', examName: 'English Internal Test 1', questionNo: 6,  questionText: 'Identify errors from a given trial balance.',      maxMarks: 10, topic: { _id: 'topic_003', name: 'Trial Balance' },   outcomes: [{ _id: 'outcome_003', code: 'CO3', name: 'Analyze Transactions' }] },
  { _id: 'q_e1_07', examId: 'exam_001', examName: 'English Internal Test 1', questionNo: 7,  questionText: 'What are the components of final accounts?',      maxMarks: 10, topic: { _id: 'topic_004', name: 'Final Accounts' },  outcomes: [{ _id: 'outcome_001', code: 'CO1', name: 'Understand Concepts' }] },
  { _id: 'q_e1_08', examId: 'exam_001', examName: 'English Internal Test 1', questionNo: 8,  questionText: 'Prepare a profit and loss account.',               maxMarks: 10, topic: { _id: 'topic_004', name: 'Final Accounts' },  outcomes: [{ _id: 'outcome_004', code: 'CO4', name: 'Prepare Statements' }] },
  { _id: 'q_e1_09', examId: 'exam_001', examName: 'English Internal Test 1', questionNo: 9,  questionText: 'Analyze items to be placed in trial balance.',    maxMarks: 10, topic: { _id: 'topic_003', name: 'Trial Balance' },   outcomes: [{ _id: 'outcome_003', code: 'CO3', name: 'Analyze Transactions' }] },
  { _id: 'q_e1_10', examId: 'exam_001', examName: 'English Internal Test 1', questionNo: 10, questionText: 'Prepare a balance sheet from given information.', maxMarks: 10, topic: { _id: 'topic_004', name: 'Final Accounts' },  outcomes: [{ _id: 'outcome_004', code: 'CO4', name: 'Prepare Statements' }] },
];

// ─── Exam 2 Questions (Chemistry) ─────────────────────────────────────────
const exam2Questions = [
  { _id: 'q_e2_01', examId: 'exam_002', examName: 'Chemistry Internal Test 1', questionNo: 1,  questionText: 'Explain the double entry system.',                maxMarks: 10, topic: { _id: 'topic_001', name: 'Journal Entries' }, outcomes: [{ _id: 'outcome_001', code: 'CO1', name: 'Understand Concepts' }] },
  { _id: 'q_e2_02', examId: 'exam_002', examName: 'Chemistry Internal Test 1', questionNo: 2,  questionText: 'Journalize a sales return transaction.',           maxMarks: 10, topic: { _id: 'topic_001', name: 'Journal Entries' }, outcomes: [{ _id: 'outcome_002', code: 'CO2', name: 'Apply Rules' }] },
  { _id: 'q_e2_03', examId: 'exam_002', examName: 'Chemistry Internal Test 1', questionNo: 3,  questionText: 'Create ledger accounts from journal entries.',     maxMarks: 10, topic: { _id: 'topic_002', name: 'Ledger Posting' },  outcomes: [{ _id: 'outcome_002', code: 'CO2', name: 'Apply Rules' }] },
  { _id: 'q_e2_04', examId: 'exam_002', examName: 'Chemistry Internal Test 1', questionNo: 4,  questionText: 'Analyze closing balances of ledger accounts.',    maxMarks: 10, topic: { _id: 'topic_002', name: 'Ledger Posting' },  outcomes: [{ _id: 'outcome_003', code: 'CO3', name: 'Analyze Transactions' }] },
  { _id: 'q_e2_05', examId: 'exam_002', examName: 'Chemistry Internal Test 1', questionNo: 5,  questionText: 'State the rules for preparing a trial balance.',   maxMarks: 10, topic: { _id: 'topic_003', name: 'Trial Balance' },   outcomes: [{ _id: 'outcome_001', code: 'CO1', name: 'Understand Concepts' }] },
  { _id: 'q_e2_06', examId: 'exam_002', examName: 'Chemistry Internal Test 1', questionNo: 6,  questionText: 'Detect discrepancy in a trial balance.',           maxMarks: 10, topic: { _id: 'topic_003', name: 'Trial Balance' },   outcomes: [{ _id: 'outcome_003', code: 'CO3', name: 'Analyze Transactions' }] },
  { _id: 'q_e2_07', examId: 'exam_002', examName: 'Chemistry Internal Test 1', questionNo: 7,  questionText: 'What is a trading account?',                      maxMarks: 10, topic: { _id: 'topic_004', name: 'Final Accounts' },  outcomes: [{ _id: 'outcome_001', code: 'CO1', name: 'Understand Concepts' }] },
  { _id: 'q_e2_08', examId: 'exam_002', examName: 'Chemistry Internal Test 1', questionNo: 8,  questionText: 'Prepare a trading account from given data.',       maxMarks: 10, topic: { _id: 'topic_004', name: 'Final Accounts' },  outcomes: [{ _id: 'outcome_004', code: 'CO4', name: 'Prepare Statements' }] },
  { _id: 'q_e2_09', examId: 'exam_002', examName: 'Chemistry Internal Test 1', questionNo: 9,  questionText: 'Classify items into debit and credit columns.',   maxMarks: 10, topic: { _id: 'topic_003', name: 'Trial Balance' },   outcomes: [{ _id: 'outcome_003', code: 'CO3', name: 'Analyze Transactions' }] },
  { _id: 'q_e2_10', examId: 'exam_002', examName: 'Chemistry Internal Test 1', questionNo: 10, questionText: 'Prepare final accounts with adjustments.',         maxMarks: 10, topic: { _id: 'topic_004', name: 'Final Accounts' },  outcomes: [{ _id: 'outcome_004', code: 'CO4', name: 'Prepare Statements' }] },
];

// ─── Exam 3 Questions (Mathematics) ─────────────────────────────────────────
const exam3Questions = [
  { _id: 'q_e3_01', examId: 'exam_003', examName: 'Mathematics Internal Test 1', questionNo: 1,  questionText: 'What is a journal entry?',                        maxMarks: 10, topic: { _id: 'topic_001', name: 'Journal Entries' }, outcomes: [{ _id: 'outcome_001', code: 'CO1', name: 'Understand Concepts' }] },
  { _id: 'q_e3_02', examId: 'exam_003', examName: 'Mathematics Internal Test 1', questionNo: 2,  questionText: 'Record a purchase transaction in journal.',         maxMarks: 10, topic: { _id: 'topic_001', name: 'Journal Entries' }, outcomes: [{ _id: 'outcome_002', code: 'CO2', name: 'Apply Rules' }] },
  { _id: 'q_e3_03', examId: 'exam_003', examName: 'Mathematics Internal Test 1', questionNo: 3,  questionText: 'Post a journal entry to the ledger.',              maxMarks: 10, topic: { _id: 'topic_002', name: 'Ledger Posting' },  outcomes: [{ _id: 'outcome_002', code: 'CO2', name: 'Apply Rules' }] },
  { _id: 'q_e3_04', examId: 'exam_003', examName: 'Mathematics Internal Test 1', questionNo: 4,  questionText: 'Analyze debit and credit in ledger accounts.',     maxMarks: 10, topic: { _id: 'topic_002', name: 'Ledger Posting' },  outcomes: [{ _id: 'outcome_003', code: 'CO3', name: 'Analyze Transactions' }] },
  { _id: 'q_e3_05', examId: 'exam_003', examName: 'Mathematics Internal Test 1', questionNo: 5,  questionText: 'What is the purpose of a trial balance?',         maxMarks: 10, topic: { _id: 'topic_003', name: 'Trial Balance' },   outcomes: [{ _id: 'outcome_001', code: 'CO1', name: 'Understand Concepts' }] },
  { _id: 'q_e3_06', examId: 'exam_003', examName: 'Mathematics Internal Test 1', questionNo: 6,  questionText: 'Identify errors from a given trial balance.',      maxMarks: 10, topic: { _id: 'topic_003', name: 'Trial Balance' },   outcomes: [{ _id: 'outcome_003', code: 'CO3', name: 'Analyze Transactions' }] },
  { _id: 'q_e3_07', examId: 'exam_003', examName: 'Mathematics Internal Test 1', questionNo: 7,  questionText: 'What are the components of final accounts?',      maxMarks: 10, topic: { _id: 'topic_004', name: 'Final Accounts' },  outcomes: [{ _id: 'outcome_001', code: 'CO1', name: 'Understand Concepts' }] },
  { _id: 'q_e3_08', examId: 'exam_003', examName: 'Mathematics Internal Test 1', questionNo: 8,  questionText: 'Prepare a profit and loss account.',               maxMarks: 10, topic: { _id: 'topic_004', name: 'Final Accounts' },  outcomes: [{ _id: 'outcome_004', code: 'CO4', name: 'Prepare Statements' }] },
  { _id: 'q_e3_09', examId: 'exam_003', examName: 'Mathematics Internal Test 1', questionNo: 9,  questionText: 'Analyze items to be placed in trial balance.',    maxMarks: 10, topic: { _id: 'topic_003', name: 'Trial Balance' },   outcomes: [{ _id: 'outcome_003', code: 'CO3', name: 'Analyze Transactions' }] },
  { _id: 'q_e3_10', examId: 'exam_003', examName: 'Mathematics Internal Test 1', questionNo: 10, questionText: 'Prepare a balance sheet from given information.', maxMarks: 10, topic: { _id: 'topic_004', name: 'Final Accounts' },  outcomes: [{ _id: 'outcome_004', code: 'CO4', name: 'Prepare Statements' }] },
];

const exam1Marks = [
  [       8,  5,  4,  3,  7,  5,  6,  4,  6,  6 ], // stu_001 → 54
  [       9,  8,  7,  6,  9,  8,  7,  6,  8,  7 ], // stu_002 → 75
  [       3,  2,  2,  1,  4,  3,  2,  1,  3,  2 ], // stu_003 → 23
  [       6,  6,  5,  5,  7,  6,  6,  5,  6,  6 ], // stu_004 → 58
  [      10,  9,  8,  8, 10,  9,  9,  8,  9,  8 ], // stu_005 → 88
  [       5,  4,  3,  3,  6,  4,  5,  3,  5,  4 ], // stu_006 → 42
  [       7,  7,  6,  5,  8,  7,  7,  6,  7,  6 ], // stu_007 → 66
  [       4,  3,  3,  2,  5,  4,  4,  3,  4,  3 ], // stu_008 → 35
  [       8,  7,  6,  6,  8,  7,  8,  6,  7,  7 ], // stu_009 → 70
  [       6,  5,  5,  4,  7,  5,  6,  5,  6,  5 ], // stu_010 → 54
];

const exam2Marks = [
  [       7,  6,  5,  5,  8,  6,  7,  5,  7,  6 ], // stu_001 → 62
  [      10,  9,  8,  7, 10,  9,  8,  7,  9,  8 ], // stu_002 → 85
  [       4,  3,  3,  2,  5,  3,  3,  2,  4,  3 ], // stu_003 → 32
  [       7,  6,  6,  5,  8,  6,  7,  5,  7,  6 ], // stu_004 → 63
  [       9,  8,  8,  7,  9,  8,  8,  7,  8,  7 ], // stu_005 → 79
  [       6,  5,  4,  4,  7,  5,  6,  4,  6,  5 ], // stu_006 → 52
  [       8,  7,  7,  6,  8,  7,  8,  6,  7,  7 ], // stu_007 → 71
  [       5,  4,  4,  3,  6,  4,  5,  3,  5,  4 ], // stu_008 → 43
  [       9,  8,  7,  7,  9,  8,  9,  7,  8,  8 ], // stu_009 → 80
  [       7,  6,  6,  5,  8,  6,  7,  5,  7,  6 ], // stu_010 → 63
];

const exam3Marks = [
  [       8,  7,  6,  6,  9,  7,  8,  6,  8,  7 ], // stu_001
  [      10, 10,  9,  8, 10, 10,  9,  8, 10,  9 ], // stu_002
  [       5,  4,  4,  3,  6,  4,  4,  3,  5,  4 ], // stu_003
  [       8,  7,  7,  6,  9,  7,  8,  6,  8,  7 ], // stu_004
  [      10,  9,  9,  8, 10,  9,  9,  8,  9,  8 ], // stu_005
  [       7,  6,  5,  5,  8,  6,  7,  5,  7,  6 ], // stu_006
  [       9,  8,  8,  7,  9,  8,  9,  7,  8,  8 ], // stu_007
  [       6,  5,  5,  4,  7,  5,  6,  4,  6,  5 ], // stu_008
  [      10,  9,  8,  8, 10,  9, 10,  8,  9,  9 ], // stu_009
  [       8,  7,  7,  6,  9,  7,  8,  6,  8,  7 ], // stu_010
];

function buildAttempts() {
  const attempts = [];
  students.forEach((stu, si) => {
    [
      { exam: exams[0], marks: exam1Marks[si], date: '2026-06-13T10:10:00.000Z' },
      { exam: exams[1], marks: exam2Marks[si], date: '2026-06-15T10:10:00.000Z' },
      { exam: exams[2], marks: exam3Marks[si], date: '2026-06-18T10:10:00.000Z' },
    ].forEach(({ exam, marks, date }, ei) => {
      const total = marks.reduce((a, b) => a + b, 0);
      attempts.push({
        _id: `attempt_${String(si + 1).padStart(3, '0')}_e${ei + 1}`,
        examId: exam._id,
        examName: exam.examName,
        studentId: stu._id,
        academicNo: stu.academicNo,
        status: 'SUBMITTED',
        totalMarks: 100,
        marksScored: total,
        percentage: total,
        submittedAt: date,
      });
    });
  });
  return attempts;
}

function buildAnswers() {
  const answers = [];
  const allExamData = [
    { exam: exams[0], questions: exam1Questions, marksMatrix: exam1Marks },
    { exam: exams[1], questions: exam2Questions, marksMatrix: exam2Marks },
    { exam: exams[2], questions: exam3Questions, marksMatrix: exam3Marks },
  ];

  students.forEach((stu, si) => {
    allExamData.forEach(({ exam, questions, marksMatrix }, ei) => {
      const attemptId = `attempt_${String(si + 1).padStart(3, '0')}_e${ei + 1}`;
      questions.forEach((q, qi) => {
        const scored = marksMatrix[si][qi];
        answers.push({
          _id: `ans_e${ei + 1}_s${String(si + 1).padStart(2, '0')}_q${String(qi + 1).padStart(2, '0')}`,
          examId: exam._id,
          examName: exam.examName,
          attemptId,
          studentId: stu._id,
          academicNo: stu.academicNo,
          questionId: q._id,
          questionNo: q.questionNo,
          topic: q.topic,
          outcomes: q.outcomes,
          maxMarks: q.maxMarks,
          marksScored: scored,
          isCorrect: scored >= 5,
        });
      });
    });
  });
  return answers;
}

async function seedDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // Clear all collections
    await Promise.all([
      Course.deleteMany({}),
      Student.deleteMany({}),
      Exam.deleteMany({}),
      Topic.deleteMany({}),
      Outcome.deleteMany({}),
      ExamQuestion.deleteMany({}),
      StudentExamAttempt.deleteMany({}),
      StudentAnswer.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // Insert master data
    await Course.insertMany(courses);
    console.log(`✅ Inserted ${courses.length} courses`);

    await Student.insertMany(students);
    console.log(`✅ Inserted ${students.length} students`);

    await Exam.insertMany(exams);
    console.log(`✅ Inserted ${exams.length} exams`);

    await Topic.insertMany(topics);
    console.log(`✅ Inserted ${topics.length} topics`);

    await Outcome.insertMany(outcomes);
    console.log(`✅ Inserted ${outcomes.length} outcomes`);

    await ExamQuestion.insertMany([...exam1Questions, ...exam2Questions, ...exam3Questions]);
    console.log(`✅ Inserted ${exam1Questions.length + exam2Questions.length + exam3Questions.length} exam questions`);

    const attempts = buildAttempts();
    await StudentExamAttempt.insertMany(attempts);
    console.log(`✅ Inserted ${attempts.length} student exam attempts`);

    const answers = buildAnswers();
    await StudentAnswer.insertMany(answers);
    console.log(`✅ Inserted ${answers.length} student answers`);

    console.log('\n🎉 Seed complete! Summary:');
    console.log(`   Courses        : ${courses.length}`);
    console.log(`   Students       : ${students.length}`);
    console.log(`   Exams          : ${exams.length}`);
    console.log(`   Topics         : ${topics.length}`);
    console.log(`   Outcomes       : ${outcomes.length}`);
    console.log(`   Exam Questions : ${exam1Questions.length + exam2Questions.length + exam3Questions.length}`);
    console.log(`   Attempts       : ${attempts.length}`);
    console.log(`   Answers        : ${answers.length}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected. Ready to build APIs!');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seedDB();
