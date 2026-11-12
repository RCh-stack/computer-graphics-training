const express = require('express');
const router = express.Router();

const { authenticateToken, requireRole } = require('../../services/jwt');

const usersRouter = require('./users');
const testsRouter = require('./tests');
const labsRouter = require('./labs');
const submissionsRouter = require('./submissions');
const ebookRouter = require('./ebook');

router.use(authenticateToken, requireRole(['TEACHER', 'ADMIN']));

router.use('/users', usersRouter);
router.use('/tests', testsRouter);
router.use('/labs', labsRouter);
router.use('/submissions', submissionsRouter);
router.use('/ebook', ebookRouter);

module.exports = router;