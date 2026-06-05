const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const verifyToken = require('../middleware/auth');

router.get('/', verifyToken, statsController.getSystemStats);

module.exports = router;
