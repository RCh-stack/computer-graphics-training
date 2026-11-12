const express = require('express');
const router = express.Router();

const {
    getAllTests,
    getTestById,
    createTest,
    updateTest,
    deleteTest
} = require('../../controllers/admin/testController');

const { validate } = require('../../services/validator');
const { saveTestSchema } = require('../../validators/testValidator');

router.get('/', getAllTests);
router.get('/:id', getTestById);
router.post('/', createTest);
router.put('/:id', validate({ body: saveTestSchema }), updateTest);
router.delete('/:id', deleteTest);

module.exports = router;