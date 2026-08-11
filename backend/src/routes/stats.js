const express = require('express');
const statsController = require('../controllers/statsController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.get('/', verifyToken, statsController.getSystemStats);
module.exports = router;
