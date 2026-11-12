const express = require('express');
const router = express.Router();
const { getAllLabs, getLabById, saveLab, runTests, submitLab } = require('../controllers/labController');
const { compilerLimiter } = require('../services/rateLimiter')
const { authenticateToken } = require('../services/jwt');

const { validate } = require('../services/validator');
const { executeLabSchema, saveDraftSchema } = require('../validators/labValidator');

router.get('/', authenticateToken, getAllLabs);

router.get('/:id', authenticateToken, getLabById);

router.post('/save', authenticateToken, validate({ body: saveDraftSchema }), saveLab);

router.post('/run', authenticateToken, compilerLimiter, validate({ body: executeLabSchema }), runTests);

router.post('/submit', authenticateToken, compilerLimiter, validate({ body: executeLabSchema }), submitLab);

module.exports = router;