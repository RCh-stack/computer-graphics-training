const express = require('express');
const router = express.Router();

const {
    login,
    verify2FA,
    setup2FA,
    enable2FA,
    disable2FA,
    register,
    requestResetCode,
    resetPassword
} = require('../controllers/authController');

const { authenticateToken } = require('../services/jwt');
const { loginLimiter, forgotPasswordLimiter, twoFactorLimiter } = require('../services/rateLimiter');
const { validate } = require('../services/validator');
const {
    loginSchema,
    verify2FASchema,
    enable2FASchema,
    disable2FASchema
} = require('../validators/authValidator');

router.post('/login', loginLimiter, validate({ body: loginSchema }), login);
router.post('/2fa/verify', twoFactorLimiter, validate({ body: verify2FASchema }), verify2FA);

router.post('/2fa/setup', authenticateToken, setup2FA);
router.post('/2fa/enable', authenticateToken, validate({ body: enable2FASchema }), enable2FA);
router.post('/2fa/disable', authenticateToken, validate({ body: disable2FASchema }), disable2FA);

router.post('/register', register);
router.post('/request-reset', forgotPasswordLimiter, requestResetCode);
router.post('/reset-password', resetPassword);

module.exports = router;