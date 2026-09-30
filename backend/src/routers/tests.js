const express = require('express');
const router = express.Router();
const { getAllTests, getTestById, submitTest } = require('../controllers/testController');
const { authenticateToken } = require('../services/jwt');

router.get('/', authenticateToken, getAllTests)

router.get('/:id', authenticateToken, getTestById);

router.post('/:id/submit', authenticateToken, submitTest)

module.exports = router;