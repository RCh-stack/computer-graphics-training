const { Client } = require('pg');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * GET /api/v1/tests
 */
async function getAllTests(req, res) {
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            `SELECT t.id, t.title, t.description, t."time_limit", t."is_unlocked",
            COUNT(qq.id)::int AS "questions_count"
            FROM "tests" t
            LEFT JOIN "test_questions" qq ON t.id = qq."test_id"
            GROUP BY t.id;`
        );

        return res.json({ tests: result.rows });
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
            `SELECT id, title, description, "time_limit", "is_unlocked"
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

        const questions = questionsResult.rows.map((q) => {
            let options = q.optionsJson;
            if (typeof options === 'string') {
                try {
                    options = JSON.parse(options);
                } catch (e) {
                    options = [];
                }
            }
            return {
                id: q.id,
                question_text: q.question_text,
                options: options,
                explanation: q.explanation,
            };
        });

        return res.json({
            test: {
                ...test,
                questions,
            },
        });
    } catch (error) {
        console.error(`Ошибка получения теста ${id}:`, error);
        return res.status(500).json({ error: 'Ошибка сервера при получении теста' });
    } finally {
        await client.end();
    }
};

/**
 * POST /api/v1/tests/:id/verify
 */
async function verifyTest(req, res) {
    const { id } = req.params;
    const { answers = {} } = req.body; // Формат: { "q1": "opt_b", "q2": 16.0 }
    const userId = req.user ? req.user.id : null; 

    const client = getDbClient();

    try {
        await client.connect();

        const testResult = await client.query(
            `SELECT id, title FROM "tests" WHERE id = $1 LIMIT 1;`,
            [id]
        );

        const test = testResult.rows[0];

        if (!test) {
            return res.status(404).json({ status: 'error', message: 'Тест не найден' });
        }

        const questionsResult = await client.query(
            `SELECT id, "question_text", "options_json", "correct_answer", explanation
            FROM "test_questions"
            WHERE "test_id" = $1;`,
            [id]
        );

        const questions = questionsResult.rows;

        if (questions.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Вопросы к тесту не найдены' });
        }

        let correctCount = 0;
        const detailedResults = [];

        questions.forEach((q) => {
            const userAnswerRaw = answers[q.id];
            const userAnswerStr = userAnswerRaw !== undefined && userAnswerRaw !== null 
                ? String(userAnswerRaw).trim() 
                : '';
            const correctAnswerStr = String(q.correct_answer || '').trim();

            let isCorrect = false;

            const numUser = parseFloat(userAnswerStr);
            const numCorrect = parseFloat(correctAnswerStr);

            const isNumericComparison = !isNaN(numUser) && !isNaN(numCorrect);

            if (isNumericComparison) {
                // Допустимая погрешность 0.001 для числовых ответов
                const tolerance = 0.001;
                isCorrect = Math.abs(numUser - numCorrect) <= tolerance;
            } else {
                // Строковое сравнение для вариантов ответов (выбор из списка)
                isCorrect = userAnswerStr.toLowerCase() === correctAnswerStr.toLowerCase();
            }

            if (isCorrect) {
                correctCount++;
            }

            detailedResults.push({
                question_id: q.id,
                is_correct: isCorrect,
                user_answer: userAnswerRaw !== undefined ? userAnswerRaw : null,
                correct_answer: q.correct_answer,
                explanation: q.explanation || 'Пояснение отсутствует.',
            });
        });

        const totalCount = questions.length;
        const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    
        const PASSING_THRESHOLD = 60; // Проходной порог по умолчанию (60%)
        const isPassed = scorePercent >= PASSING_THRESHOLD;

        if (userId) {
            await client.query(
                `INSERT INTO "test_submissions" (id, "user_id", "test_id", score_percent, "user_answers", "completed_at")
                 VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW());`,
                [userId, id, scorePercent, JSON.stringify(answers)]
            );
        }

        return res.json({
            test_id: id,
            score_percent: scorePercent,
            correct_count: correctCount,
            total_count: totalCount,
            passed: isPassed,
            details: detailedResults,
        });
    } catch (error) {
        console.error('Verify Test Error:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
};

/**
 * POST /api/v1/tests/:id/submit
 */
async function submitTest(req, res) {
    try {
        return res.status(200).json({ status: 'success', message: 'Тест отправлен' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

module.exports = {
    getAllTests,
    getTestById,
    verifyTest,
    submitTest
};