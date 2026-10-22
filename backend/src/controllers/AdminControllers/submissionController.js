const { Client } = require('pg');
const { resolveOptionText } = require('../../services/textHandler');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/*
 * GET /api/v1/admin/submissions/labs
 */
async function getLabSubmissions(req, res) {
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
                ls.unit_tests_passed,
                ls.unit_tests_details,
                ls.teacher_comment,
                ls.status,
                ls.submitted_at,
                u.first_name,
                u.last_name,
                u.email,
                g.name as group_name,
                l.title as lab_title
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
    } catch (error) {
        console.error('Ошибка получения выполненных лабораторных работ:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * PUT /api/v1/admin/submissions/labs/:id/review
 */
async function reviewLabSubmission(req, res) {
    const { id } = req.params;
    const { status, teacherComment } = req.body;

    if (!status) {
        return res.status(400).json({ status: 'error', message: 'Укажите статус проверки' });
    }

    const client = getDbClient();

    try {
        await client.connect();

        await client.query(`
            UPDATE "lab_submissions"
            SET status = $1, teacher_comment = $2
            WHERE id = $3;
        `, [status, teacherComment || '', id]);

        return res.json({ 
            status: 'success', 
            message: 'Результат проверки успешно сохранен' 
        });
    } catch (error) {
        console.error('Ошибка проверки решения:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * GET /api/v1/admin/submissions/tests
 */
async function getTestSubmissions(req, res) {
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

        let questionsByTest = new Map();
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
                try { userAnsObj = JSON.parse(userAnsObj); } catch { userAnsObj = {}; }
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
                    isCorrect: isCorrect
                };
            });

            return {
                ...sub,
                questionsBreakdown
            };
        });

        return res.json({ status: 'success', submissions: enrichedSubmissions });
    } catch (error) {
        console.error('Ошибка получения результатов тестов:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

module.exports = { 
    getLabSubmissions,
    reviewLabSubmission,
    getTestSubmissions
};