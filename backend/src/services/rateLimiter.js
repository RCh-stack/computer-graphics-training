const rateLimit = require('express-rate-limit');

function createLimitHandler(customMessage) {
    return (req, res) => {
        res.status(429).json({
            status: 'error',
            code: 'TOO_MANY_REQUESTS',
            message: customMessage
        });
    };
}

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: createLimitHandler(
        'Слишком много неудачных попыток входа. Повторите попытку через 15 минут.'
    )
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: createLimitHandler(
        'Превышен лимит запросов на восстановление пароля. Попробуйте снова через 30 минут.'
    )
});

const compilerLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: createLimitHandler(
        'Слишком частая отправка кода на выполнение. Подождите минуту.'
    )
});

module.exports = {
    loginLimiter,
    forgotPasswordLimiter,
    compilerLimiter
};