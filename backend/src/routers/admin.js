const express = require('express');
const router = express.Router();

const { 
    getPendingStudents, getStudents, approveStudent, changeUserRole, 
    getGroups, createGroup, getGradebook, getTeachers } = require('../controllers/adminController');

const { getAllTests, getTestById, createTest, updateTest, deleteTest } = require('../controllers/AdminControllers/testController');

const { getAllLabs, getLabById, createLab, updateLab, deleteLab } = require('../controllers/AdminControllers/labController');

const { 
    getChapters, createChapter, updateChapter, deleteChapter, 
    getLessonById, createLesson, updateLesson, deleteLesson} = require('../controllers/AdminControllers/ebookController');

const { authenticateToken } = require('../services/jwt');

// users

router.get('/users/pending-students', authenticateToken, getPendingStudents);
router.get('/users/students', authenticateToken, getStudents);
router.get('/users/teachers', authenticateToken, getTeachers);
router.put('/users/approve', authenticateToken, approveStudent);
router.put('/users/role', authenticateToken, changeUserRole);
router.get('/users/groups', authenticateToken, getGroups);
router.post('/users/groups', authenticateToken, createGroup);
router.get('/users/gradebook', authenticateToken, getGradebook);

// tests

router.get('/tests', authenticateToken, getAllTests);
router.get('/tests/:id', authenticateToken, getTestById);
router.post('/tests', authenticateToken, createTest);
router.put('/tests/:id', authenticateToken, updateTest);
router.delete('/tests/:id', authenticateToken, deleteTest);

// labs

router.get('/labs', authenticateToken, getAllLabs);
router.get('/labs/:id', authenticateToken, getLabById);
router.post('/labs', authenticateToken, createLab);
router.put('/labs/:id', authenticateToken, updateLab);
router.delete('/labs/:id', authenticateToken, deleteLab);

// ebook
router.get('/ebook/chapters', authenticateToken, getChapters);
router.post('/ebook/chapters', authenticateToken, createChapter);
router.put('/ebook/chapters/:id', authenticateToken, updateChapter);
router.delete('/ebook/chapters/:id', authenticateToken, deleteChapter);
router.get('/ebook/lessons/:id', authenticateToken, getLessonById);
router.post('/ebook/lessons', authenticateToken, createLesson);
router.put('/ebook/lessons/:id', authenticateToken, updateLesson);
router.delete('/ebook/lessons/:id', authenticateToken, deleteLesson);

module.exports = router;