const express = require('express');
const router = express.Router();
const { loadProfile, updateProfile } = require('../controllers/user/userController');
const { authenticateToken } = require('../services/jwt');

router.get('/profile', authenticateToken, loadProfile);

router.put('/profile', authenticateToken, updateProfile);

module.exports = router;