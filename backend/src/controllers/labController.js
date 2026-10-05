const { Client } = require('pg');
const { executeLabTests } = require('../services/compiler');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

async function getAllLabs(req, res) {
    const userId = req.user ? req.user.id : null;
    const client = getDbClient();

    try {
        await client.connect();

        const query = `
            SELECT 
                l.id, 
                l.title,
                l.description, 
                l.difficulty,
                l.order,
                l."is_unlocked",
                (ls.submitted_at IS NOT NULL) AS completed,
                ls.grade
            FROM "labs" l
            LEFT JOIN "lab_submissions" ls 
                   ON l.id = ls.lab_id AND ls.user_id = $1
            ORDER BY l.order ASC
        `;

        const result = await client.query(query, [userId]);

        return res.json({ 
            status: 'success', 
            labs: result.rows 
        });
    } catch (error) {
        console.error('Ошибка получения списка лабораторных:', error);
        return res.status(500).json({ error: 'Ошибка сервера при получении лабораторных работ' });
    } finally {
        await client.end();
    }
}

async function getLabById(req, res) {
    const { id } = req.params;
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            `SELECT id, title, description, "task_json", "template_code", "test_cases", "order"
            FROM "labs"
            WHERE id = $1 LIMIT 1;`,
            [id]
        );

        const lab = result.rows[0];
        if (!lab) {
            return res.status(404).json({ error: 'Лабораторная работа не найдена' });
        }

        return res.json({ lab });
    } catch (error) {
        console.error(`Ошибка получения лабораторной ${id}:`, error);
        return res.status(500).json({ error: 'Ошибка сервера при получении лабораторной работы' });
    } finally {
        await client.end();
    }
}

async function runTests(req, res) {
    const client = getDbClient();

    try {
        const { lab_id, student_code, compiler = 'g++-15' } = req.body;

        if (!student_code?.trim()) {
            return res.status(400).json({ status: 'error', message: 'Передан пустой код.' });
        }
        if (!lab_id) {
            return res.status(400).json({ status: 'error', message: 'Не указан lab_id.' });
        }

        await client.connect();

        const labResult = await client.query(
            `SELECT id, "test_cases" FROM "labs" WHERE id = $1 LIMIT 1;`,
            [lab_id]
        );

        const currentLab = labResult.rows[0];
        if (!currentLab) {
            return res.status(404).json({
                status: 'error',
                message: `Лабораторная работа '${lab_id}' не найдена.`,
            });
        }

        const executionResult = await executeLabTests({
            studentCode: student_code,
            testCases: currentLab.test_cases,
            compiler
        });

        if (executionResult.status === 'compile_error') {
            return res.json({
                status: 'compile_error',
                compile_output: executionResult.compile_output,
            });
        }

        return res.json({
            status: 'success',
            lab_id: lab_id,
            all_passed: executionResult.all_passed,
            tests: executionResult.tests
        });

    } catch (error) {
        console.error('Run Error:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
};

async function submitLab(req, res) {   
    const client = getDbClient();

    try {
        const userId = req.user ? req.user.id : null;
        const { lab_id, student_code, compiler = 'g++-15' } = req.body;

        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Требуется авторизация.' });
        }
        if (!student_code?.trim()) {
            return res.status(400).json({ status: 'error', message: 'Передан пустой код.' });
        }
        if (!lab_id) {
            return res.status(400).json({ status: 'error', message: 'Не указан lab_id.' });
        }

        await client.connect();

        const labResult = await client.query(
            `SELECT id, "test_cases" FROM "labs" WHERE id = $1 LIMIT 1;`,
            [lab_id]
        );

        const currentLab = labResult.rows[0];
        if (!currentLab) {
            return res.status(404).json({ status: 'error', message: 'Лабораторная работа не найдена.' });
        }

        const executionResult = await executeLabTests({
            studentCode: student_code,
            testCases: currentLab.test_cases,
            compiler
        });

        if (executionResult.status === 'compile_error') {
            return res.json({
                status: 'compile_error',
                compile_output: executionResult.compile_output,
            });
        }

        const isPassed = executionResult.all_passed;
        const status = isPassed ? true : false;
        const score = isPassed ? 100 : 0;

        const upsertQuery = `
            INSERT INTO "lab_submissions" (id, user_id, lab_id, submitted_code, grade, unit_tests_passed, unit_tests_details, submitted_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (user_id, lab_id)
            DO UPDATE SET 
                submitted_code = EXCLUDED.submitted_code,
                grade = EXCLUDED.grade,
                unit_tests_passed = EXCLUDED.unit_tests_passed,
                unit_tests_details = EXCLUDED.unit_tests_details,
                submitted_at = EXCLUDED.submitted_at
            RETURNING id, grade, submitted_at;
        `;

        const submissionResult = await client.query(upsertQuery, [
            userId,
            lab_id,
            student_code,
            score,
            status,
            JSON.stringify(executionResult.tests)
        ]);

        const submission = submissionResult.rows[0];

        return res.json({
            status: 'success',
            message: isPassed 
                ? 'Лабораторная работа успешно сдана!' 
                : 'Код не прошел все тесты. Работа сохранена со статусом FAILED.',
            submission: {
                id: submission.id,
                score: submission.grade,
                status: status,
                submitted_at: submission.submitted_at,
                all_passed: isPassed,
                tests: executionResult.tests
            }
        });

    } catch (error) {
        console.error('Submit Error:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
};

module.exports = {
    getAllLabs,
    getLabById,
    runTests,
    submitLab
};