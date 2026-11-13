const { z } = require('zod');

const codeSchema = z.string({ required_error: 'Введите 6-значный код' })
    .trim()
    .regex(/^\d{6}$/, 'Код должен состоять ровно из 6 цифр');

const loginSchema = z.object({
    email: z.email('Некорректный формат email'),
    password: z.string().min(1, 'Введите пароль'),
    deviceToken: z.string().trim().optional().nullable()
});

const verify2FASchema = z.object({
    tempToken: z.string().min(1, 'Отсутствует временный токен сессии'),
    code: codeSchema,
    rememberDevice: z.boolean().optional().default(false)
});

const enable2FASchema = z.object({
    code: codeSchema
});

const disable2FASchema = z.object({
    password: z.string().min(1, 'Введите текущий пароль для отключения 2FA')
});

module.exports = {
    loginSchema,
    verify2FASchema,
    enable2FASchema,
    disable2FASchema
};