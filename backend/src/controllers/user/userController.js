const { Client } = require('pg');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * GET /api/v1/users/profile
 */
const loadProfile = catchAsync(async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Пользователь не авторизован', 401, 'UNAUTHORIZED');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            `SELECT id, email, "first_name", "last_name", role, "group_id" 
             FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );

        const user = result.rows[0];

        if (!user) {
            throw new AppError('Пользователь не найден', 404, 'USER_NOT_FOUND');
        }

        return res.json({ status: 'success', user });
    } finally {
        await client.end();
    }
});

/**
 * PUT /api/v1/users/profile
 */
const updateProfile = catchAsync(async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Пользователь не авторизован', 401, 'UNAUTHORIZED');
    }

    const firstName = req.body.firstName ?? req.body.first_name;
    const lastName = req.body.lastName ?? req.body.last_name;

    if (!firstName?.trim() || !lastName?.trim()) {
        throw new AppError('Укажите имя и фамилию', 400, 'MISSING_PROFILE_FIELDS');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            'UPDATE "users" SET "first_name" = $1, "last_name" = $2 WHERE id = $3;',
            [firstName.trim(), lastName.trim(), userId]
        );

        if (result.rowCount === 0) {
            throw new AppError('Пользователь не найден', 404, 'USER_NOT_FOUND');
        }

        return res.json({ status: 'success', message: 'Профиль обновлен' });
    } finally {
        await client.end();
    }
});

module.exports = {
    loadProfile,
    updateProfile
};