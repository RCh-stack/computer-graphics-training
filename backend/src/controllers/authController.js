const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { JWT_SECRET } = require('../services/jwt');
const { sendResetCodeEmail } = require('../utils/mailer');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/*
 * POST /api/v1/auth/login
 */
const login = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new AppError('Введите email и пароль', 400, 'MISSING_CREDENTIALS');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            `SELECT id, email, "password_hash", "first_name", "last_name", role, "group_id", "is_approved" 
             FROM users WHERE email = $1 LIMIT 1;`,
            [email.trim().toLowerCase()]
        );

        const user = result.rows[0];

        if (!user) {
            throw new AppError('Неверный email или пароль', 401, 'INVALID_CREDENTIALS');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new AppError('Неверный email или пароль', 401, 'INVALID_CREDENTIALS');
        }

        if (user.role === 'STUDENT' && !user.is_approved) {
            const pendingErr = new AppError(
                'Вашему аккаунту еще не предоставлен доступ. Обратитесь к администратору',
                403,
                'ACCOUNT_PENDING_APPROVAL'
            );
            pendingErr.status = 'pending_approval';
            throw pendingErr;
        }

        const tokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
            groupId: user.group_id,
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        return res.json({
            status: 'success',
            message: 'Успешный вход',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                groupId: user.group_id,
            },
        });
    } finally {
        await client.end();
    }
});

/*
 * POST /api/v1/auth/register
 */
const register = catchAsync(async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        throw new AppError('Заполните все обязательные поля', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const client = getDbClient();

    try {
        await client.connect();

        const existing = await client.query('SELECT id FROM "users" WHERE email = $1;', [normalizedEmail]);

        if (existing.rows.length > 0) {
            throw new AppError('Пользователь с таким email уже зарегистрирован', 409, 'DUPLICATE_EMAIL');
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await client.query(
            `INSERT INTO "users" (id, first_name, last_name, email, password_hash, role, is_approved, created_at) 
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 'STUDENT', false, NOW());`,
            [firstName.trim(), lastName.trim(), normalizedEmail, passwordHash]
        );

        return res.status(201).json({ status: 'success', message: 'Заявка отправлена на рассмотрение' });
    } finally {
        await client.end();
    }
});

/*
 * POST /api/v1/auth/request-reset
 */
const requestResetCode = catchAsync(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new AppError('Укажите e-mail', 400, 'MISSING_EMAIL');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const client = getDbClient();
    let targetEmail = null;
    let resetCode = null;

    try {
        await client.connect();

        const userRes = await client.query('SELECT id, email FROM "users" WHERE email = $1;', [normalizedEmail]);
        if (userRes.rows.length === 0) {
            return res.json({
                status: 'success',
                message: 'Если такой e-mail зарегистрирован, на него отправлен код восстановления'
            });
        }

        const user = userRes.rows[0];
        targetEmail = user.email;
        resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await client.query(`
            UPDATE "users" 
            SET "reset_code" = $1, "reset_code_expires" = $2 
            WHERE id = $3;
        `, [resetCode, expiresAt, user.id]);
    } finally {
        await client.end();
    }

    try {
        await sendResetCodeEmail(targetEmail, resetCode);
    } catch (mailErr) {
        console.error('[ERROR] Ошибка SMTP при отправке кода восстановления:', mailErr);
        throw new AppError('Не удалось отправить письмо с кодом. Попробуйте позже.', 500, 'EMAIL_SEND_FAILED');
    }

    return res.json({
        status: 'success',
        message: 'Код подтверждения успешно отправлен на ваш e-mail'
    });
});

/*
 * POST /api/v1/auth/reset-password
 */
const resetPassword = catchAsync(async (req, res) => {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
        throw new AppError('Укажите e-mail, код подтверждения и новый пароль', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const client = getDbClient();

    try {
        await client.connect();

        const userRes = await client.query(
            'SELECT id FROM "users" WHERE email = $1 AND reset_code = $2 AND reset_code_expires > NOW();',
            [normalizedEmail, String(code).trim()]
        );

        if (userRes.rows.length === 0) {
            throw new AppError('Неверный или просроченный код', 400, 'INVALID_OR_EXPIRED_CODE');
        }

        const newHash = await bcrypt.hash(newPassword, 10);

        await client.query(
            'UPDATE "users" SET password_hash = $1, reset_code = NULL, reset_code_expires = NULL WHERE email = $2;',
            [newHash, normalizedEmail]
        );

        return res.json({ status: 'success', message: 'Пароль успешно обновлен' });
    } finally {
        await client.end();
    }
});

module.exports = {
    login,
    register,
    requestResetCode,
    resetPassword
};