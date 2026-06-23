const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/feature1');
router.get('/exam-comparison', ctrl.examComparison);
module.exports = router;
