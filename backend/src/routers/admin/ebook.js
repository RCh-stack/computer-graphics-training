const express = require('express');
const router = express.Router();

const {
    getChapters,
    createChapter,
    updateChapter,
    deleteChapter,
    getLessonById,
    createLesson,
    updateLesson,
    deleteLesson
} = require('../../controllers/admin/ebookController');

const { validate } = require('../../services/validator');
const { saveArticleSchema } = require('../../validators/ebookValidator');

router.get('/chapters', getChapters);
router.post('/chapters', createChapter);
router.put('/chapters/:id', updateChapter);
router.delete('/chapters/:id', deleteChapter);

router.get('/lessons/:id', getLessonById);
router.post('/lessons', createLesson);
router.put('/lessons/:id', validate({ body: saveArticleSchema }), updateLesson);
router.delete('/lessons/:id', deleteLesson);

module.exports = router;