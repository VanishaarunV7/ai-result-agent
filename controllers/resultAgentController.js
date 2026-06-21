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
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });
    const answers = await StudentAnswer.find({ studentId });
    if (!answers.length) return res.status(404).json({ error: 'No data found' });
    const attempts = await getRawAttempts(studentId);
    const { topicResults, outcomeResults } = calculatePerformance(answers);
    res.json({
      studentId,
      totalExamsAttended: attempts.length,
      examSummaries: attempts.map(a => ({
        examId: a.examId,
        examName: a.examName,
        marksScored: a.marksScored,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        submittedAt: a.submittedAt
      })),
      topicResults, outcomeResults
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.chat = async (req, res) => {
  try {
    const { studentId, question, conversationId } = req.body;
    if (!studentId || !question) return res.status(400).json({ error: 'studentId and question required' });

    const answers = await StudentAnswer.find({ studentId });
    const attempts = await getRawAttempts(studentId);

    if (!answers.length || !attempts.length) {
      return res.json({ answer: 'No exam data found for this student.' });
    }

    const { topicResults, outcomeResults } = calculatePerformance(answers);
    const examNames = attempts.map(a => a.examName).filter(Boolean);

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

    // Add user message
    conversation.messages.push({
      role: 'user',
      content: question,
      timestamp: new Date()
    });

    // Build focused context for Groq
    const sorted = [...attempts].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    const latest = sorted[0];
    const previous = sorted[1] || null;

    const examList = attempts.map(a => `- ${a.examName}: ${a.marksScored}/${a.totalMarks} = ${a.percentage}%`).join('\n');
    const topicList = topicResults.map(t => `- ${t.topic}: ${t.percentage}% (${t.level})`).join('\n');
    const improvement = previous
      ? `Latest: ${latest.examName} = ${latest.percentage}%. Previous: ${previous.examName} = ${previous.percentage}%.`
      : `Only one exam: ${latest.examName} = ${latest.percentage}%.`;

    const chatContext = conversation.messages.map(m => 
      `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.content}`
    ).join('\n');

    const prompt = `Student result data:
Exams attended:
${examList}

Topics Performance:
${topicList}

Improvement: ${improvement}

Previous conversation:
${chatContext}

Based on the conversation history and the student's result data, answer the student's latest question. Reply in 1-2 sentences only. Use only the provided data. Do not add any extra information not asked.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Answer student exam questions concisely based on the data provided.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 150
    });

    const answer = completion.choices[0]?.message?.content || 'Could not generate response.';

    // Add assistant message
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
      weakTopics: topicResults.filter(t => t.percentage < 76).map(t => t.topic),
      topicResults
    });

  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
