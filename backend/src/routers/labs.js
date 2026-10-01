const express = require('express');
const router = express.Router();
const { getAllLabs, getLabById, runTests, submitLab } = require('../controllers/labController');
const { authenticateToken } = require('../services/jwt');

router.get('/', authenticateToken, getAllLabs);

router.get('/:id', authenticateToken, getLabById);

router.post('/run', authenticateToken, runTests);

router.post('/submit', authenticateToken, submitLab);

module.exports = router;