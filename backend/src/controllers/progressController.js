const AppError = require('../utils/appError');
const { Client } = require('pg');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * GET /api/v1/progress/summary
 */
async function getStudentSummary(req, res, next) {
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        return next(new AppError('Пользователь не авторизован', 401));
    }

    const client = getDbClient();

    try {
        await client.connect();

        const theoryStatQuery = `
        SELECT 
            c.id AS "chapter_id",
            c.title AS "chapter_title",
            c."order" AS "chapter_order",
            COUNT(a.id)::int AS "total_articles",
            COUNT(tp.id)::int AS "completed_articles"
        FROM "theory_chapters" c
            LEFT JOIN "theory_articles" a 
                ON a.chapter_id = c.id
            LEFT JOIN "theory_progress" tp 
                ON tp.article_id = a.id AND tp.user_id = $1 AND tp.completed = TRUE
        GROUP BY c.id, c.title, c."order"
        ORDER BY c."order" ASC;
        `;

        const theoryStatRes = await client.query(theoryStatQuery, [userId]);

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
        const theoryRows = theoryStatRes.rows || [];

        let totalArticlesSum = 0;
        let completedArticlesSum = 0;
        let completedChaptersCount = 0;

        const chaptersProgress = theoryRows.map(ch => {
            const total = ch.total_articles || 0;
            const completed = ch.completed_articles || 0;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
            const isCompleted = total > 0 && completed >= total;

            totalArticlesSum += total;
            completedArticlesSum += completed;
            if (isCompleted) {
                completedChaptersCount++;
            }

            return {
                id: ch.chapter_id,
                title: ch.chapter_title,
                order: ch.chapter_order,
                totalArticles: total,
                completedArticles: completed,
                percent,
                isCompleted
            };
        });

        const totalChaptersCount = chaptersProgress.length;
        const overallTheoryPercent = totalArticlesSum > 0 
            ? Math.round((completedArticlesSum / totalArticlesSum) * 100) 
            : 0;

        return res.json({
            status: 'success',
            data: {
                theory: {
                    totalArticles: totalArticlesSum,
                    completedArticles: completedArticlesSum,
                    totalChapters: totalChaptersCount,
                    completedChapters: completedChaptersCount,
                    percent: overallTheoryPercent,
                    chapters: chaptersProgress
                },
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
 */
async function getDetailedHistory(req, res, next) {

    const userId = req.user ? req.user.id : null;

    if (!userId) {
        return next(new AppError('Пользователь не авторизован', 401));
    }

    const client = getDbClient();

    try {
        await client.connect();

        const theoryHistoryQuery = `
        SELECT 
            tp.id,
            tp."article_id",
            a.title AS "article_title",
            a."chapter_id",
            c.title AS "chapter_title",
            tp."created_at" AS "completed_at"
        FROM "theory_progress" tp
        JOIN "theory_articles" a ON a.id = tp."article_id"
        JOIN "theory_chapters" c ON c.id = a."chapter_id"
        WHERE tp."user_id" = $1 AND tp.completed = TRUE
        ORDER BY tp."created_at" DESC;
        `;
        const theoryHistoryRes = await client.query(theoryHistoryQuery, [userId]);

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
                theory: theoryHistoryRes.rows,
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