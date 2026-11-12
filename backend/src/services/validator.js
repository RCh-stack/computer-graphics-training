const { z } = require('zod');

/**
 * @param {{ body?: z.ZodType, params?: z.ZodType, query?: z.ZodType }} schemas
 */
function validate(schemas) {
    return (req, res, next) => {
        const validationErrors = [];

        for (const key of ['params', 'query', 'body']) {
            if (!schemas[key]) continue;

            const result = schemas[key].safeParse(req[key]);

            if (!result.success) {
                result.error.issues.forEach(issue => {
                    validationErrors.push({
                        location: key,
                        field: issue.path.join('.'),
                        message: issue.message
                    });
                });
            } else {
                req[key] = result.data;
            }
        }

        if (validationErrors.length > 0) {
            return res.status(400).json({
                status: 'error',
                code: 'VALIDATION_ERROR',
                message: validationErrors[0].message,
                errors: validationErrors
            });
        }

        next();
    };
}

module.exports = { validate };