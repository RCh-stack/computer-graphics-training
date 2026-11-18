const { Client } = require('pg');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

function parseJsonField(raw, fallback = {}) {
    if (!raw) return fallback;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function gradeQuestions(questions, answers) {
    let correctCount = 0;

    questions.forEach(q => {
        const userAnswer = answers[q.id];
        const optionsData = parseJsonField(q.options_json, {});

        if (userAnswer !== undefined && userAnswer !== null && String(userAnswer).trim() !== '') {
            if (optionsData.type === 'numeric_input') {
                const expected = parseFloat(q.correct_answer);
                const actual = parseFloat(userAnswer);
                const tolerance = optionsData.tolerance || 0.01;

                if (!isNaN(actual) && Math.abs(expected - actual) <= tolerance) {
                    correctCount++;
                }
            } else if (String(userAnswer).trim() === String(q.correct_answer).trim()) {
                correctCount++;
            }
        }
    });

    const totalQuestions = questions.length;
    const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return { correctCount, totalQuestions, scorePercent };
}

/**
 * GET /api/v1/tests
 */
const getAllTests = catchAsync(async (req, res) => {
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
                CASE WHEN ts.completed_at IS NOT NULL THEN ts.score_percent ELSE NULL END AS score,
                (ts.completed_at IS NOT NULL) AS is_completed,
                (ts.id IS NOT NULL AND ts.completed_at IS NULL) AS has_active_attempt
            FROM "tests" t
            LEFT JOIN "test_questions" tq 
                   ON t.id = tq.test_id
            LEFT JOIN "test_submissions" ts 
                   ON t.id = ts.test_id AND ts.user_id = $1
            GROUP BY t.id, ts.id, ts.score_percent, ts.completed_at
            ORDER BY t.order ASC;
        `;

        const result = await client.query(query, [userId]);

        return res.json({
            status: 'success',
            tests: result.rows
        });
    } finally {
        await client.end();
    }
});

/**
 * GET /api/v1/tests/:id
 */
const getTestById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        throw new AppError('Необходима авторизация', 401, 'UNAUTHORIZED');
    }

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
            throw new AppError('Тест не найден', 404, 'TEST_NOT_FOUND');
        }

        if (!test.is_unlocked) {
            throw new AppError('Этот тест пока заблокирован', 403, 'TEST_LOCKED');
        }

        const questionsResult = await client.query(
            `SELECT id, "order", "question_text", "options_json"
             FROM "test_questions"
             WHERE "test_id" = $1
             ORDER BY "order" ASC;`,
            [id]
        );

        test.questions = questionsResult.rows.map(q => {
            const optionsData = parseJsonField(q.options_json, {});

            return {
                id: q.id,
                order: q.order,
                question_text: q.question_text,
                type: optionsData.type || 'single_choice',
                options: optionsData.options || [],
                code_snippet: optionsData.code_snippet || null,
                media_url: optionsData.media_url || null
            };
        });

        const existingSubRes = await client.query(
            `SELECT id,
                    user_answers,
                    started_in,
                    expires_at,
                    completed_at,
                    CASE
                        WHEN expires_at IS NULL THEN NULL
                        ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (expires_at - NOW()))))::int
                    END AS remaining_seconds
             FROM "test_submissions"
             WHERE user_id = $1 AND test_id = $2
             LIMIT 1;`,
            [userId, id]
        );

        let attemptRow = existingSubRes.rows[0];
        const timeLimitMinutes = Number(test.time_limit) || 0;

        if (!attemptRow) {
            const insertRes = await client.query(
                `INSERT INTO "test_submissions" (id, user_id, test_id, score_percent, user_answers, started_in, expires_at, completed_at)
                 VALUES (
                     gen_random_uuid(),
                     $1,
                     $2,
                     0,
                     '{}'::jsonb,
                     NOW(),
                     CASE WHEN $3::int > 0 THEN NOW() + make_interval(mins => $3::int) ELSE NULL END,
                     NULL
                 )
                 RETURNING id,
                           user_answers,
                           started_in,
                           expires_at,
                           completed_at,
                           CASE
                               WHEN expires_at IS NULL THEN NULL
                               ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (expires_at - NOW()))))::int
                           END AS remaining_seconds;`,
                [userId, id, timeLimitMinutes]
            );
            attemptRow = insertRes.rows[0];
        } else if (attemptRow.completed_at !== null) {
            const resetRes = await client.query(
                `UPDATE "test_submissions"
                 SET score_percent = 0,
                     user_answers = '{}'::jsonb,
                     started_in = NOW(),
                     expires_at = CASE WHEN $3::int > 0 THEN NOW() + make_interval(mins => $3::int) ELSE NULL END,
                     completed_at = NULL
                 WHERE id = $1 AND user_id = $2
                 RETURNING id,
                           user_answers,
                           started_in,
                           expires_at,
                           completed_at,
                           CASE
                               WHEN expires_at IS NULL THEN NULL
                               ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (expires_at - NOW()))))::int
                           END AS remaining_seconds;`,
                [attemptRow.id, userId, timeLimitMinutes]
            );
            attemptRow = resetRes.rows[0];
        }

        const savedAnswers = parseJsonField(attemptRow.user_answers, {});
        const hasTimeLimit = attemptRow.expires_at !== null;
        const remainingSeconds = hasTimeLimit ? Number(attemptRow.remaining_seconds ?? 0) : null;
        const isExpired = hasTimeLimit && remainingSeconds <= 0;

        return res.json({
            status: 'success',
            test,
            attempt: {
                id: attemptRow.id,
                startedAt: attemptRow.started_in,
                expiresAt: attemptRow.expires_at,
                hasTimeLimit,
                remainingSeconds,
                savedAnswers,
                isExpired
            }
        });
    } finally {
        await client.end();
    }
});

/**
 * PATCH /api/v1/tests/:id/progress
 */
const saveTestProgress = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    const answers = req.body.answers;

    if (!userId) {
        throw new AppError('Необходима авторизация', 401, 'UNAUTHORIZED');
    }

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        return res.json({ status: 'ignored' });
    }

    const client = getDbClient();

    try {
        await client.connect();

        const updateRes = await client.query(
            `UPDATE "test_submissions"
             SET user_answers = $1::jsonb
             WHERE user_id = $2
               AND test_id = $3
               AND completed_at IS NULL
               AND (expires_at IS NULL OR expires_at >= NOW() - interval '15 seconds')
             RETURNING id;`,
            [JSON.stringify(answers), userId, id]
        );

        return res.json({
            status: 'success',
            synced: updateRes.rowCount > 0
        });
    } finally {
        await client.end();
    }
});

/**
 * POST /api/v1/tests/:id/submit
 */
const submitTest = catchAsync(async (req, res) => {
    const { id } = req.params;
    const clientAnswers = req.body.answers || {};
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        throw new AppError('Необходима авторизация', 401, 'UNAUTHORIZED');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const questionsResult = await client.query(
            `SELECT id, "order", "correct_answer", "options_json", explanation
             FROM "test_questions"
             WHERE "test_id" = $1
             ORDER BY "order" ASC;`,
            [id]
        );

        const questions = questionsResult.rows;

        if (questions.length === 0) {
            throw new AppError('Вопросы к тесту не найдены', 404, 'TEST_QUESTIONS_NOT_FOUND');
        }

        const subRes = await client.query(
            `SELECT id, score_percent, user_answers, started_in, expires_at, completed_at, NOW() AS server_now
             FROM "test_submissions"
             WHERE user_id = $1 AND test_id = $2
             LIMIT 1;`,
            [userId, id]
        );

        const existingSub = subRes.rows[0];

        if (existingSub && existingSub.completed_at !== null) {
            const savedAnswers = parseJsonField(existingSub.user_answers, {});
            const { correctCount, totalQuestions } = gradeQuestions(questions, savedAnswers);

            return res.json({
                status: 'success',
                score_percent: existingSub.score_percent,
                correct_count: correctCount,
                total_count: totalQuestions
            });
        }

        let effectiveAnswers = clientAnswers;
        if (existingSub && existingSub.expires_at) {
            const overdueMs = new Date(existingSub.server_now).getTime() - new Date(existingSub.expires_at).getTime();
            if (overdueMs > 15000 && Object.keys(clientAnswers).length === 0) {
                effectiveAnswers = parseJsonField(existingSub.user_answers, {});
            }
        }

        const { correctCount, totalQuestions, scorePercent } = gradeQuestions(questions, effectiveAnswers);

        if (existingSub) {
            await client.query(
                `UPDATE "test_submissions"
                 SET score_percent = $1,
                     user_answers = $2::jsonb,
                     completed_at = NOW()
                 WHERE id = $3 AND user_id = $4;`,
                [scorePercent, JSON.stringify(effectiveAnswers), existingSub.id, userId]
            );
        } else {
            await client.query(
                `INSERT INTO "test_submissions" (id, user_id, test_id, score_percent, user_answers, started_in, completed_at)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, NOW(), NOW());`,
                [userId, id, scorePercent, JSON.stringify(effectiveAnswers)]
            );
        }

        return res.json({
            status: 'success',
            score_percent: scorePercent,
            correct_count: correctCount,
            total_count: totalQuestions
        });
    } finally {
        await client.end();
    }
});

/**
 * GET /api/v1/tests/:id/result
 */
const getTestResult = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        throw new AppError('Необходима авторизация', 401, 'UNAUTHORIZED');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const subRes = await client.query(`
            SELECT id, score_percent, user_answers, completed_at
            FROM "test_submissions"
            WHERE user_id = $1 AND test_id = $2 AND completed_at IS NOT NULL
            ORDER BY completed_at DESC
            LIMIT 1;
        `, [userId, id]);

        if (subRes.rows.length === 0) {
            throw new AppError('Завершенная попытка по этому тесту не найдена', 404, 'SUBMISSION_NOT_FOUND');
        }

        const submission = subRes.rows[0];

        const qRes = await client.query(`
            SELECT id, "order", question_text, options_json, correct_answer, explanation
            FROM "test_questions"
            WHERE test_id = $1
            ORDER BY "order" ASC;
        `, [id]);

        const userAnsObj = parseJsonField(submission.user_answers, {});

        const breakdown = qRes.rows.map(q => {
            let rawUserAnswer = '';

            if (Array.isArray(userAnsObj)) {
                const found = userAnsObj.find(item => item.questionId === q.id || item.id === q.id);
                rawUserAnswer = found ? (found.answer || found.userAnswer) : '';
            } else if (typeof userAnsObj === 'object' && userAnsObj !== null) {
                rawUserAnswer = userAnsObj[q.id] ?? userAnsObj.answers?.[q.id] ?? '';
            }

            const optionsData = parseJsonField(q.options_json, {});
            const optionsList = Array.isArray(optionsData) ? optionsData : (optionsData.options || []);

            const isSkipped = rawUserAnswer === '' || rawUserAnswer === null || rawUserAnswer === undefined;
            let isCorrect = false;

            if (!isSkipped) {
                if (optionsData.type === 'numeric_input') {
                    const expected = parseFloat(q.correct_answer);
                    const actual = parseFloat(rawUserAnswer);
                    const tolerance = optionsData.tolerance || 0.01;
                    isCorrect = !isNaN(actual) && Math.abs(expected - actual) <= tolerance;
                } else {
                    isCorrect = String(rawUserAnswer).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
                }
            }

            return {
                number: q.order,
                questionId: q.id,
                questionText: q.question_text,
                options: optionsList,
                correctAnswer: q.correct_answer,
                userAnswer: rawUserAnswer,
                status: isSkipped ? 'skipped' : (isCorrect ? 'correct' : 'incorrect'),
                explanation: q.explanation || 'Поясняющая информация к данному вопросу отсутствует.'
            };
        });

        return res.json({
            status: 'success',
            result: {
                submissionId: submission.id,
                scorePercent: submission.score_percent,
                completedAt: submission.completed_at,
                questions: breakdown
            }
        });
    } finally {
        await client.end();
    }
});

module.exports = {
    getAllTests,
    getTestById,
    saveTestProgress,
    submitTest,
    getTestResult
};