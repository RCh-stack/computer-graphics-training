const { Client } = require('pg');
const { resolveOptionText } = require('../../services/textHandler');
const { sendUserNotification } = require('../../services/notification');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/*
 * GET /api/v1/admin/submissions/labs
 */
const getLabSubmissions = catchAsync(async (req, res) => {
    const { labId, groupId, status } = req.query;
    const client = getDbClient();

    try {
        await client.connect();

        let query = `
            SELECT 
                ls.id,
                ls.user_id,
                ls.lab_id,
                ls.submitted_code,
                ls.language,
                ls.unit_tests_passed,
                ls.unit_tests_details,
                ls.teacher_comment,
                ls.status,
                ls.submitted_at,
                u.first_name,
                u.last_name,
                u.email,
                g.name as group_name,
                l.title as lab_title,
                l."order" as order
            FROM "lab_submissions" ls
            JOIN "users" u ON ls.user_id = u.id
            LEFT JOIN "groups" g ON u.group_id = g.id
            JOIN "labs" l ON ls.lab_id = l.id
            WHERE 1=1
        `;

        const params = [];
        if (labId) {
            params.push(labId);
            query += ` AND ls.lab_id = $${params.length}`;
        }
        if (groupId) {
            params.push(groupId);
            query += ` AND u.group_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND ls.status = $${params.length}`;
        }

        query += ` ORDER BY ls.submitted_at DESC;`;

        const result = await client.query(query, params);

        return res.json({ status: 'success', submissions: result.rows });
    } finally {
        await client.end();
    }
});

/*
 * PUT /api/v1/admin/submissions/labs/:id/review
 */
const reviewLabSubmission = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status, teacherComment } = req.body;

    if (!status) {
        throw new AppError('Укажите статус проверки', 400, 'MISSING_REVIEW_STATUS');
    }

    const client = getDbClient();
    let userId;
    let labId;
    let labOrder = '';
    let labTitle = 'Лабораторная работа';

    try {
        await client.connect();

        const updateRes = await client.query(`
            UPDATE "lab_submissions"
            SET status = $1, teacher_comment = $2
            WHERE id = $3
            RETURNING user_id, lab_id;
        `, [status, teacherComment, id]);

        if (updateRes.rows.length === 0) {
            throw new AppError('Запись о сдаче работы не найдена', 404, 'SUBMISSION_NOT_FOUND');
        }

        userId = updateRes.rows[0].user_id;
        labId = updateRes.rows[0].lab_id;

        const labRes = await client.query(`
            SELECT title, "order" FROM "labs" WHERE id = $1 LIMIT 1;
        `, [labId]);

        const lab = labRes.rows[0] || {};
        if (lab.order !== undefined) labOrder = lab.order;
        if (lab.title) labTitle = lab.title;
    } finally {
        await client.end();
    }

    const statusText = status === 'PASSED'
        ? 'Принято ✅'
        : status === 'REVISION'
            ? 'На доработку ⚠️'
            : 'Отклонена ❌';

    try {
        await sendUserNotification({
            userId,
            title: `Статус лабораторной работы №${labOrder} (${labTitle})`,
            message: `Ваша работа переведена в статус "${statusText}". ${teacherComment ? 'Комментарий: ' + teacherComment : ''}`,
            type: 'LAB_STATUS',
            link: `workspace/lab-workspace.html?id=${labId}`
        });
    } catch (notifyErr) {
        console.error('[WARN] Не удалось отправить уведомление студенту о проверке работы:', notifyErr.message);
    }

    return res.json({
        status: 'success',
        message: 'Результат проверки успешно сохранен'
    });
});

/*
 * GET /api/v1/admin/submissions/tests
 */
const getTestSubmissions = catchAsync(async (req, res) => {
    const { groupId } = req.query;
    const client = getDbClient();

    try {
        await client.connect();

        let query = `
            SELECT 
                ts.id,
                ts.user_id,
                ts.test_id,
                ts.score_percent,
                ts.user_answers,
                ts.started_in,
                ts.completed_at,
                u.first_name,
                u.last_name,
                u.email,
                g.name as group_name,
                t.title as test_title,
                t.time_limit
            FROM "test_submissions" ts
            JOIN "users" u ON ts.user_id = u.id
            LEFT JOIN "groups" g ON u.group_id = g.id
            JOIN "tests" t ON ts.test_id = t.id
            WHERE 1=1
        `;

        const params = [];
        if (groupId) {
            params.push(groupId);
            query += ` AND u.group_id = $${params.length}`;
        }

        query += ` ORDER BY ts.completed_at DESC;`;

        const result = await client.query(query, params);
        const submissions = result.rows;

        const testIds = [...new Set(submissions.map(s => s.test_id))];

        const questionsByTest = new Map();
        if (testIds.length > 0) {
            const qResult = await client.query(`
                SELECT id, test_id, question_text, options_json, correct_answer 
                FROM "test_questions" 
                WHERE test_id = ANY($1::varchar[]);
            `, [testIds]);

            qResult.rows.forEach(q => {
                if (!questionsByTest.has(q.test_id)) {
                    questionsByTest.set(q.test_id, []);
                }
                questionsByTest.get(q.test_id).push(q);
            });
        }

        const enrichedSubmissions = submissions.map(sub => {
            let userAnsObj = sub.user_answers;
            if (typeof userAnsObj === 'string') {
                try {
                    userAnsObj = JSON.parse(userAnsObj);
                } catch {
                    userAnsObj = {};
                }
            }

            const testQuestions = questionsByTest.get(sub.test_id) || [];

            const questionsBreakdown = testQuestions.map(q => {
                let rawUserAnswer = '';

                if (Array.isArray(userAnsObj)) {
                    const found = userAnsObj.find(item => item.questionId === q.id || item.id === q.id);
                    rawUserAnswer = found ? (found.answer || found.userAnswer) : '';
                } else if (typeof userAnsObj === 'object' && userAnsObj !== null) {
                    rawUserAnswer = userAnsObj[q.id] || userAnsObj.answers?.[q.id] || '';
                }

                const isCorrect = String(rawUserAnswer).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();

                const userText = resolveOptionText(rawUserAnswer, q.options_json);
                const correctText = resolveOptionText(q.correct_answer, q.options_json);

                return {
                    questionId: q.id,
                    questionText: q.question_text,
                    correctAnswer: correctText,
                    userAnswer: userText,
                    isCorrect
                };
            });

            return {
                ...sub,
                questionsBreakdown
            };
        });

        return res.json({ status: 'success', submissions: enrichedSubmissions });
    } finally {
        await client.end();
    }
});

/*
 * GET /api/v1/admin/submissions/ebook
 */
const getTheoryGradebook = catchAsync(async (req, res) => {
    const { groupId } = req.query;
    const client = getDbClient();

    try {
        await client.connect();

        const chaptersRes = await client.query(`
            SELECT c.id, c.title, c."order", COUNT(a.id)::int as total_articles
            FROM "theory_chapters" c
            LEFT JOIN "theory_articles" a ON a.chapter_id = c.id
            GROUP BY c.id
            ORDER BY c."order" ASC;
        `);
        const chapters = chaptersRes.rows;

        let userQuery = `
            SELECT u.id, u.first_name, u.last_name, u.email, g.name as group_name
            FROM "users" u
            LEFT JOIN "groups" g ON u.group_id = g.id
            WHERE u.role = 'STUDENT'
        `;
        const params = [];
        if (groupId) {
            params.push(groupId);
            userQuery += ` AND u.group_id = $${params.length}`;
        }
        userQuery += ` ORDER BY u.last_name, u.first_name;`;

        const usersRes = await client.query(userQuery, params);
        const students = usersRes.rows;

        const progressRes = await client.query(`
            SELECT tp.user_id, a.chapter_id, COUNT(tp.id)::int as completed_articles
            FROM "theory_progress" tp
            JOIN "theory_articles" a ON tp.article_id = a.id
            WHERE tp.completed = TRUE
            GROUP BY tp.user_id, a.chapter_id;
        `);

        const progressMap = new Map();
        progressRes.rows.forEach(row => {
            progressMap.set(`${row.user_id}_${row.chapter_id}`, row.completed_articles);
        });

        const rows = students.map(st => {
            const chapterProgress = {};

            chapters.forEach(ch => {
                const completed = progressMap.get(`${st.id}_${ch.id}`) || 0;
                const total = ch.total_articles || 0;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                chapterProgress[ch.id] = {
                    completed,
                    total,
                    percent
                };
            });

            return {
                userId: st.id,
                name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || st.email,
                email: st.email,
                groupName: st.group_name || '—',
                chapters: chapterProgress
            };
        });

        return res.json({
            status: 'success',
            chapters,
            rows
        });
    } finally {
        await client.end();
    }
});

module.exports = {
    getLabSubmissions,
    reviewLabSubmission,
    getTestSubmissions,
    getTheoryGradebook
};