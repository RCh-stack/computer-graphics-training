const express = require('express');
const router = express.Router();
const labController = require('../controllers/labController');

router.get('/', labController.getAllLabs);

router.get('/:id', labController.getLabById);

router.post('/run', labController.runTests);

router.post('/submit', labController.submitLab);

module.exports = router;