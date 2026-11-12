const express = require('express');
const router = express.Router();
const { getStudentSummary, getDetailedHistory } = require('../controllers/user/progressController');
const { authenticateToken } = require('../services/jwt');

router.get('/summary', authenticateToken, getStudentSummary);

router.get('/history', authenticateToken, getDetailedHistory);

module.exports = router;