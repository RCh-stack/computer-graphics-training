const express = require('express');
const router = express.Router();

const {
    getLabSubmissions,
    reviewLabSubmission,
    getTestSubmissions,
    getTheoryGradebook
} = require('../../controllers/admin/submissionController');

const { validate } = require('../../services/validator');
const { reviewSubmissionSchema } = require('../../validators/labValidator');

router.get('/labs', getLabSubmissions);
router.put('/labs/:id/review', validate({ body: reviewSubmissionSchema }), reviewLabSubmission);
router.get('/tests', getTestSubmissions);
router.get('/ebook', getTheoryGradebook);

module.exports = router;