const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

router.get('/manifest', testController.getManifest);

router.get('/:id', testController.getTestById);

router.post('/:id/verify', testController.verifyTest);

module.exports = router;