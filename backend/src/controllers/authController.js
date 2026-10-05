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
        console.error('Ошибка авторизации:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    } finally {
        await client.end();
    }
}

/*
 * POST /api/v1/auth/registration
 */
async function registration(req, res) {

    const { email, password, firstName, lastName } = req.body;

    if (!email) return res.status(400).json({ error: 'Не указан email' });

    if (!password) return res.status(400).json({ error: 'Пароль не может быть пустым' });

    if (!firstName || lastName) return res.status(400).json({ error: 'Не указаны фамилия и/или имя' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            `INSERT INTO "users" (id, email, passwordHash, firstName, lastName, role, "created_at") 
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, "", NOW());`,
            [email, passwordHash, firstName, lastName]
        );



        return res.json({
            message: 'Успешная регистрация',
            user: {
                email: email,
                firstName: firstName,
                lastName: lastName
            },
        });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    } finally {
        await client.end();
    }
}

module.exports = {
    login,
    registration
};