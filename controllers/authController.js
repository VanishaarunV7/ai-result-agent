const StudentSession = require('../models/studentSession');
// Changed to dynamically look up Student model or we can create it.
// The user code references: const Student = require('../models/student');
const mongoose = require('mongoose');

// Assuming Student model exists or using generic response if not. 
// Wait, the user mentioned it:
const Student = require('../models/student');

exports.login = async (req, res) => {
  try {
    const { studentId, academicNo } = req.body;
    
    // Verify student exists
    const student = await Student.findOne({ _id: studentId, academicNo });
    if (!student) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const sessionId = `sess_${Date.now()}`;
    const session = await StudentSession.create({
      sessionId,
      studentId,
      academicNo,
      studentName: student.name,
      loginTime: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      isActive: true
    });

    res.json({
      sessionId,
      studentId,
      studentName: student.name,
      message: 'Login successful'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const { sessionId } = req.body;
    await StudentSession.updateOne({ sessionId }, { isActive: false });
    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
