const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/feature2');
router.get('/predict', ctrl.predict);
module.exports = router;
