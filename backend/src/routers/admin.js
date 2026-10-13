const express = require('express');
const router = express.Router();

const { 
    getPendingStudents, getStudents, approveStudent, changeUserRole, 
    getGroups, createGroup, getGradebook, getTeachers } = require('../controllers/adminController');

const { getAllTests, getTestById, createTest, updateTest, deleteTest } = require('../controllers/AdminControllers/testController')

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

module.exports = router;