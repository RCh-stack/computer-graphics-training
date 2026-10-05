const AppError = require('../utils/appError');
const { Client } = require('pg');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}
/**
 * GET /api/v1/progress/summary
 * Получение общей сводной информации по успеваемости текущего студента
 */
async function getStudentSummary(req, res, next) {
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        return next(new AppError('Пользователь не авторизован', 401));
    }

    const client = getDbClient();

    try {
        await client.connect();

        const labsStatQuery = `
        SELECT 
            COUNT(l.id)::int AS "labs_total",
            COUNT(ls.id)::int AS "labs_submitted",
            COALESCE(AVG(ls.grade), 0)::float AS "average_lab_grade",
            COUNT(CASE WHEN ls.grade >= 60 THEN 1 END)::int AS "labs_passed"
        FROM "labs" l
            LEFT JOIN "lab_submissions" ls 
                ON l.id = ls.lab_id AND ls.user_id = $1
        `;

        const labsStatRes = await client.query(labsStatQuery, [userId]);

        const testsStatQuery = `
        SELECT
            COUNT(t.id)::int AS "tests_total",
            COUNT(ts.id)::int AS "tests_attempted",
            COALESCE(AVG(ts."score_percent"), 0)::float AS "average_test_score",
            COUNT(CASE WHEN ts."score_percent" >= 60 THEN 1 END)::int AS "tests_passed"
        FROM "tests" t
            LEFT JOIN "test_submissions" ts
                ON t.id = ts.test_id AND ts.user_id = $1
        `;
        const testsStatRes = await client.query(testsStatQuery, [userId]);

        const labsStat = labsStatRes.rows[0] || {};
        const testsStat = testsStatRes.rows[0] || {};

        return res.json({
            status: 'success',
            data: {
                labs: {
                    total: labsStat.labs_total || 0,
                    submitted: labsStat.labs_submitted || 0,
                    passed: labsStat.labs_passed || 0,
                    averageGrade: Math.round(labsStat.average_lab_grade || 0),
                },
                tests: {
                    total: testsStat.tests_total || 0,
                    attempted: testsStat.tests_attempted || 0,
                    passed: testsStat.tests_passed || 0,
                    averageScore: Math.round(testsStat.average_test_score || 0),
                },
            },
        });
    } catch (error) {
        console.error('Get Student Summary Error:', error);
        return next(error);
    } finally {
        await client.end();
    }
}

/**
 * GET /api/v1/progress/history
 * Получение подробной истории всех сдач (лабораторных и тестов)
 */
async function getDetailedHistory(req, res, next) {

    const userId = req.user ? req.user.id : null;

    if (!userId) {
        return next(new AppError('Пользователь не авторизован', 401));
    }

    const client = getDbClient();

    try {
        await client.connect();

        // 1. История сдачи лабораторных работ
        const labHistoryQuery = `
        SELECT 
            ls.id,
            ls."lab_id",
            l.title AS "lab_title",
            ls.grade,
            ls."submitted_at"
        FROM "lab_submissions" ls
        JOIN "labs" l ON l.id = ls."lab_id"
        WHERE ls."user_id" = $1
        ORDER BY ls."submitted_at" DESC;
        `;
        const labHistoryRes = await client.query(labHistoryQuery, [userId]);

        // 2. История прохождения тестов
        const testHistoryQuery = `
        SELECT 
            ts.id,
            ts."test_id",
            t.title AS "test_title",
            ts."score_percent",
            ts."completed_at"
        FROM "test_submissions" ts
        JOIN "tests" t ON t.id = ts."test_id"
        WHERE ts."user_id" = $1
        ORDER BY ts."completed_at" DESC;
        `;

        const testHistoryRes = await client.query(testHistoryQuery, [userId]);

        return res.json({
            status: 'success',
            data: {
                labs: labHistoryRes.rows,
                tests: testHistoryRes.rows,
            },
        });
    } catch (error) {
        console.error('Get Detailed History Error:', error);
        return next(error);
    } finally {
        await client.end();
    }
}

module.exports = {
    getStudentSummary,
    getDetailedHistory
};