const mongoose = require('mongoose');

// Helper to get level based on percentage
function getLevel(pct) {
  if (pct <= 40) return 'Critical';
  if (pct <= 60) return 'Weak';
  if (pct <= 75) return 'Average';
  return 'Good';
}

// Performance calculation helper matching resultAgentController
function calculatePerformance(answers) {
  const topicMap = {};
  const outcomeMap = {};
  answers.forEach(ans => {
    const t = ans.topic?.name;
    if (!t) return;
    if (!topicMap[t]) topicMap[t] = { scored: 0, max: 0 };
    topicMap[t].scored += ans.marksScored;
    topicMap[t].max += ans.maxMarks;
    (ans.outcomes || []).forEach(oc => {
      const key = `${oc.code} - ${oc.name}`;
      if (!outcomeMap[key]) outcomeMap[key] = { scored: 0, max: 0 };
      outcomeMap[key].scored += ans.marksScored;
      outcomeMap[key].max += ans.maxMarks;
    });
  });
  const topicResults = Object.entries(topicMap).map(([name, val]) => {
    const pct = Math.round((val.scored / val.max) * 10000) / 100;
    return { topic: name, scored: val.scored, max: val.max, percentage: pct, level: getLevel(pct) };
  }).sort((a, b) => a.percentage - b.percentage);
  const outcomeResults = Object.entries(outcomeMap).map(([name, val]) => {
    const pct = Math.round((val.scored / val.max) * 10000) / 100;
    return { outcome: name, scored: val.scored, max: val.max, percentage: pct, level: getLevel(pct) };
  }).sort((a, b) => a.percentage - b.percentage);
  return { topicResults, outcomeResults };
}

// Helper to resolve student by ID (checking both _id and studentId)
async function findStudent(studentId) {
  const col = mongoose.connection.db.collection('students');
  let student = await col.findOne({ _id: studentId });
  if (!student) {
    student = await col.findOne({ student_id: studentId });
  }
  return student;
}

// Helper to resolve program for a student
async function getStudentProgram(studentId) {
  const student = await findStudent(studentId);
  if (!student || !student.program_id) return null;
  const col = mongoose.connection.db.collection('programs');
  return await col.findOne({ program_id: student.program_id });
}

// GET /students/:student_id/program
exports.getProgram = async (req, res) => {
  try {
    const { student_id } = req.params;
    const program = await getStudentProgram(student_id);
    if (!program) {
      return res.status(404).json({ error: 'No academic program assigned' });
    }
    res.json({
      program_id: program.program_id,
      program_name: program.program_name
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /students/:student_id/courses
exports.getCourses = async (req, res) => {
  try {
    const { student_id } = req.params;
    const program = await getStudentProgram(student_id);
    if (!program) {
      return res.status(404).json({ error: 'No academic program assigned' });
    }
    res.json({
      program_name: program.program_name,
      courses: program.courses || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /students/:student_id/assigned-courses
exports.getAssignedCourses = async (req, res) => {
  try {
    const { student_id } = req.params;
    const program = await getStudentProgram(student_id);
    if (!program) return res.json([]);

    const courseNames = program.courses || [];
    const coursesCol = mongoose.connection.db.collection('courses');
    const dbCourses = await coursesCol.find({ program_id: program.program_id }).toArray();
    const courseMap = {};
    dbCourses.forEach(c => {
      courseMap[c.course_name] = c;
    });

    const orderedCourses = courseNames.map(name => {
      if (courseMap[name]) {
        return {
          course_id: courseMap[name].course_id,
          course_name: courseMap[name].course_name,
          department: courseMap[name].department || ''
        };
      } else {
        return {
          course_id: name,
          course_name: name,
          department: program.program_name
        };
      }
    });

    res.json(orderedCourses);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /students/:student_id/exam-schedule
exports.getExamSchedule = async (req, res) => {
  try {
    const { student_id } = req.params;
    const program = await getStudentProgram(student_id);
    if (!program || !program.courses) return res.json([]);

    const programCourseNames = program.courses;
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const scheduleCol = mongoose.connection.db.collection('exam_schedule');
    const exams = await scheduleCol.find({
      student_id,
      exam_date: { $gte: todayStr },
      course: { $in: programCourseNames }
    }).sort({ exam_date: 1 }).toArray();

    res.json(exams.map(e => ({ ...e, _id: e._id.toString() })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /students/:student_id/next-exam
exports.getNextExam = async (req, res) => {
  try {
    const { student_id } = req.params;
    const program = await getStudentProgram(student_id);
    if (!program || !program.courses) return res.json({});

    const programCourseNames = program.courses;
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const scheduleCol = mongoose.connection.db.collection('exam_schedule');
    const exams = await scheduleCol.find({
      student_id,
      exam_date: { $gte: todayStr },
      course: { $in: programCourseNames }
    }).sort({ exam_date: 1 }).limit(1).toArray();

    if (!exams.length) return res.json({});
    res.json({ ...exams[0], _id: exams[0]._id.toString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /students/:student_id/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const { student_id } = req.params;
    const student = await findStudent(student_id);
    const program = await getStudentProgram(student_id);

    const studentInfo = {
      student_id,
      name: student ? student.name : student_id,
      academic_no: student ? student.academicNo : ''
    };

    const programInfo = program ? {
      program_id: program.program_id,
      program_name: program.program_name
    } : null;

    const courses = program ? (program.courses || []) : [];

    // Fetch attempts
    const attemptsCol = mongoose.connection.db.collection('studentexamattempts');
    const attempts = await attemptsCol.find({ studentId: student_id, status: 'SUBMITTED' }).toArray();

    // Fetch student answers
    const answersCol = mongoose.connection.db.collection('studentanswers');
    const answers = await answersCol.find({ studentId: student_id }).toArray();

    // Filter by program courses if assigned
    let filteredAttempts = attempts;
    let filteredAnswers = answers;

    if (program && courses.length > 0) {
      const lowerCourses = courses.map(c => c.toLowerCase());
      
      // Fetch all exams to map examId to courseName
      const examsCol = mongoose.connection.db.collection('exams');
      const allExams = await examsCol.find({}).toArray();
      const examIdToCourse = {};
      allExams.forEach(ex => {
        examIdToCourse[ex._id] = ex.courseName || '';
        examIdToCourse[ex.examId] = ex.courseName || '';
      });

      const isAllowed = (examId, examName) => {
        const courseName = (examIdToCourse[examId] || '').toLowerCase();
        const examNameLower = (examName || '').toLowerCase();
        return lowerCourses.some(c => courseName === c || examNameLower.includes(c));
      };

      filteredAttempts = attempts.filter(a => isAllowed(a.examId, a.examName));
      filteredAnswers = answers.filter(ans => isAllowed(ans.examId, ans.examName));
    }

    const perf = filteredAnswers.length ? calculatePerformance(filteredAnswers) : { topicResults: [], outcomeResults: [] };

    const examSummaries = filteredAttempts.map(a => ({
      examId: a.examId,
      examName: a.examName,
      marksScored: a.marksScored,
      totalMarks: a.totalMarks,
      percentage: a.percentage,
      submittedAt: a.submittedAt
    }));

    // Sort exam summaries chronologically for overall percentage
    const sortedSummaries = [...examSummaries].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const overallPercentage = sortedSummaries.length ? sortedSummaries[sortedSummaries.length - 1].percentage : null;

    // Upcoming exams
    const todayStr = new Date().toISOString().slice(0, 10);
    const scheduleCol = mongoose.connection.db.collection('exam_schedule');
    let upcomingExams = [];
    if (program && courses.length > 0) {
      const scheduleDocs = await scheduleCol.find({
        student_id,
        exam_date: { $gte: todayStr },
        course: { $in: courses }
      }).sort({ exam_date: 1 }).toArray();
      upcomingExams = scheduleDocs.map(e => ({ ...e, _id: e._id.toString() }));
    }

    const analytics = {
      totalExamsAttended: examSummaries.length,
      topicResults: perf.topicResults,
      outcomeResults: perf.outcomeResults,
      overallPercentage
    };

    res.json({
      student: studentInfo,
      program: programInfo,
      courses,
      exam_summaries: examSummaries,
      upcoming_exams: upcomingExams,
      analytics
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
