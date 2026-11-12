const express = require('express');
const router = express.Router();
const { getAllTests, getTestById, submitTest, getTestResult } = require('../controllers/user/testController');
const { authenticateToken } = require('../services/jwt');

router.get('/', authenticateToken, getAllTests)

router.get('/:id', authenticateToken, getTestById);

router.post('/:id/submit', authenticateToken, submitTest);

router.get('/:id/result', authenticateToken, getTestResult);

module.exports = router;