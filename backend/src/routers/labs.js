const express = require('express');
const router = express.Router();
const labController = require('../controllers/labController');

// Получить список всех лабораторных
router.get('/', labController.getAllLabs);

// Получить конкретную лабораторную по ID
router.get('/:id', labController.getLabById);

// Запустить юнит-тесты над кодом
router.post('/run', labController.runTests);

// Итоговая сдача работы
router.post('/submit', labController.submitLab);

module.exports = router;