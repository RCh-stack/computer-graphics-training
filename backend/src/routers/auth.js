const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../services/jwt');

// Публичный роут
router.post('/login', login);

// Защищенный роут
router.get('/me', authenticateToken, getMe);

module.exports = router;