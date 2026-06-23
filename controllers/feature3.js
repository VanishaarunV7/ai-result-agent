const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');

exports.progress = async (req, res) => {
    try {
        const { studentId } = req.query;
        if (!studentId) return res.status(400).json({ error: 'studentId required' });

        const doc = new PDFDocument();
        res.setHeader('Content-Disposition', `attachment; filename="progress_report_${studentId}.pdf"`);
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        const student = await mongoose.connection.db.collection('students').findOne({ _id: studentId });
        const attempts = await mongoose.connection.db.collection('studentexamattempts').find({ studentId, status: 'SUBMITTED' }).toArray();
        const answers = await mongoose.connection.db.collection('studentanswers').find({ studentId }).toArray();

        doc.fontSize(20).text('Student Progress Report', { align: 'center' });
        doc.moveDown();

        doc.fontSize(14).text('1. Student Information');
        doc.fontSize(12).text(`ID: ${studentId}`);
        doc.text(`Name: ${student ? student.name : 'N/A'}`);
        doc.moveDown();

        doc.fontSize(14).text('2. Exam History');
        if (attempts.length === 0) {
            doc.fontSize(12).text('No exams taken.');
        } else {
            attempts.forEach(a => {
                doc.fontSize(12).text(`- ${a.examName}: ${a.marksScored}/${a.totalMarks} (${a.percentage}%)`);
            });
        }
        doc.moveDown();

        const topicMap = {};
        const outcomeMap = {};
        answers.forEach(ans => {
            if (ans.topic && ans.topic.name) {
                const t = ans.topic.name;
                if (!topicMap[t]) topicMap[t] = { scored: 0, max: 0 };
                topicMap[t].scored += ans.marksScored;
                topicMap[t].max += ans.maxMarks;
            }
            if (ans.outcomes) {
                ans.outcomes.forEach(oc => {
                    const key = `${oc.code} - ${oc.name}`;
                    if (!outcomeMap[key]) outcomeMap[key] = { scored: 0, max: 0 };
                    outcomeMap[key].scored += ans.marksScored;
                    outcomeMap[key].max += ans.maxMarks;
                });
            }
        });

        doc.fontSize(14).text('3. Topic Breakdown');
        Object.keys(topicMap).forEach(t => {
            const pct = ((topicMap[t].scored / topicMap[t].max) * 100).toFixed(2);
            doc.fontSize(12).text(`- ${t}: ${pct}%`);
        });
        doc.moveDown();

        doc.fontSize(14).text('4. Outcomes Breakdown');
        Object.keys(outcomeMap).forEach(o => {
            const pct = ((outcomeMap[o].scored / outcomeMap[o].max) * 100).toFixed(2);
            doc.fontSize(12).text(`- ${o}: ${pct}%`);
        });
        doc.moveDown();

        doc.fontSize(14).text('5. Recommendations');
        const weakTopics = Object.keys(topicMap).filter(t => (topicMap[t].scored / topicMap[t].max) < 0.6);
        if (weakTopics.length > 0) {
            doc.fontSize(12).text(`Focus on the following weak areas: ${weakTopics.join(', ')}`);
        } else {
            doc.fontSize(12).text('Great job! Keep up the good work.');
        }

        doc.end();

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
