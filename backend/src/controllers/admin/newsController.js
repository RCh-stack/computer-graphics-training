const { Client } = require('pg');
const { sendGlobalNotification } = require('../../services/notification');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * GET /api/v1/news
 */
const getNewsFeed = catchAsync(async (req, res) => {
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
    } finally {
        await client.end();
    }
});

/**
 * POST /api/v1/news
 */
const postAnnouncement = catchAsync(async (req, res) => {
    const { title, message, link } = req.body;
    const authorId = req.user.id;

    if (!title?.trim() || !message?.trim()) {
        throw new AppError('Заголовок и текст обязательны', 400, 'MISSING_ANNOUNCEMENT_FIELDS');
    }

    await sendGlobalNotification({
        title: title.trim(),
        message: message.trim(),
        type: 'ANNOUNCEMENT',
        link,
        createdBy: authorId
    });

    return res.status(201).json({ status: 'success', message: 'Объявление успешно опубликовано' });
});

module.exports = {
    getNewsFeed,
    postAnnouncement
};