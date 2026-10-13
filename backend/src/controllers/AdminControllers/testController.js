const { Client } = require('pg');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/*
 * GET /api/v1/admin/tests
 */
async function getAllTests(req, res) {
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(`
            SELECT t.id, t.title, t.description, t.difficulty, t.time_limit, t.is_unlocked,
                   COUNT(q.id)::int as questions_count
            FROM "tests" t
            LEFT JOIN "test_questions" q ON t.id = q.test_id
            GROUP BY t.id
            ORDER BY t.title ASC;
        `);

        return res.json({ status: 'success', tests: result.rows });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * GET /api/v1/admin/tests/:id
 */
async function getTestById(req, res) {

    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const testRes = await client.query('SELECT * FROM "tests" WHERE id = $1;', [id]);

        if (testRes.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Тест не найден' });

        const questionsRes = await client.query('SELECT * FROM "test_questions" WHERE test_id = $1;', [id]);

        return res.json({
            status: 'success',
            test: testRes.rows[0],
            questions: questionsRes.rows
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * POST /api/v1/admin/tests
 */
async function createTest(req, res) {

    const { title, description, difficulty, timeLimit, isUnlocked } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(`
            INSERT INTO "tests" (id, title, description, difficulty, time_limit, is_unlocked)
            VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
            RETURNING id;
        `, [title, description || '', difficulty || 'Легкий', timeLimit || 15, isUnlocked !== false]);

        return res.json({ status: 'success', testId: result.rows[0].id });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * PUT /api/v1/admin/tests/:id
 */
async function updateTest(req, res) {
    const { id } = req.params;
    const { title, description, difficulty, timeLimit, isUnlocked, questions } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        await client.query(`
            UPDATE "tests" 
            SET title = $1, description = $2, difficulty = $3, time_limit = $4, is_unlocked = $5
            WHERE id = $6;
        `, [title, description, difficulty, timeLimit, isUnlocked, id]);

        await client.query('DELETE FROM "test_questions" WHERE test_id = $1;', [id]);

        for (const q of (questions || [])) {
            const optionsObj = q.options_json || q.optionsJson || {};
            const optionsJsonString = typeof optionsObj === 'string' ? optionsObj : JSON.stringify(optionsObj);

            await client.query(`
                INSERT INTO "test_questions" (id, test_id, question_text, options_json, correct_answer, explanation)
                VALUES (gen_random_uuid()::text, $1, $2, $3::jsonb, $4, $5);
            `, [id, q.questionText || '', optionsJsonString,q.correctAnswer || '', q.explanation || '']);
        }

        return res.json({ status: 'success', message: 'Тест успешно обновлен' });
    } catch (error) {
        console.error('Ошибка в updateTest:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * DELETE /api/v1/admin/tests/:id
 */
async function deleteTest(req, res) {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        await client.query('DELETE FROM "tests" WHERE id = $1;', [id]);

        return res.json({ status: 'success', message: 'Тест удален' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

module.exports = {
    getAllTests,
    getTestById,
    createTest,
    updateTest,
    deleteTest
};