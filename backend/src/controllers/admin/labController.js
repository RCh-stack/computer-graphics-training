const { Client } = require('pg');

const { sendGlobalNotification } = require('../../services/notification');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/*
 * GET /api/v1/admin/labs
 */
const getAllLabs = catchAsync(async (req, res) => {
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(`
            SELECT id, title, description, difficulty, is_unlocked, task_json, template_code, test_cases, "order", created_at
            FROM "labs"
            ORDER BY "order" ASC, created_at DESC;
        `);

        return res.json({ status: 'success', labs: result.rows });
    } finally {
        await client.end();
    }
});

/*
 * GET /api/v1/admin/labs/:id
 */
const getLabById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query('SELECT * FROM "labs" WHERE id = $1;', [id]);

        if (result.rows.length === 0) {
            throw new AppError('Лабораторная работа не найдена', 404, 'LAB_NOT_FOUND');
        }

        return res.json({ status: 'success', lab: result.rows[0] });
    } finally {
        await client.end();
    }
});

/*
 * POST /api/v1/admin/labs
 */
const createLab = catchAsync(async (req, res) => {
    const { title, description, difficulty, order } = req.body;
    const isUnlocked = req.body.is_unlocked ?? req.body.isUnlocked;
    const templateCode = req.body.template_code ?? req.body.templateCode ?? '';
    const taskJson = req.body.task_json ?? req.body.taskJson ?? {};
    const testCases = req.body.test_cases ?? req.body.testCases ?? [];

    const client = getDbClient();
    let createdLabId;

    try {
        await client.connect();

        const taskJsonString = typeof taskJson === 'string' ? taskJson : JSON.stringify(taskJson);
        const testCasesString = typeof testCases === 'string' ? testCases : JSON.stringify(testCases);

        const result = await client.query(`
            INSERT INTO "labs" (id, title, description, difficulty, is_unlocked, "order", template_code, task_json, test_cases)
            VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
            RETURNING id;
        `, [title, description || '', difficulty || 'Средний', isUnlocked !== false, order || 0, templateCode, taskJsonString, testCasesString]);

        createdLabId = result.rows[0].id;
    } finally {
        await client.end();
    }

    try {
        await sendGlobalNotification({
            title: `Новая лабораторная работа: ${title}`,
            message: 'Преподаватель опубликовал новую лабораторную работу.',
            type: 'NEW_LAB',
            link: `workspace/lab-workspace.html?id=${createdLabId}`,
            createdBy: req.user.id
        });
    } catch (notifyErr) {
        console.error('[WARN] Не удалось отправить уведомление о новой лабораторной работе:', notifyErr.message);
    }

    return res.status(201).json({ status: 'success', labId: createdLabId });
});

/*
 * PUT /api/v1/admin/labs/:id
 */
const updateLab = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { title, description, difficulty, isUnlocked, order, templateCode, taskJson, testCases } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const taskJsonString = typeof taskJson === 'string' ? taskJson : JSON.stringify(taskJson || {});
        const testCasesString = typeof testCases === 'string' ? testCases : JSON.stringify(testCases || []);

        const result = await client.query(`
            UPDATE "labs"
            SET title = $1, description = $2, difficulty = $3, is_unlocked = $4, "order" = $5, 
                template_code = $6, task_json = $7::jsonb, test_cases = $8::jsonb
            WHERE id = $9;
        `, [title, description, difficulty, isUnlocked, order, templateCode, taskJsonString, testCasesString, id]);

        if (result.rowCount === 0) {
            throw new AppError('Лабораторная работа не найдена', 404, 'LAB_NOT_FOUND');
        }

        return res.json({ status: 'success', message: 'Лабораторная работа обновлена' });
    } finally {
        await client.end();
    }
});

/*
 * DELETE /api/v1/admin/labs/:id
 */
const deleteLab = catchAsync(async (req, res) => {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query('DELETE FROM "labs" WHERE id = $1;', [id]);

        if (result.rowCount === 0) {
            throw new AppError('Лабораторная работа не найдена', 404, 'LAB_NOT_FOUND');
        }

        return res.json({ status: 'success', message: 'Лабораторная работа удалена' });
    } finally {
        await client.end();
    }
});

module.exports = {
    getAllLabs,
    getLabById,
    createLab,
    updateLab,
    deleteLab
};