const { Client } = require('pg');
const path = require('path');
const fs = require('fs').promises;

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

const ARTICLES_DIR = path.join(__dirname, '../../../uploads/articles');

async function ensureUploadDir() {
    try {
        await fs.mkdir(ARTICLES_DIR, { recursive: true });
    } catch (error) {
        console.error('Ошибка создания папки статей:', error);
    }
}
ensureUploadDir();

/*
 * GET /api/v1/admin/ebook/chapters
 */
async function getChapters(req, res) {
    const client = getDbClient();

    try {
        await client.connect();

        const chaptersRes = await client.query(`
            SELECT c.id, c.title, c."order", c.created_at,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', a.id,
                               'title', a.title,
                               'order', a."order",
                               'contentPath', a.content_path
                           ) ORDER BY a."order" ASC
                       ) FILTER (WHERE a.id IS NOT NULL), '[]'
                   ) as lessons
            SELECT_FROM_CHAPTERS
            FROM "theory_chapters" c
            LEFT JOIN "theory_articles" a ON c.id = a.chapter_id
            GROUP BY c.id
            ORDER BY c."order" ASC;
        `.replace('SELECT_FROM_CHAPTERS', ''));

        return res.json({ status: 'success', chapters: chaptersRes.rows });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * POST /api/v1/admin/ebook/chapters
 */
async function createChapter(req, res) {
    const { title } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const maxOrderRes = await client.query('SELECT COALESCE(MAX("order"), 0) + 1 as next_order FROM "theory_chapters";');
        const nextOrder = maxOrderRes.rows[0].next_order;

        const result = await client.query(`
            INSERT INTO "theory_chapters" (id, title, "order")
            VALUES (gen_random_uuid()::text, $1, $2)
            RETURNING id, title, "order";
        `, [title, nextOrder]);

        return res.json({ status: 'success', chapter: result.rows[0] });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * PUT /api/v1/admin/ebook/chapters/:id
 */
async function updateChapter(req, res) { 
    const { id } = req.params;
    const { title, order } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        await client.query(`
            UPDATE "theory_chapters"
            SET title = COALESCE($1, title),
                "order" = COALESCE($2, "order")
            WHERE id = $3;
        `, [title, order, id]);

        return res.json({ status: 'success', message: 'Глава обновлена' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * DELETE /api/v1/admin/ebook/chapters/:id
 */
async function deleteChapter(req, res) {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        await client.query('DELETE FROM "theory_chapters" WHERE id = $1;', [id]);

        return res.json({ status: 'success', message: 'Глава удалена' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * GET /api/v1/admin/ebook/lessons/:id
 */
async function getLessonById(req, res) {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query('SELECT * FROM "theory_articles" WHERE id = $1;', [id]);
        if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Страница не найдена' });

        const lesson = result.rows[0];
        
        let htmlContent = '';
        if (lesson.content_path) {
            const fullPath = path.join(ARTICLES_DIR, path.basename(lesson.content_path));
            try {
                htmlContent = await fs.readFile(fullPath, 'utf-8');
            } catch (e) {
                htmlContent = '# Файл страницы не найден на диске';
            }
        }

        return res.json({
            status: 'success',
            lesson: {
                ...lesson,
                content: htmlContent
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * POST /api/v1/admin/ebook/lessons
 */
async function createLesson(req, res) {
    const { chapterId, title } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const maxOrderRes = await client.query(
            'SELECT COALESCE(MAX("order"), 0) + 1 as next_order FROM "theory_articles" WHERE chapter_id = $1;',
            [chapterId]
        );
        const nextOrder = maxOrderRes.rows[0].next_order;

        const lessonId = require('crypto').randomUUID();
        const fileName = `lesson_${lessonId}.md`;
        const relativePath = `/uploads/articles/${fileName}`;
        const fullFilePath = path.join(ARTICLES_DIR, fileName);

        const initialHtml = `<h2>${title}</h2>\n<p>Введите теоретический материал статьи...</p>`;        
        await fs.writeFile(fullFilePath, initialHtml, 'utf-8');

        await client.query(`
            INSERT INTO "theory_articles" (id, chapter_id, title, content_path, widgets_config, "order")
            VALUES ($1, $2, $3, $4, $5::jsonb, $6);
        `, [lessonId, chapterId, title, relativePath, JSON.stringify([]), nextOrder]);

        return res.json({ status: 'success', lessonId });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * PUT /api/v1/admin/ebook/lessons/:id
 */
async function updateLesson(req, res) {
    const { id } = req.params;
    const { title, order, content, widgetsConfig } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const artRes = await client.query('SELECT content_path FROM "theory_articles" WHERE id = $1;', [id]);
        if (artRes.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Страница не найдена' });

        const contentPath = artRes.rows[0].content_path;
        const fileName = path.basename(contentPath);
        const fullFilePath = path.join(ARTICLES_DIR, fileName);

        await fs.writeFile(fullFilePath, content || '', 'utf-8');

        const widgetsJsonString = typeof widgetsConfig === 'string' ? widgetsConfig : JSON.stringify(widgetsConfig || []);

        await client.query(`
            UPDATE "theory_articles"
            SET title = $1, "order" = $2, widgets_config = $3::jsonb
            WHERE id = $4;
        `, [title, order, widgetsJsonString, id]);

        return res.json({ status: 'success', message: 'Страница успешно сохранена' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * DELETE /api/v1/admin/ebook/lessons/:id
 */
async function deleteLesson(req, res) {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const artRes = await client.query('SELECT content_path FROM "theory_articles" WHERE id = $1;', [id]);
        
        if (artRes.rows.length > 0 && artRes.rows[0].content_path) {
            const fileName = path.basename(artRes.rows[0].content_path);
            const fullFilePath = path.join(ARTICLES_DIR, fileName);

            await fs.unlink(fullFilePath).catch(() => {});
        }

        await client.query('DELETE FROM "theory_articles" WHERE id = $1;', [id]);

        return res.json({ status: 'success', message: 'Страница удалена' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

module.exports = {
    getChapters,
    createChapter,
    updateChapter,
    deleteChapter,
    getLessonById,
    createLesson,
    updateLesson,
    deleteLesson
};