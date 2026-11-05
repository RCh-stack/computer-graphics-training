const { Client } = require('pg');
const { sendGlobalNotification } = require('../services/notification');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * GET /api/v1/news
 */
async function getNewsFeed(req, res) {
    const userId = req.user ? req.user.id : null;
    const client = getDbClient();

    try {
        await client.connect();

        const query = `
            SELECT 
                n.id,
                n.user_id,
                n.title,
                n.message,
                n.type,
                n.link,
                n.is_read,
                n.created_at,
                u.first_name AS author_name
            FROM "notifications" n
            LEFT JOIN "users" u ON n.created_by = u.id
            WHERE n.user_id = $1 OR n.user_id IS NULL
            ORDER BY n.created_at DESC
            LIMIT 30;
        `;

        const result = await client.query(query, [userId]);
        return res.json({ status: 'success', news: result.rows });
    } catch (error) {
        console.error('Ошибка получения новостей:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/**
 * POST /api/v1/news
 */
async function postAnnouncement(req, res) {
    const { title, message, link } = req.body;
    const authorId = req.user.id;

    if (!title || !message) {
        return res.status(400).json({ status: 'error', message: 'Заголовок и текст обязательны' });
    }

    try {
        await sendGlobalNotification({
            title,
            message,
            type: 'ANNOUNCEMENT',
            link,
            createdBy: authorId
        });

        return res.json({ status: 'success', message: 'Объявление успешно опубликовано' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

module.exports = {
    getNewsFeed,
    postAnnouncement
};