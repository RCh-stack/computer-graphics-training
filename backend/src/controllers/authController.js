const { Client } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const { JWT_SECRET } = require('../services/jwt');
const { sendResetCodeEmail } = require('../utils/mailer');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { generateSecret, verifyTOTP, buildKeyUri } = require('../utils/totp');

const APP_ISSUER = 'VirtualLab Edu';
const TRUSTED_DEVICE_DAYS = 7;

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

function hashDeviceToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function signAccessToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            groupId: user.group_id,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function formatUserResponse(user) {
    return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        groupId: user.group_id,
        is2faEnabled: Boolean(user.is_2fa_enabled),
    };
}

/*
 * POST /api/v1/auth/login
 */
const login = catchAsync(async (req, res) => {
    const { email, password, deviceToken } = req.body;

    if (!email || !password) {
        throw new AppError('Введите email и пароль', 400, 'MISSING_CREDENTIALS');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            `SELECT id, email, password_hash, first_name, last_name, role, group_id, is_approved, is_2fa_enabled
             FROM "users" WHERE email = $1 LIMIT 1;`,
            [email.trim().toLowerCase()]
        );

        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
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

        if (user.is_2fa_enabled) {
            let isTrustedDevice = false;

            if (deviceToken) {
                const tokenHash = hashDeviceToken(deviceToken);
                const deviceRes = await client.query(
                    `SELECT id FROM "trusted_devices"
                     WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()
                     LIMIT 1;`,
                    [user.id, tokenHash]
                );

                if (deviceRes.rows.length > 0) {
                    isTrustedDevice = true;
                }
            }

            if (!isTrustedDevice) {
                const tempToken = jwt.sign(
                    { id: user.id, purpose: '2fa_verify' },
                    JWT_SECRET,
                    { expiresIn: '5m' }
                );

                return res.json({
                    status: '2fa_required',
                    message: 'Введите 6-значный код из приложения-аутентификатора',
                    tempToken,
                });
            }
        }

        const token = signAccessToken(user);

        return res.json({
            status: 'success',
            message: 'Успешный вход',
            token,
            user: formatUserResponse(user),
        });
    } finally {
        await client.end();
    }
});

/*
 * POST /api/v1/auth/2fa/verify
 */
const verify2FA = catchAsync(async (req, res) => {
    const { tempToken, code, rememberDevice } = req.body;

    let decoded;
    try {
        decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
        throw new AppError('Сессия подтверждения истекла. Выполните вход заново.', 401, 'TEMP_TOKEN_EXPIRED');
    }

    if (decoded.purpose !== '2fa_verify' || !decoded.id) {
        throw new AppError('Некорректный токен подтверждения.', 401, 'INVALID_TEMP_TOKEN');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const userRes = await client.query(
            `SELECT id, email, first_name, last_name, role, group_id, is_approved, is_2fa_enabled, two_factor_secret
             FROM "users" WHERE id = $1 LIMIT 1;`,
            [decoded.id]
        );

        const user = userRes.rows[0];

        if (!user || !user.is_approved) {
            throw new AppError('Учетная запись не найдена или заблокирована.', 401, 'ACCOUNT_DISABLED');
        }

        if (!user.is_2fa_enabled || !user.two_factor_secret) {
            throw new AppError('Двухфакторная аутентификация не настроена для этого аккаунта.', 400, '2FA_NOT_ENABLED');
        }

        const isValid = verifyTOTP({
            token: String(code).trim(),
            secret: user.two_factor_secret,
            window: 1
        });

        if (!isValid) {
            throw new AppError('Неверный код подтверждения.', 401, 'INVALID_2FA_CODE');
        }

        let newDeviceToken = null;

        if (rememberDevice) {
            await client.query(
                `DELETE FROM "trusted_devices" WHERE user_id = $1 AND expires_at <= NOW();`,
                [user.id]
            );

            newDeviceToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = hashDeviceToken(newDeviceToken);
            const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);
            const userAgent = String(req.headers['user-agent'] || '').slice(0, 255);

            await client.query(
                `INSERT INTO "trusted_devices" (id, user_id, token_hash, user_agent, expires_at)
                 VALUES (gen_random_uuid()::text, $1, $2, $3, $4);`,
                [user.id, tokenHash, userAgent, expiresAt]
            );
        }

        const token = signAccessToken(user);

        return res.json({
            status: 'success',
            message: 'Успешный вход',
            token,
            ...(newDeviceToken && { deviceToken: newDeviceToken }),
            user: formatUserResponse(user),
        });
    } finally {
        await client.end();
    }
});

/*
 * POST /api/v1/auth/2fa/setup
 */
const setup2FA = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const client = getDbClient();

    try {
        await client.connect();

        const userRes = await client.query(
            `SELECT email, is_2fa_enabled FROM "users" WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];

        if (!user) {
            throw new AppError('Пользователь не найден', 404, 'USER_NOT_FOUND');
        }

        if (user.is_2fa_enabled) {
            throw new AppError('Двухфакторная аутентификация уже включена', 400, '2FA_ALREADY_ENABLED');
        }

        const secret = generateSecret();
        const otpauthUrl = buildKeyUri(user.email, APP_ISSUER, secret);
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

        await client.query(
            `UPDATE "users" SET two_factor_secret = $1 WHERE id = $2;`,
            [secret, userId]
        );

        return res.json({
            status: 'success',
            qrCode: qrCodeDataUrl,
            secret,
        });
    } finally {
        await client.end();
    }
});

/*
 * POST /api/v1/auth/2fa/enable
 * Активация 2FA после подтверждения первым 6-значным кодом из приложения
 */
const enable2FA = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { code } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const userRes = await client.query(
            `SELECT is_2fa_enabled, two_factor_secret FROM "users" WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];

        if (!user || !user.two_factor_secret) {
            throw new AppError('Сначала сгенерируйте QR-код настройки 2FA', 400, '2FA_SETUP_REQUIRED');
        }

        const isValid = verifyTOTP({
            token: String(code).trim(),
            secret: user.two_factor_secret,
            window: 1
        });

        if (!isValid) {
            throw new AppError('Неверный код. Проверьте время на устройстве и повторите попытку.', 400, 'INVALID_2FA_CODE');
        }

        await client.query(
            `UPDATE "users" SET is_2fa_enabled = TRUE WHERE id = $1;`,
            [userId]
        );

        return res.json({
            status: 'success',
            message: 'Двухфакторная аутентификация успешно включена',
        });
    } finally {
        await client.end();
    }
});

/*
 * POST /api/v1/auth/2fa/disable
 */
const disable2FA = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { password } = req.body;
    const client = getDbClient();

    try {
        await client.connect();
        await client.query('BEGIN');

        const userRes = await client.query(
            `SELECT password_hash FROM "users" WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            throw new AppError('Неверный пароль', 401, 'INVALID_PASSWORD');
        }

        await client.query(
            `UPDATE "users" SET is_2fa_enabled = FALSE, two_factor_secret = NULL WHERE id = $1;`,
            [userId]
        );

        await client.query(`DELETE FROM "trusted_devices" WHERE user_id = $1;`, [userId]);

        await client.query('COMMIT');

        return res.json({
            status: 'success',
            message: 'Двухфакторная аутентификация отключена',
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
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
    const userId = req.user.id;
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

        await client.query('DELETE FROM "trusted_devices" WHERE user_id = $1;', [userId]);

        return res.json({ status: 'success', message: 'Пароль успешно обновлен' });
    } finally {
        await client.end();
    }
});

module.exports = {
    login,
    verify2FA,
    setup2FA,
    enable2FA,
    disable2FA,
    register,
    requestResetCode,
    resetPassword
};