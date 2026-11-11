const express = require('express');
const router = express.Router();
const { getAllLabs, getLabById, saveLab, runTests, submitLab } = require('../controllers/labController');
const { compilerLimiter } = require('../services/rateLimiter')
const { authenticateToken } = require('../services/jwt');

router.get('/', authenticateToken, getAllLabs);

router.get('/:id', authenticateToken, getLabById);

router.post('/save', authenticateToken, saveLab);

router.post('/run', authenticateToken, compilerLimiter, runTests);

router.post('/submit', authenticateToken, compilerLimiter, submitLab);

module.exports = router;