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
    const userId = req.user?.id;
    const client = getDbClient();

    try {
        await client.connect();

        const query = `
            SELECT 
                c.id as chapter_id,
                c.title as chapter_title,
                c."order" as chapter_order,
                a.id as lesson_id,
                a.title as lesson_title,
                a."order" as lesson_order,
                CASE WHEN tp.id IS NOT NULL THEN TRUE ELSE FALSE END as is_completed
            FROM "theory_chapters" c
            LEFT JOIN "theory_articles" a ON c.id = a.chapter_id
            LEFT JOIN "theory_progress" tp ON a.id = tp.article_id AND tp.user_id = $1
            ORDER BY c."order" ASC, a."order" ASC;
        `;

        const result = await client.query(query, [userId || null]);

        const chaptersMap = new Map();
        let totalLessons = 0;
        let totalCompleted = 0;

        result.rows.forEach(row => {
            if (!row.chapter_id) return;

            if (!chaptersMap.has(row.chapter_id)) {
                chaptersMap.set(row.chapter_id, {
                    id: row.chapter_id,
                    title: row.chapter_title,
                    order: row.chapter_order,
                    lessons: [],
                    completedCount: 0,
                    totalCount: 0,
                    progressPercent: 0
                });
            }

            const chapter = chaptersMap.get(row.chapter_id);

            if (row.lesson_id) {
                chapter.totalCount++;
                totalLessons++;

                if (row.is_completed) {
                    chapter.completedCount++;
                    totalCompleted++;
                }

                chapter.lessons.push({
                    id: row.lesson_id,
                    title: row.lesson_title,
                    order: row.lesson_order,
                    isCompleted: row.is_completed
                });
            }
        });

        const chapters = Array.from(chaptersMap.values()).map(ch => {
            ch.progressPercent = ch.totalCount > 0 
                ? Math.round((ch.completedCount / ch.totalCount) * 100) 
                : 0;
            return ch;
        });

        const overallProgress = totalLessons > 0 
            ? Math.round((totalCompleted / totalLessons) * 100) 
            : 0;

        return res.json({
            status: 'success',
            overallProgress,
            totalLessons,
            totalCompleted,
            chapters
        });
    } catch (error) {
        console.error('Ошибка получения оглавления:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/**
 * GET /api/v1/ebook/lessons/:id
 */
async function getLessonById(req, res) {
    const { id } = req.params;
    const userId = req.user?.id;
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
                c.title as chapter_title,
                CASE 
                    WHEN tp.id IS NOT NULL AND tp.completed = TRUE THEN TRUE 
                    ELSE FALSE 
                END as is_completed
            FROM "theory_articles" a
            JOIN "theory_chapters" c ON a.chapter_id = c.id
            LEFT JOIN "theory_progress" tp ON a.id = tp.article_id AND tp.user_id = $1
            WHERE a.id = $2;
        `;

        const result = await client.query(query, [userId || null, id]);
        const article = result.rows[0];

        if (!article) {
            return res.status(404).json({ status: 'error', message: 'Страница не найдена' });
        }

        let htmlContent = '';
        if (article.content_path) {
            const cleanPath = article.content_path.replace(/^(\.\/|\/)+/, '');

            const projectRoot = path.resolve(__dirname, '../../..');

            const absolutePath = path.join(projectRoot, 'backend', cleanPath);
            
            try {
                htmlContent = await fs.readFile(absolutePath, 'utf8');
            } catch (error) {
                console.error(error);
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
                widgets: article.widgets_config || [],
                isCompleted: article.is_completed
            }
        });

    } catch (error) {
        console.error(`Ошибка получения страницы ${id}:`, error);
        return res.status(500).json({ status: 'error', message: 'Ошибка сервера при получении страницы' });
    } finally {
        await client.end();
    }
};

/**
 * POST /api/v1/ebook/lessons/:id/progress
 */
async function updateLessonProgress(req, res) {
    const { id } = req.params;
    const userId = req.user?.id;
    const { completed } = req.body;

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Необходима авторизация' });
    }

    const client = getDbClient();

    try {
        await client.connect();

        if (completed !== false) {
            await client.query(`
                INSERT INTO "theory_progress" (id, user_id, article_id, completed)
                VALUES (gen_random_uuid(), $1, $2, TRUE)
                ON CONFLICT (user_id, article_id) DO UPDATE SET completed = TRUE;
            `, [userId, id]);
        } else {
            await client.query(`
                DELETE FROM "theory_progress" WHERE user_id = $1 AND article_id = $2;
            `, [userId, id]);
        }

        return res.json({ status: 'success', isCompleted: completed !== false });
    } catch (error) {
        console.error('Ошибка сохранения прогресса:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

module.exports = {
    getAllLessons,
    getLessonById,
    updateLessonProgress
};