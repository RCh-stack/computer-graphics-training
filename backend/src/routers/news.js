const express = require('express');
const router = express.Router();

const {
    getNewsFeed,
    postAnnouncement,
    dismissNotification,
    dismissAllNotifications
} = require('../controllers/newsController');

const { authenticateToken, requireRole } = require('../services/jwt');

router.get('/', authenticateToken, getNewsFeed);
router.post('/', authenticateToken, requireRole(['TEACHER', 'ADMIN']), postAnnouncement);
router.delete('/', authenticateToken, dismissAllNotifications);
router.delete('/:id', authenticateToken, dismissNotification);

module.exports = router;