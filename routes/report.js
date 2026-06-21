const express = require('express');
const router = express.Router();
const reportCtrl = require('../controllers/reportController');

router.get('/download-report', reportCtrl.downloadReport);

module.exports = router;
