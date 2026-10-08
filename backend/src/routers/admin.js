const express = require('express');
const router = express.Router();

const { 
    getPendingStudents, getStudents, approveStudent, changeUserRole, 
    getGroups, createGroup, getGradebook, getTeachers } = require('../controllers/adminController');

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

module.exports = router;