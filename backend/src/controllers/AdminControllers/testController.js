const { Client } = require('pg');
const { sendGlobalNotification } = require('../../services/notification');

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
            SELECT t.id, t.title, t.description, t.difficulty, t.order, t.time_limit, t.is_unlocked,
                   COUNT(q.id)::int as questions_count
            FROM "tests" t
            LEFT JOIN "test_questions" q ON t.id = q.test_id
            GROUP BY t.id
            ORDER BY t.order ASC;
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

        const maxOrderRes = await client.query('SELECT COALESCE(MAX("order"), 0) + 1 as next_order FROM "tests";');
        const nextOrder = maxOrderRes.rows[0].next_order;

        const result = await client.query(`
            INSERT INTO "tests" (id, title, description, difficulty, time_limit, is_unlocked, "order")
            VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
            RETURNING id;
        `, [title, description || '', difficulty || 'Легкий', timeLimit || 15, isUnlocked !== false, nextOrder]);

        await sendGlobalNotification({
            title: `Новое тестирование: ${title}`,
            message: 'Преподаватель опубликовал новое тестирование для прохождения.',
            type: 'NEW_TEST',
            link: `testing/test-workspace.html?id=${result.rows[0].id}`,
            createdBy: req.user.id
        });

        return res.json({ status: 'success', testId: result.rows[0].id });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/**
 * PUT /api/v1/admin/tests/:id
 */
async function updateTest(req, res) {
    const { id } = req.params;
    const { title, description, difficulty, timeLimit, isUnlocked, questions } = req.body;
    const client = getDbClient();

    try {
        await client.connect();
        await client.query('BEGIN');

        await client.query(`
            UPDATE "tests" 
            SET title = $1, description = $2, difficulty = $3, time_limit = $4, is_unlocked = $5
            WHERE id = $6;
        `, [title, description, difficulty, timeLimit, isUnlocked, id]);

        const existingRes = await client.query(`
            SELECT id, "order" FROM "test_questions" WHERE test_id = $1 ORDER BY "order" ASC;
        `, [id]);
        
        const existingByOrder = new Map();
        existingRes.rows.forEach(row => {
            existingByOrder.set(Number(row.order), row.id);
        });

        const incomingQuestions = questions || [];
        const keptQuestionIds = [];

        for (let i = 0; i < incomingQuestions.length; i++) {
            const q = incomingQuestions[i];
            const orderNum = q.order || (i + 1);

            const questionId = q.id || existingByOrder.get(orderNum) || crypto.randomUUID();
            keptQuestionIds.push(questionId);

            const optionsObj = q.options_json || q.optionsJson || q.options || {};
            const optionsJsonString = typeof optionsObj === 'string' ? optionsObj : JSON.stringify(optionsObj);

            const rawCorrectAnswer = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct_answer || '');
            const correctAnswerStr = String(rawCorrectAnswer).trim();

            await client.query(`
                INSERT INTO "test_questions" (id, test_id, question_text, options_json, correct_answer, explanation, "order")
                VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET
                    question_text = EXCLUDED.question_text,
                    options_json = EXCLUDED.options_json,
                    correct_answer = EXCLUDED.correct_answer,
                    explanation = EXCLUDED.explanation,
                    "order" = EXCLUDED."order";
            `, [
                questionId,
                id,
                q.questionText || q.question_text || '',
                optionsJsonString,
                correctAnswerStr,
                q.explanation || '',
                orderNum
            ]);
        }

        if (keptQuestionIds.length > 0) {
            const placeholders = keptQuestionIds.map((_, idx) => `$${idx + 2}`).join(',');
            await client.query(`
                DELETE FROM "test_questions" 
                WHERE test_id = $1 AND id NOT IN (${placeholders});
            `, [id, ...keptQuestionIds]);
        } else {
            await client.query('DELETE FROM "test_questions" WHERE test_id = $1;', [id]);
        }

        await client.query('COMMIT');
        return res.json({ status: 'success', message: 'Тест успешно обновлен' });

    } catch (error) {
        await client.query('ROLLBACK');
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