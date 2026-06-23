const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ragController');

router.post('/upload-pdf', ctrl.uploadPDF);
router.post('/ask', ctrl.askPDF);
router.post('/generate-questions', ctrl.generateQuestions);

module.exports = router;
