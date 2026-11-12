const { Client } = require('pg');
const { sendGlobalNotification } = require('../services/notification');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * GET /api/v1/news
 */
const getNewsFeed = catchAsync(async (req, res) => {
    const userId = req.user?.id;
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
            WHERE (n.user_id = $1 OR n.user_id IS NULL)
              AND NOT EXISTS (
                  SELECT 1 
                  FROM "notification_dismissals" nd
                  WHERE nd.notification_id = n.id 
                    AND nd.user_id = $1
              )
            ORDER BY n.created_at DESC
            LIMIT 30;
        `;

        const result = await client.query(query, [userId || null]);
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

/**
 * DELETE /api/v1/news/:id
 */
const dismissNotification = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Необходима авторизация', 401, 'UNAUTHORIZED');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const checkRes = await client.query(
            `SELECT id, user_id FROM "notifications" WHERE id = $1 LIMIT 1;`,
            [id]
        );
        const notification = checkRes.rows[0];

        if (!notification || (notification.user_id !== null && notification.user_id !== userId)) {
            throw new AppError('Уведомление не найдено', 404, 'NOTIFICATION_NOT_FOUND');
        }

        if (notification.user_id === userId) {
            await client.query(`DELETE FROM "notifications" WHERE id = $1;`, [id]);
        } else {
            await client.query(`
                INSERT INTO "notification_dismissals" (user_id, notification_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, notification_id) DO NOTHING;
            `, [userId, id]);
        }

        return res.json({
            status: 'success',
            message: 'Уведомление убрано из ленты'
        });
    } finally {
        await client.end();
    }
});

/**
 * DELETE /api/v1/news
 */
const dismissAllNotifications = catchAsync(async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
        throw new AppError('Необходима авторизация', 401, 'UNAUTHORIZED');
    }

    const client = getDbClient();

    try {
        await client.connect();
        await client.query('BEGIN');

        await client.query(`DELETE FROM "notifications" WHERE user_id = $1;`, [userId]);

        await client.query(`
            INSERT INTO "notification_dismissals" (user_id, notification_id)
            SELECT $1, id FROM "notifications" WHERE user_id IS NULL
            ON CONFLICT (user_id, notification_id) DO NOTHING;
        `, [userId]);

        await client.query('COMMIT');

        return res.json({
            status: 'success',
            message: 'Лента уведомлений очищена'
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        await client.end();
    }
});

module.exports = {
    getNewsFeed,
    postAnnouncement,
    dismissNotification,
    dismissAllNotifications
};