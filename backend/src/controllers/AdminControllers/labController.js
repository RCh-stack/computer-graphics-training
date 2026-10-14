const { Client } = require('pg');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/*
 * GET /api/v1/admin/labs
 */
async function getAllLabs(req, res) {
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(`
            SELECT id, title, description, difficulty, is_unlocked, task_json, template_code, test_cases, "order", created_at
            FROM "labs"
            ORDER BY "order" ASC, created_at DESC;
        `);

        return res.json({ status: 'success', labs: result.rows });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * GET /api/v1/admin/labs/:id
 */
async function getLabById(req, res) {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query('SELECT * FROM "labs" WHERE id = $1;', [id]);

        if (result.rows.length === 0) 
            return res.status(404).json({ status: 'error', message: 'Лабораторная работа не найдена' });

        return res.json({ status: 'success', lab: result.rows[0] });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * POST /api/v1/admin/labs
 */
async function createLab(req, res) {
    const { title, description, difficulty, isUnlocked, order, templateCode, taskJson, testCases } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const taskJsonString = typeof taskJson === 'string' ? taskJson : JSON.stringify(taskJson || {});
        const testCasesString = typeof testCases === 'string' ? testCases : JSON.stringify(testCases || []);

        const result = await client.query(`
            INSERT INTO "labs" (id, title, description, difficulty, is_unlocked, "order", template_code, task_json, test_cases)
            VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
            RETURNING id;
        `, [title, description || '', difficulty || 'Средний', isUnlocked !== false, order || 0, templateCode || '', taskJsonString, testCasesString]);

        return res.json({ status: 'success', labId: result.rows[0].id });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * PUT /api/v1/admin/labs/:id
 */
async function updateLab(req, res) {
    const { id } = req.params;
    const { title, description, difficulty, isUnlocked, order, templateCode, taskJson, testCases } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const taskJsonString = typeof taskJson === 'string' ? taskJson : JSON.stringify(taskJson || {});
        const testCasesString = typeof testCases === 'string' ? testCases : JSON.stringify(testCases || []);

        await client.query(`
            UPDATE "labs"
            SET title = $1, description = $2, difficulty = $3, is_unlocked = $4, "order" = $5, 
                template_code = $6, task_json = $7::jsonb, test_cases = $8::jsonb
            WHERE id = $9;
        `, [title, description, difficulty, isUnlocked, order, templateCode, taskJsonString, testCasesString, id]);

        return res.json({ status: 'success', message: 'Лабораторная работа обновлена' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * DELETE /api/v1/admin/labs/:id
 */
async function deleteLab(req, res) {
    const { id } = req.params;
    const client = getDbClient();
    
    try {
        await client.connect();

        await client.query('DELETE FROM "labs" WHERE id = $1;', [id]);

        return res.json({ status: 'success', message: 'Лабораторная работа удалена' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

module.exports = { 
    getAllLabs, 
    getLabById, 
    createLab, 
    updateLab, 
    deleteLab 
};