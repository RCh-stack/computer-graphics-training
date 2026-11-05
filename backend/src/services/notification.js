const { Client } = require('pg');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

async function sendUserNotification({ userId, title, message, type, link = null }) {
    const client = getDbClient();
    try {
        await client.connect();
        await client.query(`
            INSERT INTO "notifications" (user_id, title, message, type, link, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW());
        `, [userId, title, message, type, link]);
    } catch (error) {
        console.error('Ошибка отправки персонального уведомления:', error);
    } finally {
        await client.end();
    }
}

async function sendGlobalNotification({ title, message, type, link = null, createdBy = null }) {
    const client = getDbClient();
    try {
        await client.connect();
        await client.query(`
            INSERT INTO "notifications" (user_id, title, message, type, link, created_by, created_at)
            VALUES (NULL, $1, $2, $3, $4, $5, NOW());
        `, [title, message, type, link, createdBy]);
    } catch (error) {
        console.error('Ошибка отправки глобального уведомления:', error);
    } finally {
        await client.end();
    }
}

module.exports = {
    sendUserNotification,
    sendGlobalNotification
};