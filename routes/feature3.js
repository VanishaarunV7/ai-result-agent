const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/feature3');
router.get('/progress', ctrl.progress);
module.exports = router;
