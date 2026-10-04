const { Client } = require('pg');
const path = require('path');
const fs = require('fs').promises;

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * GET /api/v1/ebook/lessons
 */
async function getAllLessons(req, res) {
    const client = getDbClient();

    try {
        await client.connect();

        const query = `
            SELECT 
                c.id AS chapter_id,
                c.title AS chapter_title,
                c.order AS chapter_order,
                a.id AS article_id,
                a.title AS article_title,
                a.order AS article_order
            FROM "theory_chapters" c
            LEFT JOIN "theory_articles" a ON c.id = a.chapter_id
            ORDER BY c.order ASC, a.order ASC;
        `;

        const result = await client.query(query);

        const chaptersMap = new Map();

        result.rows.forEach(row => {
            if (!chaptersMap.has(row.chapter_id)) {
                chaptersMap.set(row.chapter_id, {
                    id: row.chapter_id,
                    title: row.chapter_title,
                    order: row.chapter_order,
                    lessons: []
                });
            }

            if (row.article_id) {
                chaptersMap.get(row.chapter_id).lessons.push({
                    id: row.article_id,
                    title: row.article_title,
                    order: row.article_order
                });
            }
        });

        const chapters = Array.from(chaptersMap.values());

        return res.json({ status: 'success', chapters });
    } catch (error) {
        console.error('Ошибка получения оглавления учебника:', error);
        return res.status(500).json({ status: 'error', message: 'Ошибка сервера при получении манифеста' });
    } finally {
        await client.end();
    }
}

/**
 * GET /api/v1/ebook/lessons/:id
 */
async function getLessonById(req, res) {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const query = `
            SELECT 
                a.id, 
                a.title, 
                a.content_path, 
                a.widgets_config, 
                a.order,
                c.title AS chapter_title
            FROM "theory_articles" a
            JOIN "theory_chapters" c ON a.chapter_id = c.id
            WHERE a.id = $1 
            LIMIT 1;
        `;

        const result = await client.query(query, [id]);
        const article = result.rows[0];

        if (!article) {
            return res.status(404).json({ status: 'error', message: 'Урок не найден' });
        }

        let htmlContent = '';
        if (article.content_path) {
            let cleanPath = article.content_path.replace(/^(\.\/|\/)+/, '');

            const projectRoot = path.resolve(__dirname, '../../..');

            const absolutePath = path.join(projectRoot, 'frontend', cleanPath);
            
            try {
                htmlContent = await fs.readFile(absolutePath, 'utf8');
            } catch (err) {
                //console.warn(`Файл контента не найден по пути: ${absolutePath}`);
                console.error(err);
                htmlContent = '<div class="alert alert-warning">Содержимое страницы временно недоступно.</div>';
            }
        }

        return res.json({
            status: 'success',
            lesson: {
                id: article.id,
                title: article.title,
                chapterTitle: article.chapter_title,
                html: htmlContent,
                widgets: article.widgets_config || []
            }
        });

    } catch (error) {
        console.error(`Ошибка получения урока ${id}:`, error);
        return res.status(500).json({ status: 'error', message: 'Ошибка сервера при получении урока' });
    } finally {
        await client.end();
    }
};

module.exports = {
    getAllLessons,
    getLessonById,
};