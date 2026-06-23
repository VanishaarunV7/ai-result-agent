const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/resultAgentController');

router.get('/exam-summary', ctrl.examSummary);
router.get('/overall-summary', ctrl.overallSummary);
router.get('/exam-comparison', ctrl.examComparison);
router.post('/chat', ctrl.chat);

module.exports = router;
