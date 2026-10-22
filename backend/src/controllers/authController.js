const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../services/jwt');
const { sendResetCodeEmail } = require('../utils/mailer');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/*
 * POST /api/v1/auth/login
 */
async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Введите email и пароль' });
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
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        if (user.role === 'STUDENT' && !user.is_approved) {
            return res.status(403).json({ 
                status: 'pending_approval', 
                message: 'Вашему аккаунту еще не предоставлен доступ. Обратитесь к администратору' 
            });
        }

        const tokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
            groupId: user.groupId,
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        return res.json({
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
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    } finally {
        await client.end();
    }
}

/*
 * POST /api/v1/auth/register
 */
async function register(req, res) {
    const { firstName, lastName, email, password } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const existing = await client.query('SELECT id FROM "users" WHERE email = $1;', [email]);
        
        if (existing.rows.length > 0) {
            return res.status(400).json({ status: 'error', message: 'Пользователь с таким email уже зарегистрирован' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await client.query(
            `INSERT INTO "users" (id, first_name, last_name, email, password_hash, role, is_approved, created_at) 
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 'STUDENT', false, NOW());`,
            [firstName, lastName, email, passwordHash]
        );

        return res.json({ status: 'success', message: 'Заявка отправлена на рассмотрение' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', message: 'Ошибка сервера при регистрации' });
    } finally {
        await client.end();
    }
}

/*
 * POST /api/v1/auth/request-reset
 */
async function requestResetCode(req, res) {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ status: 'error', message: 'Укажите e-mail' });
    }

    const client = getDbClient();

    try {
        await client.connect();

        const userRes = await client.query('SELECT id, email FROM "users" WHERE email = $1;', [email]);
        if (userRes.rows.length === 0) {
            return res.json({ 
                status: 'success', 
                message: 'Если такой e-mail зарегистрирован, на него отправлен код восстановления' 
            });
        }

        const user = userRes.rows[0];

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await client.query(`
            UPDATE "users" 
            SET "reset_code" = $1, "reset_code_expires" = $2 
            WHERE id = $3;
        `, [resetCode, expiresAt, user.id]);

        await sendResetCodeEmail(user.email, resetCode);

        return res.json({ 
            status: 'success', 
            message: 'Код подтверждения успешно отправлен на ваш e-mail' 
        });

    } catch (error) {
        console.error('Ошибка отправки кода восстановления:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Не удалось отправить письмо с кодом. Попробуйте позже.' 
        });
    } finally {
        await client.end();
    }
}

/*
 * POST /api/v1/auth/reset-password
 */
async function resetPassword(req, res) {
    const { email, code, newPassword } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const userRes = await client.query(
            'SELECT * FROM "users" WHERE email = $1 AND reset_code = $2 AND reset_code_expires > NOW();',
            [email, code]
        );

        if (userRes.rows.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Неверный или просроченный код' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);

        await client.query(
            'UPDATE "users" SET password_hash = $1, reset_code = NULL, reset_code_expires = NULL WHERE email = $2;',
            [newHash, email]
        );

        return res.json({ status: 'success', message: 'Пароль успешно обновлен' });
    } catch (error) {
        console.error("Ошибка обновления пароля: ", error);
        return res.status(500).json({ status: 'error', message: 'Ошибка обновления пароля' });
    } finally {
        await client.end();
    }
}

module.exports = {
    login,
    register,
    requestResetCode,
    resetPassword
};