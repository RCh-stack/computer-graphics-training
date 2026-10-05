const { Client } = require('pg');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * GET /api/v1/users/profile
 */
async function loadProfile(req, res) {
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

/**
 * PUT /api/v1/users/profile
 */
async function updateProfile(req, res) {

    const userId = req.user.id;
    const { firstName, lastName } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        await client.query(
            'UPDATE "users" SET "first_name" = $1, "last_name" = $2 WHERE id = $3;',
            [firstName, lastName, userId]
        );
        
        return res.json({ status: 'success', message: 'Профиль обновлен' });
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        return res.status(500).json({ status: 'error', message: 'Ошибка обновления профиля' });
    } finally {
        await client.end();   
    }
}

module.exports = {
    loadProfile,
    updateProfile
};