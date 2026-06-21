const PDFDocument = require('pdfkit');
const fs = require('fs');
const StudentExamAttempt = require('../models/studentExamAttempt');
const StudentAnswer = require('../models/studentAnswer');

exports.downloadReport = async (req, res) => {
  try {
    const { studentId } = req.query;
    
    const attempts = await StudentExamAttempt.find({ studentId });
    const answers = await StudentAnswer.find({ studentId });
    
    const doc = new PDFDocument();
    const filename = `report_${studentId}.pdf`;
    
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    doc.pipe(res);
    
    doc.fontSize(20).text('Student Performance Report', { align: 'center' });
    doc.fontSize(12).text(`Student ID: ${studentId}`, { align: 'left' });
    
    attempts.forEach(attempt => {
      doc.fontSize(14).text(attempt.examName);
      doc.text(`Marks: ${attempt.marksScored}/${attempt.totalMarks} = ${attempt.percentage}%`);
      doc.moveDown();
    });
    
    doc.end();
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
