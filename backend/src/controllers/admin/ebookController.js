const { Client } = require('pg');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

const { sendGlobalNotification } = require('../../services/notification');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

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
const getChapters = catchAsync(async (req, res) => {
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
            FROM "theory_chapters" c
            LEFT JOIN "theory_articles" a ON c.id = a.chapter_id
            GROUP BY c.id
            ORDER BY c."order" ASC;
        `);

        return res.json({ status: 'success', chapters: chaptersRes.rows });
    } finally {
        await client.end();
    }
});

/*
 * POST /api/v1/admin/ebook/chapters
 */
const createChapter = catchAsync(async (req, res) => {
    const { title } = req.body;
    const client = getDbClient();
    let createdChapter;

    try {
        await client.connect();

        const maxOrderRes = await client.query(
            'SELECT COALESCE(MAX("order"), 0) + 1 as next_order FROM "theory_chapters";'
        );
        const nextOrder = maxOrderRes.rows[0].next_order;

        const result = await client.query(`
            INSERT INTO "theory_chapters" (id, title, "order")
            VALUES (gen_random_uuid()::text, $1, $2)
            RETURNING id, title, "order";
        `, [title, nextOrder]);

        createdChapter = result.rows[0];
    } finally {
        await client.end();
    }

    try {
        await sendGlobalNotification({
            title: `Новый раздел электронного учебника: ${title}`,
            message: 'Опубликован новый раздел в электронном учебнике.',
            type: 'NEW_CHAPTER',
            link: 'theory/index.html',
            createdBy: req.user.id
        });
    } catch (notifyErr) {
        console.error('[WARN] Не удалось отправить уведомление о новом разделе:', notifyErr.message);
    }

    return res.status(201).json({ status: 'success', chapter: createdChapter });
});

/*
 * PUT /api/v1/admin/ebook/chapters/:id
 */
const updateChapter = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { title, order } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(`
            UPDATE "theory_chapters"
            SET title = COALESCE($1, title),
                "order" = COALESCE($2, "order")
            WHERE id = $3;
        `, [title, order, id]);

        if (result.rowCount === 0) {
            throw new AppError('Глава учебника не найдена', 404, 'CHAPTER_NOT_FOUND');
        }

        return res.json({ status: 'success', message: 'Глава обновлена' });
    } finally {
        await client.end();
    }
});

/*
 * DELETE /api/v1/admin/ebook/chapters/:id
 */
const deleteChapter = catchAsync(async (req, res) => {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query('DELETE FROM "theory_chapters" WHERE id = $1;', [id]);

        if (result.rowCount === 0) {
            throw new AppError('Глава учебника не найдена', 404, 'CHAPTER_NOT_FOUND');
        }

        return res.json({ status: 'success', message: 'Глава удалена' });
    } finally {
        await client.end();
    }
});

/*
 * GET /api/v1/admin/ebook/lessons/:id
 */
const getLessonById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query('SELECT * FROM "theory_articles" WHERE id = $1;', [id]);
        if (result.rows.length === 0) {
            throw new AppError('Страница учебника не найдена', 404, 'LESSON_NOT_FOUND');
        }

        const lesson = result.rows[0];
        let htmlContent = '';

        if (lesson.content_path) {
            const fullPath = path.join(ARTICLES_DIR, path.basename(lesson.content_path));
            try {
                htmlContent = await fs.readFile(fullPath, 'utf-8');
            } catch {
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
    } finally {
        await client.end();
    }
});

/*
 * POST /api/v1/admin/ebook/lessons
 */
const createLesson = catchAsync(async (req, res) => {
    const chapterId = req.body.chapter_id ?? req.body.chapterId;
    const { title } = req.body;
    const client = getDbClient();

    const lessonId = crypto.randomUUID();
    const fileName = `lesson_${lessonId}.md`;
    const relativePath = `/uploads/articles/${fileName}`;
    const fullFilePath = path.join(ARTICLES_DIR, fileName);

    try {
        await client.connect();
        await client.query('BEGIN');

        const maxOrderRes = await client.query(
            'SELECT COALESCE(MAX("order"), 0) + 1 as next_order FROM "theory_articles" WHERE chapter_id = $1;',
            [chapterId]
        );
        const nextOrder = maxOrderRes.rows[0].next_order;

        await client.query(`
            INSERT INTO "theory_articles" (id, chapter_id, title, content_path, widgets_config, "order")
            VALUES ($1, $2, $3, $4, $5::jsonb, $6);
        `, [lessonId, chapterId, title, relativePath, JSON.stringify([]), nextOrder]);

        const initialHtml = `<h2>${title}</h2>\n<p>Введите теоретический материал статьи...</p>`;
        await fs.writeFile(fullFilePath, initialHtml, 'utf-8');

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        await fs.unlink(fullFilePath).catch(() => {});
        throw error;
    } finally {
        await client.end();
    }

    try {
        await sendGlobalNotification({
            title: `Новый урок: ${title}`,
            message: 'Опубликован новый урок в разделе электронного учебника.',
            type: 'NEW_LESSON',
            link: 'theory/index.html',
            createdBy: req.user.id
        });
    } catch (notifyErr) {
        console.error('[WARN] Не удалось отправить уведомление о новом уроке:', notifyErr.message);
    }

    return res.status(201).json({ status: 'success', lessonId });
});

/*
 * PUT /api/v1/admin/ebook/lessons/:id
 */
const updateLesson = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { title, order, content } = req.body;
    const widgetsConfig = req.body.widgets_config ?? req.body.widgetsConfig;
    const client = getDbClient();

    try {
        await client.connect();

        const artRes = await client.query('SELECT content_path FROM "theory_articles" WHERE id = $1;', [id]);
        if (artRes.rows.length === 0) {
            throw new AppError('Страница учебника не найдена', 404, 'LESSON_NOT_FOUND');
        }

        const contentPath = artRes.rows[0].content_path;
        const fileName = path.basename(contentPath);
        const fullFilePath = path.join(ARTICLES_DIR, fileName);

        await fs.writeFile(fullFilePath, content || '', 'utf-8');

        const widgetsJsonString = typeof widgetsConfig === 'string'
            ? widgetsConfig
            : JSON.stringify(widgetsConfig || []);

        await client.query(`
            UPDATE "theory_articles"
            SET title = $1, "order" = $2, widgets_config = $3::jsonb
            WHERE id = $4;
        `, [title, order, widgetsJsonString, id]);

        return res.json({ status: 'success', message: 'Страница успешно сохранена' });
    } finally {
        await client.end();
    }
});

/*
 * DELETE /api/v1/admin/ebook/lessons/:id
 */
const deleteLesson = catchAsync(async (req, res) => {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const artRes = await client.query('SELECT content_path FROM "theory_articles" WHERE id = $1;', [id]);
        if (artRes.rows.length === 0) {
            throw new AppError('Страница учебника не найдена', 404, 'LESSON_NOT_FOUND');
        }

        await client.query('DELETE FROM "theory_articles" WHERE id = $1;', [id]);

        if (artRes.rows[0].content_path) {
            const fileName = path.basename(artRes.rows[0].content_path);
            const fullFilePath = path.join(ARTICLES_DIR, fileName);
            await fs.unlink(fullFilePath).catch(() => {});
        }

        return res.json({ status: 'success', message: 'Страница удалена' });
    } finally {
        await client.end();
    }
});

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