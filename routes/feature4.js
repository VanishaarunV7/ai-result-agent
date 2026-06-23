const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/feature4');
router.post('/generate', ctrl.generateStudyPlan);
module.exports = router;
