const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentController');

router.get('/:student_id/program', ctrl.getProgram);
router.get('/:student_id/courses', ctrl.getCourses);
router.get('/:student_id/dashboard', ctrl.getDashboard);
router.get('/:student_id/assigned-courses', ctrl.getAssignedCourses);
router.get('/:student_id/exam-schedule', ctrl.getExamSchedule);
router.get('/:student_id/next-exam', ctrl.getNextExam);

module.exports = router;
