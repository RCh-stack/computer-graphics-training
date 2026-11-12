const express = require('express');
const router = express.Router();

const {
    getPendingStudents,
    getStudents,
    getTeachers,
    approveStudent,
    changeUserRole,
    getGroups,
    createGroup,
    updateUserGroup,
    getGradebook
} = require('../../controllers/admin/usersController');

router.get('/pending-students', getPendingStudents);
router.get('/students', getStudents);
router.get('/teachers', getTeachers);
router.put('/approve', approveStudent);
router.put('/role', changeUserRole);
router.get('/groups', getGroups);
router.post('/groups', createGroup);
router.put('/group', updateUserGroup);
router.get('/gradebook', getGradebook);

module.exports = router;