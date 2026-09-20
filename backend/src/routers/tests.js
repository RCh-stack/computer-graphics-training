const express = require('express');
const router = express.Router();
const { getAllTests, getTestById, verifyTest, submitTest } = require('../controllers/testController');
const { authenticateToken } = require('../services/jwt');

router.get('/', getAllTests)

router.get('/:id', getTestById);

router.post('/:id/verify', authenticateToken, verifyTest);

router.post('/:id/submit', authenticateToken, submitTest)

module.exports = router;