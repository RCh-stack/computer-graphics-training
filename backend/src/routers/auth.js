const express = require('express');
const router = express.Router();
const { login, register, requestResetCode, resetPassword } = require('../controllers/authController');

router.post('/login', login);

router.post('/register', register);

router.post('/request-reset', requestResetCode);

router.post('/reset-password', resetPassword);

module.exports = router;