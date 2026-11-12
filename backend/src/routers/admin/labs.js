const express = require('express');
const router = express.Router();

const {
    getAllLabs,
    getLabById,
    createLab,
    updateLab,
    deleteLab
} = require('../../controllers/admin/labController');

const { validate } = require('../../services/validator');
const { saveLabSchema } = require('../../validators/labValidator');

router.get('/', getAllLabs);
router.get('/:id', getLabById);
router.post('/', createLab);
router.put('/:id', validate({ body: saveLabSchema }), updateLab);
router.delete('/:id', deleteLab);

module.exports = router;