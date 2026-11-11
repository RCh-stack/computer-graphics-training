const express = require('express');
const router = express.Router();
const { login, register, requestResetCode, resetPassword } = require('../controllers/authController');
const { loginLimiter, forgotPasswordLimiter } = require('../services/rateLimiter');

router.post('/login', loginLimiter, login);

router.post('/register', register);

router.post('/request-reset', forgotPasswordLimiter, requestResetCode);

router.post('/reset-password', resetPassword);

module.exports = router;