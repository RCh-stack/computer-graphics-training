const express = require('express');
const router = express.Router();
const { getAllLessons, getLessonById, updateLessonProgress } = require('../controllers/ebookController');
const { authenticateToken } = require('../services/jwt');

router.get('/lessons', authenticateToken, getAllLessons)

router.get('/lessons/:id', authenticateToken, getLessonById);

router.post('/lessons/:id/progress', authenticateToken, updateLessonProgress);

module.exports = router;