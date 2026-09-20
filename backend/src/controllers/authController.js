const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../services/jwt');

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
            `SELECT id, email, "password_hash", "first_name", "last_name", role, "group_id" 
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
        console.error('Ошибка логина:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    } finally {
        await client.end();
    }
}

/**
 * GET /api/v1/auth/me
 */
async function getMe(req, res) {
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            `SELECT id, email, "first_name", "last_name", role, "group_id" 
            FROM users WHERE id = $1 LIMIT 1;`,
            [req.user.id]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        return res.json({ user });
    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    } finally {
        await client.end();
    }
}

module.exports = {
    login,
    getMe,
};