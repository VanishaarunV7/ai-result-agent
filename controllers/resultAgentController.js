const mongoose = require('mongoose');
const StudentAnswer = require('../models/studentAnswer');
const Conversation = require('../models/conversation');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function getLevel(pct) {
  if (pct <= 40) return 'Critical';
  if (pct <= 60) return 'Weak';
  if (pct <= 75) return 'Average';
  return 'Good';
}

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

// ── Raw MongoDB fetch — bypasses Mongoose schema issues ──
async function getRawAttempts(studentId) {
  const col = mongoose.connection.db.collection('studentexamattempts');
  const docs = await col.find({ studentId, status: 'SUBMITTED' }).toArray();
  return docs;
}

exports.examSummary = async (req, res) => {
  try {
    const { studentId, examId } = req.query;
    if (!studentId || !examId) return res.status(400).json({ error: 'studentId and examId required' });
    const answers = await StudentAnswer.find({ studentId, examId });
    if (!answers.length) return res.status(404).json({ error: 'No answers found' });
    const { topicResults, outcomeResults } = calculatePerformance(answers);
    const attempts = await getRawAttempts(studentId);
    const attempt = attempts.find(a => a.examId === examId) || {};
    res.json({
      studentId, examId,
      examName: attempt.examName || answers[0].examName,
      totalMarks: attempt.totalMarks || 100,
      marksScored: attempt.marksScored || 0,
      percentage: attempt.percentage || 0,
      topicResults, outcomeResults
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.overallSummary = async (req, res) => {
  try {
    const { studentId, courseName } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    // Fetch student's program courses
    const studentsCol = mongoose.connection.db.collection('students');
    const student = await studentsCol.findOne({ _id: studentId });
    let program = null;
    if (student && student.program_id) {
      const programsCol = mongoose.connection.db.collection('programs');
      program = await programsCol.findOne({ program_id: student.program_id });
    }

    const answers = await StudentAnswer.find({ studentId });
    const attempts = await getRawAttempts(studentId);

    let filteredAnswers = answers;
    let filteredAttempts = attempts;

    const examsCol = mongoose.connection.db.collection('exams');
    const allExams = await examsCol.find({}).toArray();
    const examIdToCourse = {};
    allExams.forEach(ex => {
      examIdToCourse[ex._id] = ex.courseName || '';
      examIdToCourse[ex.examId] = ex.courseName || '';
    });

    if (!filteredAnswers.length || !filteredAttempts.length) return res.status(404).json({ error: 'No data found' });

    // Course Comparison Logic
    const sortedExams = [...filteredAttempts].sort((a,b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const latestExam = sortedExams[sortedExams.length - 1];
    const latestCourse = examIdToCourse[latestExam.examId] || 'Unknown';
    const courseExams = sortedExams.filter(a => (examIdToCourse[a.examId] || 'Unknown') === latestCourse);
    
    let dashboardComparison = null;
    if (courseExams.length >= 2) {
      const latest = courseExams[courseExams.length - 1];
      const previousExams = courseExams.slice(0, courseExams.length - 1);
      const prevSum = previousExams.reduce((sum, ex) => sum + ex.marksScored, 0);
      const prevAverage = prevSum / previousExams.length;
      const difference = latest.marksScored - prevAverage;
      const improvementPct = prevAverage > 0 ? (difference / prevAverage) * 100 : 100;
      
      dashboardComparison = {
        eligible: true,
        courseName: latestCourse,
        latestScore: latest.marksScored,
        previousAverage: prevAverage,
        difference: difference,
        improvementPercentage: improvementPct,
        trend: difference > 0 ? 'Improving' : (difference < 0 ? 'Declining' : 'Stable')
      };
    } else {
      const courseCount = new Set(filteredAttempts.map(a => examIdToCourse[a.examId] || 'Unknown')).size;
      let msg = 'Not enough exam history for comparison.';
      if (filteredAttempts.length > 1) {
        msg = `${filteredAttempts.length} exams have been attended across ${courseCount} different courses. Comparison is not available because no course has more than one exam attempt.`;
      }
      dashboardComparison = {
        eligible: false,
        message: msg
      };
    }

    const { topicResults, outcomeResults } = calculatePerformance(filteredAnswers);
    res.json({
      studentId,
      totalExamsAttended: filteredAttempts.length,
      examSummaries: filteredAttempts.map(a => ({
        examId: a.examId,
        examName: a.examName,
        courseName: examIdToCourse[a.examId] || '',
        marksScored: a.marksScored,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        submittedAt: a.submittedAt
      })),
      dashboardComparison,
      topicResults, outcomeResults
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.examComparison = async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    // Fetch student's program courses
    const studentsCol = mongoose.connection.db.collection('students');
    const student = await studentsCol.findOne({ _id: studentId });
    let program = null;
    if (student && student.program_id) {
      const programsCol = mongoose.connection.db.collection('programs');
      program = await programsCol.findOne({ program_id: student.program_id });
    }

    const answers = await StudentAnswer.find({ studentId });
    const attempts = await getRawAttempts(studentId);

    let filteredAnswers = answers;
    let filteredAttempts = attempts;

    if (program && program.courses && program.courses.length > 0) {
      const lowerCourses = program.courses.map(c => c.toLowerCase());
      
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

      filteredAnswers = answers.filter(ans => isAllowed(ans.examId, ans.examName));
      filteredAttempts = attempts.filter(a => isAllowed(a.examId, a.examName));
    }

    if (!filteredAttempts.length) return res.status(404).json({ error: 'No exam data found for comparison' });

    // Sort chronologically (oldest to newest)
    const sortedAttempts = [...filteredAttempts].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    
    let overallPercentageSum = 0;
    const examWiseData = [];
    const topicTrend = {}; // { "Topic Name": [score1, score2, ...] }

    sortedAttempts.forEach(attempt => {
      overallPercentageSum += attempt.percentage;
      
      // Filter answers for this specific exam
      const examAnswers = filteredAnswers.filter(ans => ans.examId === attempt.examId);
      
      // Calculate performance for this exam using existing helper
      // handle empty case if somehow there are no answers
      const { topicResults } = examAnswers.length > 0 ? calculatePerformance(examAnswers) : { topicResults: [] };
      
      const topicBreakdown = topicResults.map(t => ({
        topic: t.topic,
        percentage: t.percentage
      }));

      // Build topic trend series
      topicBreakdown.forEach(tb => {
        if (!topicTrend[tb.topic]) {
           // Pad with nulls for prior exams if this topic wasn't tested earlier
           topicTrend[tb.topic] = new Array(examWiseData.length).fill(null);
        }
        topicTrend[tb.topic].push(tb.percentage);
      });
      
      // For topics that exist in trend but weren't in THIS exam, pad with null
      Object.keys(topicTrend).forEach(topic => {
        if (topicTrend[topic].length < examWiseData.length + 1) {
          topicTrend[topic].push(null);
        }
      });

      examWiseData.push({
        examId: attempt.examId,
        examName: attempt.examName,
        totalMarks: attempt.totalMarks,
        marksScored: attempt.marksScored,
        percentage: attempt.percentage,
        topicBreakdown
      });
    });

    const overallAverage = Math.round(overallPercentageSum / sortedAttempts.length);
    
    // Improvement logic (first vs last)
    let improvement = null;
    if (sortedAttempts.length > 1) {
      const firstPct = sortedAttempts[0].percentage;
      const lastPct = sortedAttempts[sortedAttempts.length - 1].percentage;
      const diff = (lastPct - firstPct).toFixed(1);
      improvement = {
        from: firstPct,
        to: lastPct,
        change: diff > 0 ? `+${diff}%` : `${diff}%`,
        trend: diff > 0 ? 'Improving' : (diff < 0 ? 'Declining' : 'Stable')
      };
    }

    res.json({
      studentId,
      totalExams: sortedAttempts.length,
      overallAverage,
      examWiseData,
      topicTrend,
      improvement
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.chat = async (req, res) => {
  try {
    const { studentId, question, conversationId } = req.body;
    if (!studentId || !question) return res.status(400).json({ error: 'studentId and question required' });

    // Fetch student and program info early
    const studentsCol = mongoose.connection.db.collection('students');
    const programsCol = mongoose.connection.db.collection('programs');
    const student = await studentsCol.findOne({ _id: studentId });
    let program = null;
    if (student && student.program_id) {
      program = await programsCol.findOne({ program_id: student.program_id });
    }

    const answers = await StudentAnswer.find({ studentId });
    const attempts = await getRawAttempts(studentId);

    // Get or create conversation history
    let conversation = null;
    if (conversationId) {
      conversation = await Conversation.findOne({ conversationId });
    }
    
    if (!conversation) {
      conversation = new Conversation({
        conversationId: `conv_${Date.now()}`,
        studentId,
        messages: []
      });
    }

    // Add user message to history early
    conversation.messages.push({
      role: 'user',
      content: question,
      timestamp: new Date()
    });

    const qLower = question.toLowerCase().trim();
    const { topicResults, outcomeResults } = answers.length ? calculatePerformance(answers) : { topicResults: [], outcomeResults: [] };

    // Explicitly intercept timetable/schedule queries
    const isTimetableRequest = 
      qLower.includes('timetable') || 
      (qLower.includes('schedule') && qLower.includes('exam')) || 
      qLower.includes('next exam') || 
      qLower.includes('upcoming exam') ||
      qLower.includes('exam timetable') ||
      qLower.includes('exam schedule');

    if (isTimetableRequest) {
      const scheduleCol = mongoose.connection.db.collection('exam_schedule');
      const todayStr = new Date().toISOString().slice(0, 10);
      const timetableQuery = { student_id: studentId, exam_date: { $gte: todayStr } };
      if (program && program.courses && program.courses.length > 0) {
        timetableQuery.course = { $in: program.courses };
      }
      const upcomingExams = await scheduleCol
        .find(timetableQuery)
        .sort({ exam_date: 1 })
        .limit(10)
        .toArray();

      let answer = "";
      if (upcomingExams.length > 0) {
        answer = "Upcoming Exam Timetable:\n" + upcomingExams.map(ex => {
          const dateObj = new Date(ex.exam_date + 'T00:00:00');
          const fDate = dateObj.toLocaleDateString(undefined, {day: '2-digit', month: 'short', year: 'numeric'});
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diffMs = dateObj - today;
          const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const countdownText = daysLeft > 0 ? `${daysLeft} Days` : daysLeft === 0 ? 'Today' : 'Past';
          return `- ${fDate} ${ex.start_time}-${ex.end_time} | ${ex.exam_name} | ${ex.room} (${ex.course}) (Countdown: ${countdownText})`;
        }).join('\n');
      } else {
        answer = "No upcoming exams are currently scheduled.";
      }

      conversation.messages.push({ role: 'assistant', content: answer, timestamp: new Date() });
      await conversation.save();
      return res.json({
        answer,
        conversationId: conversation.conversationId,
        history: conversation.messages,
        weakTopics: topicResults.filter(t => t.percentage < 76).map(t => t.topic),
        topicResults
      });
    }

    // 1. Program name query
    if (qLower.includes("what is my program") || qLower.includes("what's my program") || qLower === "my program") {
      const answer = program ? `You are enrolled in ${program.program_name}.` : "No academic program has been assigned yet.";
      conversation.messages.push({ role: 'assistant', content: answer, timestamp: new Date() });
      await conversation.save();
      return res.json({
        answer,
        conversationId: conversation.conversationId,
        history: conversation.messages,
        weakTopics: topicResults.filter(t => t.percentage < 76).map(t => t.topic),
        topicResults
      });
    }

    // 2. Assigned courses query
    if (qLower.includes("what courses are assigned to me") || qLower.includes("what courses") || qLower.includes("show my courses") || qLower.includes("courses assigned to me")) {
      let answer;
      if (program && program.courses && program.courses.length > 0) {
        const courseLines = program.courses.map((c, idx) => `${idx + 1}. ${c}`).join('\n');
        answer = `${program.program_name} Courses:\n\n${courseLines}`;
      } else {
        answer = "No academic program has been assigned yet.";
      }
      conversation.messages.push({ role: 'assistant', content: answer, timestamp: new Date() });
      await conversation.save();
      return res.json({
        answer,
        conversationId: conversation.conversationId,
        history: conversation.messages,
        weakTopics: topicResults.filter(t => t.percentage < 76).map(t => t.topic),
        topicResults
      });
    }

    // 3. Program details query
    if (qLower.includes("show my program details") || qLower.includes("program details") || qLower.includes("show program details")) {
      let answer;
      if (program && program.courses && program.courses.length > 0) {
        const courseLines = program.courses.map((c, idx) => `${idx + 1}. ${c}`).join('\n');
        answer = `Program Name: ${program.program_name}\nAssigned Courses:\n${courseLines}\nCourse Count: ${program.courses.length}`;
      } else {
        answer = "No academic program has been assigned yet.";
      }
      conversation.messages.push({ role: 'assistant', content: answer, timestamp: new Date() });
      await conversation.save();
      return res.json({
        answer,
        conversationId: conversation.conversationId,
        history: conversation.messages,
        weakTopics: topicResults.filter(t => t.percentage < 76).map(t => t.topic),
        topicResults
      });
    }
    let filteredAnswers = answers;
    let filteredAttempts = attempts;

    if (!filteredAnswers.length || !filteredAttempts.length) {
      const answer = 'No exam data found for this student.';
      conversation.messages.push({ role: 'assistant', content: answer, timestamp: new Date() });
      await conversation.save();
      return res.json({
        answer,
        conversationId: conversation.conversationId,
        history: conversation.messages,
        weakTopics: [],
        topicResults: []
      });
    }

    const examsCol = mongoose.connection.db.collection('exams');
    const allExams = await examsCol.find({}).toArray();
    const examIdToCourse = {};
    allExams.forEach(ex => {
      examIdToCourse[ex._id] = ex.courseName || '';
      examIdToCourse[ex.examId] = ex.courseName || '';
    });

    const { topicResults: filteredTopicResults, outcomeResults: filteredOutcomeResults } = calculatePerformance(filteredAnswers);
    const examNames = filteredAttempts.map(a => a.examName).filter(Boolean);

    const recentMessages = conversation.messages.slice(-5);

    // Smart Personality Name Lookup
    const studentName = student ? student.name : (filteredAttempts[0]?.studentName || "Student");
    const firstName = studentName.split(' ')[0];

    const sorted = [...filteredAttempts].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const latestExam = sorted[sorted.length - 1];
    const latestCourse = examIdToCourse[latestExam.examId] || 'Unknown';
    const dashboardExams = filteredAttempts;
    const agentExams = dashboardExams; 
    const comparisonExams = sorted.filter(a => (examIdToCourse[a.examId] || 'Unknown') === latestCourse);

    console.log("Selected Student:", studentId);
    console.log("Dashboard Exams:", dashboardExams);
    console.log("Agent Exams:", agentExams);
    console.log("Comparison Exams:", comparisonExams);
    console.log("Dashboard Count:", dashboardExams.length);
    console.log("Agent Count:", agentExams.length);
    console.log("Comparison Count:", comparisonExams.length);

    const examList = agentExams.map(a => `- ${a.examName} (${examIdToCourse[a.examId] || 'Unknown'}): ${a.marksScored}/${a.totalMarks} = ${a.percentage}%`).join('\n');
    const topicList = filteredTopicResults.map(t => `- ${t.topic}: ${t.percentage}% (${t.level})`).join('\n');
    const outcomeList = filteredOutcomeResults.map(o => `- ${o.outcome}: ${o.percentage}% (${o.level})`).join('\n');
    
    let improvement = `The student has attended a total of ${agentExams.length} exams. However, comparison analysis for the latest course is not available because they have not attended at least 2 exams in that specific course.`;
    
    // Integrate detailed exam comparison topic trends
    let topicTrendStr = "Topic trend comparison unavailable.";
    const compData = await generateExamComparisonData(studentId);
    if (!compData.error) {
      improvement = `Course: ${compData.course}. Improved from ${compData.improvement.from}% to ${compData.improvement.to}% (Change: ${compData.improvement.change}, Trend: ${compData.improvement.trend}).`;
      
      const examNames = compData.exams.map(e => e.examName).join(" -> ");
      topicTrendStr = `Detailed Topic Trends across exams (${examNames}):\n`;
      compData.topicTrend.forEach(t => {
        topicTrendStr += `- ${t.topic}: ${t.values.join('% -> ')}% (Trend: ${t.trend})\n`;
      });
    }

    // Fetch Timetable from DB (exam_schedule collection, filtered by student and program)
    const scheduleCol = mongoose.connection.db.collection('exam_schedule');
    const todayStr = new Date().toISOString().slice(0, 10);  // "YYYY-MM-DD"
    const timetableQuery = { student_id: studentId, exam_date: { $gte: todayStr } };
    if (program && program.courses && program.courses.length > 0) {
      timetableQuery.course = { $in: program.courses };
    }
    const upcomingExams = await scheduleCol
      .find(timetableQuery)
      .sort({ exam_date: 1 })
      .limit(10)
      .toArray();

    let timetableStr = "No upcoming exams are currently scheduled.";
    if (upcomingExams.length > 0) {
      timetableStr = upcomingExams.map(ex =>
        `- ${ex.exam_date} ${ex.start_time}-${ex.end_time} | ${ex.exam_name} | ${ex.room} (${ex.course})`
      ).join('\n');
    }

    // Fetch assigned courses
    let assignedCoursesStr = "No courses assigned.";
    if (program && program.courses && program.courses.length > 0) {
      assignedCoursesStr = program.courses.map((c, idx) => `- ${c}`).join('\n');
    } else {
      const assignmentsCol = mongoose.connection.db.collection('student_course_assignments');
      const coursesCol = mongoose.connection.db.collection('courses');
      const assignDoc = await assignmentsCol.findOne({ student_id: studentId });
      if (assignDoc && assignDoc.assigned_courses) {
        const coursesData = await coursesCol.find({ course_id: { $in: assignDoc.assigned_courses } }).toArray();
        assignedCoursesStr = coursesData.map(c => `- ${c.course_name} (${c.department})`).join('\n');
      }
    }

    // Fetch course exams (filtered by program if assigned)
    async function getCourseExamsStr(courseName) {
      const pastExams = await examsCol.find({ courseName }).toArray();
      const upExams = await scheduleCol.find({ course: courseName }).toArray();
      const lines = [];
      if (pastExams.length > 0) {
        lines.push("Past Exams:");
        pastExams.forEach(pe => lines.push(`  * ${pe.examName} (Date: ${pe.examDate})`));
      }
      if (upExams.length > 0) {
        lines.push("Upcoming Exams:");
        upExams.forEach(ue => lines.push(`  * ${ue.exam_name} (Date: ${ue.exam_date} at ${ue.start_time} in ${ue.room})`));
      }
      if (lines.length === 0) {
        return "No exams have been scheduled for this course.";
      }
      return lines.join('\n');
    }

    let coursesList = [];
    if (program && program.courses && program.courses.length > 0) {
      coursesList = program.courses.map(c => ({ course_name: c }));
    } else {
      const coursesCol = mongoose.connection.db.collection('courses');
      coursesList = await coursesCol.find().toArray();
    }

    const courseExamsList = [];
    for (const c of coursesList) {
      const examsStr = await getCourseExamsStr(c.course_name);
      courseExamsList.push(`- ${c.course_name}:\n${examsStr}`);
    }
    const courseExamsStr = courseExamsList.join('\n');

    const chatContext = recentMessages.map(m => 
      `${m.role === 'user' ? firstName : 'EduBot'}: ${m.content}`
    ).join('\n');

    const systemPrompt = `You are EduBot, a highly intelligent, friendly, and encouraging AI Student Success Copilot.
Your goal is to help ${firstName} understand their academic performance.
Rules:
1. Always be friendly, use ${firstName}'s name, and maintain an encouraging tone.
2. If ${firstName} is weak in a topic, add motivational messages and urgent study tips.
3. If ${firstName} improved, celebrate it with them!
4. Answer ONLY what is asked based on the provided data.
5. Smart Detection:
   - "weak topic" -> detailed topic analysis with actionable steps.
   - "improve" -> specific actionable steps.
   - "last exam" -> give exam specific data.
   - "how did I perform in the latest exam compared to previous exams" or "compare" -> Compare Exams: Summarize the student's progress and topic trends. Mention which topic improved the most based on the exact data provided.
        
        Recent Academic History:
        ${examList}

        Detailed Performance Comparison:
        ${improvement}
        ${topicTrendStr}
   - "study plan" -> provide a week-wise plan based on weak topics.
   - "predict" -> predict next score based on trends.
   - "greeting" -> friendly welcome.
   - "unknown exam" -> politely redirect and list available exams.
   - "what courses are assigned to me" or "show my courses" -> List all courses listed under the 'Assigned Courses' section.
   - "when is my next exam" or "how many days left" -> State the closest exam from the Upcoming Exam Timetable. If empty, say "No upcoming exams are currently scheduled." NEVER invent dates. NEVER generate or suggest a study plan.
   - "timetable" or "show timetable" -> List ALL exams from the Upcoming Exam Timetable. Return Exam Name, Date, Time, Room, and Countdown. If empty, say "No upcoming exams are currently scheduled." NEVER invent dates. NEVER generate or suggest a study plan.
   - "show mathematics exams" or "show physics exams" or "show chemistry exams" or other course exams -> Answer using the information listed under the corresponding course in the 'Course Exams' section. If the section says "No exams have been scheduled for this course.", you MUST reply exactly: "No exams have been scheduled for this course."
6. Max 3 sentences per answer.
7. No markdown formatting. Return plain text only.`;

    const userPrompt = `Student Data for ${firstName}:
Exams attended:
${examList}

Topics Performance:
${topicList}

Outcomes Performance:
${outcomeList}

Improvement Trend:
${improvement}

Upcoming Exam Timetable:
${timetableStr}

Assigned Courses:
${assignedCoursesStr}

Course Exams:
${courseExamsStr}

Recent Conversation History:
${chatContext}

Current Question: "${question}"

Respond to the current question according to the system rules.`;

    // Smart backend check to enforce exact fallback message for courses with no exams
    const keywords = ["exam", "test", "schedule", "timetable", "show"];
    if (keywords.some(kw => qLower.includes(kw))) {
      for (const c of coursesList) {
        if (qLower.includes(c.course_name.toLowerCase())) {
          const examsStatus = await getCourseExamsStr(c.course_name);
          if (examsStatus === "No exams have been scheduled for this course.") {
            const answer = "No exams have been scheduled for this course.";
            conversation.messages.push({
              role: 'assistant',
              content: answer,
              timestamp: new Date()
            });
            await conversation.save();
            return res.json({
              answer,
              conversationId: conversation.conversationId,
              history: conversation.messages,
              weakTopics: filteredTopicResults.filter(t => t.percentage < 76).map(t => t.topic),
              topicResults: filteredTopicResults
            });
          }
        }
      }
    }

    // Detect study plan request
    const isStudyPlanRequest = 
      qLower.includes('study plan') ||
      qLower.includes('study schedule') ||
      qLower.includes('generate plan');

    if (isStudyPlanRequest) {
      try {
        const planRes = await fetch(
          `http://localhost:5000/api/study-plan/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId })
          }
        );
        const planData = await planRes.json();
        
        if (planData.success) {
          const answer = `Your personalized 7-day study plan has been generated successfully! It includes your daily study schedule, sleep schedule, nutrition plan, and weekly goals based on your performance. Click the download button below to get your PDF!`;
          conversation.messages.push({ role: 'assistant', content: answer, timestamp: new Date() });
          await conversation.save();
          return res.json({
            answer,
            conversationId: conversation.conversationId,
            history: conversation.messages,
            studyPlan: {
              generated: true,
              planId: planData.planId,
              downloadUrl: planData.downloadUrl
            },
            weakTopics: filteredTopicResults.filter(t => t.percentage < 76).map(t => t.topic),
            topicResults: filteredTopicResults
          });
        }
      } catch (e) {
        console.error('Study plan generation error:', e);
      }
    }

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 150
    });

    const answer = completion.choices[0]?.message?.content || 'Could not generate response.';

    conversation.messages.push({
      role: 'assistant',
      content: answer,
      timestamp: new Date()
    });

    await conversation.save();

    res.json({
      answer,
      conversationId: conversation.conversationId,
      history: conversation.messages,
      weakTopics: filteredTopicResults.filter(t => t.percentage < 76).map(t => t.topic),
      topicResults: filteredTopicResults
    });

  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
};

async function generateExamComparisonData(studentId, courseName) {
  const attempts = await getRawAttempts(studentId);
  if (!attempts.length) return { error: "Comparison not available. At least 2 exams are required." };

  const examsCol = mongoose.connection.db.collection('exams');
  const allExams = await examsCol.find({}).toArray();
  const examIdToCourse = {};
  allExams.forEach(ex => {
    examIdToCourse[ex._id] = ex.courseName || '';
    examIdToCourse[ex.examId] = ex.courseName || '';
  });

  const sortedAttempts = [...attempts].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  
  // Group by course
  const courseGroups = {};
  sortedAttempts.forEach(a => {
    const course = examIdToCourse[a.examId] || 'Unknown';
    if (!courseGroups[course]) courseGroups[course] = [];
    courseGroups[course].push(a);
  });



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
  const sign = improvementVal > 0 ? '+' : '';
  const trendStr = improvementVal > 0 ? 'Improving' : (improvementVal < 0 ? 'Declining' : 'Stable');

  const targetExamIds = targetExams.map(e => e.examId);
  const answers = await StudentAnswer.find({ studentId, examId: { $in: targetExamIds } });
  
  const topicData = {};
  answers.forEach(ans => {
    const t = ans.topic?.name;
    if (!t) return;
    if (!topicData[t]) topicData[t] = {};
    if (!topicData[t][ans.examId]) topicData[t][ans.examId] = { scored: 0, max: 0 };
    topicData[t][ans.examId].scored += ans.marksScored;
    topicData[t][ans.examId].max += ans.maxMarks;
  });

  const topicTrend = [];
  Object.keys(topicData).forEach(topic => {
    const values = targetExams.map(ex => {
      const d = topicData[topic][ex.examId];
      if (!d || d.max === 0) return 0;
      return Math.round((d.scored / d.max) * 100);
    });
    
    const firstVal = values[0];
    const latestVal = values[values.length - 1];
    const diff = latestVal - firstVal;
    const tTrend = diff > 0 ? 'Improving' : (diff < 0 ? 'Declining' : 'Stable');
    
    topicTrend.push({ topic, values, trend: tTrend });
  });

  return {
    studentId,
    course: targetCourse,
    totalExams: targetExams.length,
    averagePercentage,
    highestPercentage,
    lowestPercentage,
    improvement: {
      from: firstExam.percentage,
      to: latestExam.percentage,
      change: `${sign}${improvementVal.toFixed(1)}%`,
      trend: trendStr
    },
    exams: targetExams.map(e => ({ examName: e.examName, percentage: e.percentage })),
    topicTrend
  };
}

exports.examComparison = async (req, res) => {
  try {
    const { studentId, courseName } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    const data = await generateExamComparisonData(studentId, courseName);
    if (data.error) return res.json({ message: data.error });

    res.json(data);

  } catch (e) {
    console.error('Exam Comparison Error:', e);
    res.status(500).json({ error: e.message });
  }
};

