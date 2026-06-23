const mongoose = require('mongoose');
const Groq = require('groq-sdk');
const PDFDocument = require('pdfkit');
const StudentAnswer = require('../models/studentAnswer');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function getLevel(pct) {
  if (pct <= 40) return 'Critical';
  if (pct <= 60) return 'Weak';
  if (pct <= 75) return 'Average';
  return 'Good';
}

exports.generateStudyPlan = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }

    // Step 1: Get student info
    const studentCol = mongoose.connection.db.collection('students');
    const student = await studentCol.findOne({ _id: studentId });
    const studentName = student?.name || 'Student';

    // Step 2: Get performance data
    const answers = await StudentAnswer.find({ studentId });
    
    // Step 3: Calculate topic performance
    const topicMap = {};
    answers.forEach(ans => {
      const t = ans.topic?.name;
      if (!t) return;
      if (!topicMap[t]) topicMap[t] = { scored: 0, max: 0 };
      topicMap[t].scored += ans.marksScored;
      topicMap[t].max += ans.maxMarks;
    });

    const topicResults = Object.entries(topicMap).map(([name, val]) => {
      const pct = Math.round((val.scored / val.max) * 10000) / 100;
      return { topic: name, percentage: pct, level: getLevel(pct) };
    }).sort((a, b) => a.percentage - b.percentage);

    // Step 4: Get exam attempts for trend
    const attemptsCol = mongoose.connection.db.collection('studentexamattempts');
    const attempts = await attemptsCol
      .find({ studentId, status: 'SUBMITTED' })
      .sort({ submittedAt: 1 })
      .toArray();

    const examTrend = attempts.map(a => 
      `${a.examName}: ${a.percentage}%`
    ).join(', ');

    const weakTopics = topicResults.filter(t => t.percentage < 76);
    const goodTopics = topicResults.filter(t => t.percentage >= 76);

    // Step 5: Generate study plan using Groq
    const prompt = `
You are an expert academic counselor and study planner.

Student: ${studentName}
Exam Performance Trend: ${examTrend}

Topic Performance:
${topicResults.map(t => `- ${t.topic}: ${t.percentage}% (${t.level})`).join('\n')}

Weak Topics (need focus): ${weakTopics.map(t => t.topic).join(', ')}
Strong Topics: ${goodTopics.map(t => t.topic).join(', ')}

Generate a detailed 7-day study plan as JSON.
Return ONLY valid JSON, no other text.

{
  "studentName": "${studentName}",
  "planTitle": "7-Day Smart Study Plan",
  "overallAdvice": "2-3 sentences of encouraging personalized advice",
  "days": [
    {
      "day": 1,
      "dayName": "Monday",
      "focusTopic": "Topic Name",
      "studyHours": 3,
      "sessions": [
        {
          "time": "9:00 AM - 11:00 AM",
          "activity": "Study Ledger Posting fundamentals",
          "type": "study"
        },
        {
          "time": "11:00 AM - 11:15 AM",
          "activity": "Short break - walk outside",
          "type": "break"
        },
        {
          "time": "11:15 AM - 12:15 PM",
          "activity": "Practice 10 problems on Ledger",
          "type": "practice"
        }
      ],
      "dailyTip": "One specific study tip for this day"
    }
  ],
  "sleepSchedule": {
    "bedtime": "10:30 PM",
    "wakeup": "6:30 AM",
    "totalSleep": "8 hours",
    "advice": "Sleep advice for exam preparation"
  },
  "foodPlan": {
    "breakfast": "Specific healthy breakfast suggestion",
    "lunch": "Specific healthy lunch suggestion",
    "dinner": "Specific healthy dinner suggestion",
    "snacks": "Healthy snack suggestions",
    "hydration": "Water intake advice",
    "avoidFoods": "Foods to avoid during exam prep"
  },
  "weeklyGoals": [
    "Goal 1",
    "Goal 2",
    "Goal 3"
  ],
  "motivationalQuote": "An inspiring quote for the student",
  "expectedImprovement": "Expected improvement after following this plan"
}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 2000
    });

    let planData;
    try {
      const responseText = completion.choices[0].message.content;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      planData = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(500).json({ 
        error: 'Failed to parse AI response. Try again.' 
      });
    }

    // Store plan in MongoDB
    const plansCol = mongoose.connection.db.collection('studyplans');
    const planResult = await plansCol.insertOne({
      studentId,
      studentName,
      planData,
      topicResults,
      createdAt: new Date(),
      status: 'active'
    });

    const planId = planResult.insertedId.toString();

    res.json({
      success: true,
      planId,
      message: `Study plan generated for ${studentName}!`,
      downloadUrl: `/api/study-plan/download/${planId}`,
      plan: planData
    });

  } catch (error) {
    console.error('Study Plan Error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.downloadStudyPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { ObjectId } = require('mongodb');
    
    const plansCol = mongoose.connection.db.collection('studyplans');
    const planDoc = await plansCol.findOne({ 
      _id: new ObjectId(planId) 
    });

    if (!planDoc) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planDoc.planData;
    const topics = planDoc.topicResults;

    // Generate PDF
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename="StudyPlan_${planDoc.studentId}.pdf"`
    );
    doc.pipe(res);

    // Colors
    const purple = '#6c63ff';
    const green = '#34d399';
    const yellow = '#fbbf24';
    const red = '#f87171';
    const dark = '#1a1d27';
    const gray = '#7b82a8';

    // ── COVER PAGE ──
    doc.rect(0, 0, doc.page.width, 200).fill(purple);
    doc.fillColor('white')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('SMART STUDY PLAN', 50, 60, { align: 'center' });
    doc.fontSize(16)
       .text(plan.studentName || 'Student', 50, 100, { align: 'center' });
    doc.fontSize(12)
       .fillColor('#e0e0ff')
       .text('Generated by EduAgent AI', 50, 130, { align: 'center' });
    doc.fillColor('white')
       .fontSize(11)
       .text(new Date().toLocaleDateString('en-IN', { 
         day: 'numeric', month: 'long', year: 'numeric' 
       }), 50, 155, { align: 'center' });

    doc.moveDown(8);

    // Overall Advice Box
    doc.roundedRect(50, 220, doc.page.width - 100, 80, 10)
       .fill('#f0f0ff');
    doc.fillColor(purple)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('📊 PERSONALIZED ADVICE', 70, 235);
    doc.fillColor('#2d2d2d')
       .fontSize(10)
       .font('Helvetica')
       .text(plan.overallAdvice || '', 70, 255, { 
         width: doc.page.width - 140,
         lineGap: 4
       });

    doc.moveDown(2);

    // Topic Performance Summary
    doc.fillColor(purple)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('TOPIC PERFORMANCE SUMMARY', 50, 330);
    
    let yPos = 355;
    topics.forEach(t => {
      const barColor = t.level === 'Critical' ? red :
                       t.level === 'Weak' ? yellow :
                       t.level === 'Average' ? '#60a5fa' : green;
      
      doc.fillColor('#2d2d2d')
         .fontSize(10)
         .font('Helvetica')
         .text(t.topic, 50, yPos);
      
      // Progress bar background
      doc.rect(200, yPos + 2, 250, 10).fill('#e0e0e0');
      // Progress bar fill
      doc.rect(200, yPos + 2, (t.percentage / 100) * 250, 10).fill(barColor);
      
      doc.fillColor(barColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(`${t.percentage}% (${t.level})`, 460, yPos);
      
      yPos += 25;
    });

    // Motivational Quote
    doc.moveDown(2);
    yPos += 20;
    doc.roundedRect(50, yPos, doc.page.width - 100, 50, 8)
       .fill('#fff8e1');
    doc.fillColor('#f59e0b')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text(`"${plan.motivationalQuote || 'Believe in yourself!'}"`, 
         70, yPos + 15, { 
           width: doc.page.width - 140,
           align: 'center'
         });

    doc.addPage();

    // ── 7 DAY PLAN ──
    doc.rect(0, 0, doc.page.width, 50).fill(purple);
    doc.fillColor('white')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('7-DAY STUDY SCHEDULE', 50, 15, { align: 'center' });

    yPos = 70;

    (plan.days || []).forEach((day, index) => {
      // Check page space
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }

      // Day header
      const dayColor = index % 2 === 0 ? purple : green;
      doc.roundedRect(50, yPos, doc.page.width - 100, 30, 5).fill(dayColor);
      doc.fillColor('white')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(`Day ${day.day} — ${day.dayName} | Focus: ${day.focusTopic} | ${day.studyHours}h study`, 
           65, yPos + 8);
      
      yPos += 40;

      // Sessions
      (day.sessions || []).forEach(session => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        const sessionColor = session.type === 'study' ? '#e8f4fd' :
                             session.type === 'break' ? '#f0fff8' : '#fff8e1';
        const dotColor = session.type === 'study' ? purple :
                        session.type === 'break' ? green : yellow;

        doc.rect(60, yPos, doc.page.width - 120, 22).fill(sessionColor);
        doc.circle(75, yPos + 11, 4).fill(dotColor);
        doc.fillColor('#2d2d2d')
           .fontSize(9)
           .font('Helvetica-Bold')
           .text(session.time, 85, yPos + 6);
        doc.font('Helvetica')
           .text(session.activity, 200, yPos + 6, {
             width: doc.page.width - 260
           });
        
        yPos += 26;
      });

      // Daily tip
      doc.fillColor(dayColor)
         .fontSize(9)
         .font('Helvetica-Bold')
         .text(`💡 Tip: ${day.dailyTip || ''}`, 65, yPos, {
           width: doc.page.width - 130
         });
      
      yPos += 30;
    });

    doc.addPage();

    // ── SLEEP SCHEDULE ──
    doc.rect(0, 0, doc.page.width, 50).fill('#6c63ff');
    doc.fillColor('white')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('SLEEP & WELLNESS SCHEDULE', 50, 15, { align: 'center' });

    yPos = 70;

    // Sleep box
    const sleep = plan.sleepSchedule || {};
    doc.roundedRect(50, yPos, doc.page.width - 100, 120, 10).fill('#e8f4fd');
    doc.fillColor(purple)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('😴 SLEEP SCHEDULE', 70, yPos + 15);
    
    doc.fillColor('#2d2d2d').fontSize(11).font('Helvetica');
    doc.text(`🌙 Bedtime: ${sleep.bedtime || '10:30 PM'}`, 70, yPos + 40);
    doc.text(`☀️ Wake Up: ${sleep.wakeup || '6:30 AM'}`, 70, yPos + 58);
    doc.text(`⏰ Total Sleep: ${sleep.totalSleep || '8 hours'}`, 70, yPos + 76);
    doc.fillColor(purple).font('Helvetica-Bold')
       .text(`Advice: `, 70, yPos + 94);
    doc.fillColor('#2d2d2d').font('Helvetica')
       .text(sleep.advice || '', 120, yPos + 94, { 
         width: doc.page.width - 190 
       });

    yPos += 140;

    // ── FOOD PLAN ──
    const food = plan.foodPlan || {};
    doc.roundedRect(50, yPos, doc.page.width - 100, 200, 10).fill('#f0fff8');
    doc.fillColor(green)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('🥗 NUTRITION PLAN', 70, yPos + 15);

    const foodItems = [
      { icon: '🌅', label: 'Breakfast', value: food.breakfast },
      { icon: '🌞', label: 'Lunch', value: food.lunch },
      { icon: '🌙', label: 'Dinner', value: food.dinner },
      { icon: '🍎', label: 'Snacks', value: food.snacks },
      { icon: '💧', label: 'Hydration', value: food.hydration },
      { icon: '🚫', label: 'Avoid', value: food.avoidFoods },
    ];

    let foodY = yPos + 40;
    foodItems.forEach(item => {
      doc.fillColor('#2d2d2d')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(`${item.icon} ${item.label}:`, 70, foodY);
      doc.font('Helvetica')
         .text(item.value || '-', 180, foodY, { 
           width: doc.page.width - 240 
         });
      foodY += 26;
    });

    yPos += 220;

    // ── WEEKLY GOALS ──
    doc.roundedRect(50, yPos, doc.page.width - 100, 100, 10).fill('#fff8e1');
    doc.fillColor('#f59e0b')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('🎯 WEEKLY GOALS', 70, yPos + 15);

    let goalY = yPos + 40;
    (plan.weeklyGoals || []).forEach((goal, i) => {
      doc.fillColor('#2d2d2d')
         .fontSize(10)
         .font('Helvetica')
         .text(`${i + 1}. ${goal}`, 70, goalY);
      goalY += 18;
    });

    yPos += 120;

    // Expected Improvement
    doc.roundedRect(50, yPos, doc.page.width - 100, 50, 10).fill('#e8f4fd');
    doc.fillColor(purple)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('📈 Expected Improvement:', 70, yPos + 10);
    doc.fillColor('#2d2d2d')
       .fontSize(10)
       .font('Helvetica')
       .text(plan.expectedImprovement || '', 70, yPos + 30, {
         width: doc.page.width - 140
       });

    // Footer
    doc.fillColor(gray)
       .fontSize(9)
       .font('Helvetica')
       .text(
         'Generated by EduAgent AI System | For Academic Use Only',
         50, 780, { align: 'center' }
       );

    doc.end();

  } catch (error) {
    console.error('PDF Error:', error);
    res.status(500).json({ error: error.message });
  }
};
