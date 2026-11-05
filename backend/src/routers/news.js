const express = require('express');
const router = express.Router();

const { getNewsFeed, postAnnouncement } = require('../controllers/newsController');
const { authenticateToken } = require('../services/jwt');

router.get('/', authenticateToken, getNewsFeed);

router.post('/', authenticateToken, postAnnouncement);

module.exports = router;