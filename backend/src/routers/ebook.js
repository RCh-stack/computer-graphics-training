const express = require('express');
const router = express.Router();
const { getAllLessons, getLessonById } = require('../controllers/ebookController');
const { authenticateToken } = require('../services/jwt');

router.get('/lessons', authenticateToken, getAllLessons)

router.get('/lessons/:id', authenticateToken, getLessonById);

module.exports = router;