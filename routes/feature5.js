const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const ctrl = require('../controllers/feature5');

router.post('/upload-pdf', upload.single('pdf'), ctrl.uploadPdf);
router.post('/ask', ctrl.ask);
router.post('/generate-questions', ctrl.generateQuestions);

module.exports = router;
