const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studyPlanController');

router.post('/generate', ctrl.generateStudyPlan);
router.get('/download/:planId', ctrl.downloadStudyPlan);

module.exports = router;
