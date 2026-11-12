const { z } = require('zod');
const AppError = require('../utils/appError');

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
            return next(
                new AppError(
                    validationErrors[0].message,
                    400,
                    'VALIDATION_ERROR',
                    validationErrors
                )
            );
        }

        next();
    };
}

module.exports = { validate };