const { Client } = require('pg');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * GET /api/v1/tests
 */
async function getAllTests(req, res) {
    const userId = req.user ? req.user.id : null;
    const client = getDbClient();

    try {
        await client.connect();

        const query = `
            SELECT 
                t.id, 
                t.title, 
                t.description, 
                t.difficulty, 
                t.time_limit, 
                t.is_unlocked,
                COUNT(tq.id)::int AS questions_count,
                ts.score_percent AS score,
                (ts.completed_at IS NOT NULL) AS is_completed
            FROM "tests" t
            LEFT JOIN "test_questions" tq 
                   ON t.id = tq.test_id
            LEFT JOIN "test_submissions" ts 
                   ON t.id = ts.test_id AND ts.user_id = $1
            GROUP BY t.id, ts.score_percent, ts.completed_at
            ORDER BY t.id ASC
        `;

        const result = await client.query(query, [userId]);

        return res.json({ 
            status: 'success', 
            tests: result.rows 
        });
    } catch (error) {
        console.error('Ошибка получения списка тестов:', error);
        return res.status(500).json({ error: 'Ошибка сервера при получении списка тестов' });
    } finally {
        await client.end();
    }
}

/**
 * GET /api/v1/tests/:id
 */
async function getTestById(req, res) {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const testResult = await client.query(
            `SELECT id, title, description, difficulty, "time_limit", "is_unlocked"
            FROM "tests"
            WHERE id = $1 LIMIT 1;`,
            [id]
        );

        const test = testResult.rows[0];

        if (!test) {
            return res.status(404).json({ error: 'Тест не найден' });
        }

        const questionsResult = await client.query(
            `SELECT id, "question_text", "options_json", explanation
            FROM "test_questions"
            WHERE "test_id" = $1;`,
            [id]
        );

        test.questions = questionsResult.rows.map(q => {
            const optionsData = typeof q.options_json === 'string' 
                ? JSON.parse(q.options_json) 
                : (q.options_json || {});

            return {
                id: q.id,
                question_text: q.question_text,
                type: optionsData.type || 'single_choice',
                options: optionsData.options || [],
                code_snippet: optionsData.code_snippet || null,
                media_url: optionsData.media_url || null
            };
        });

        return res.json({ status: 'success', test });
    } catch (error) {
        console.error(`Ошибка получения теста ${id}:`, error);
        return res.status(500).json({ error: 'Ошибка сервера при получении теста' });
    } finally {
        await client.end();
    }
};

/**
 * POST /api/v1/tests/:id/submit
 */
async function submitTest(req, res) {
    const { id } = req.params;
    const { answers = {} } = req.body;
    const userId = req.user ? req.user.id : null; 

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Необходима авторизация' });
    }

    const client = getDbClient();

    try {
        await client.connect();

        const questionsResult = await client.query(
            `SELECT id, "correct_answer", "options_json", explanation
            FROM "test_questions"
            WHERE "test_id" = $1;`,
            [id]
        );

        const questions = questionsResult.rows;

        if (questions.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Вопросы к тесту не найдены' });
        }

        let correctCount = 0;

        questions.forEach(q => {
            const userAnswer = answers[q.id];
            const optionsData = typeof q.options_json === 'string' ? JSON.parse(q.options_json) : (q.options_json || {});
            
            if (userAnswer !== undefined && userAnswer !== null) {
                if (optionsData.type === 'numeric_input') {
                    const expected = parseFloat(q.correct_answer);
                    const actual = parseFloat(userAnswer);
                    const tolerance = optionsData.tolerance || 0.01;
                    
                    if (!isNaN(actual) && Math.abs(expected - actual) <= tolerance) {
                        correctCount++;
                    }
                } else {
                    // Обычное сравнение строк/идентификаторов
                    if (String(userAnswer).trim() === String(q.correct_answer).trim()) {
                        correctCount++;
                    }
                }
            }
        });

        const totalQuestions = questions.length;
        const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

        const upsertQuery = `
            INSERT INTO "test_submissions" (id, user_id, test_id, score_percent, user_answers, completed_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
            ON CONFLICT (user_id, test_id) 
            DO UPDATE SET score_percent = EXCLUDED.score_percent, 
                          user_answers = EXCLUDED.user_answers, 
                          completed_at = EXCLUDED.completed_at
            RETURNING score_percent;
        `;
    
        await client.query(upsertQuery, [userId, id, scorePercent, JSON.stringify(answers)]);

        return res.json({
            status: 'success',
            score_percent: scorePercent,
            correct_count: correctCount,
            total_count: totalQuestions
        });
    } catch (error) {
        console.error('Verify Test Error:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
};

module.exports = {
    getAllTests,
    getTestById,
    submitTest
};