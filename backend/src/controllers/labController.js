const { Client } = require('pg');
const { executeLabTests } = require('../services/compiler');

const COMPILER_MAP = {
    'cpp': 'g++-15',
    'python': 'python-3.14',
    'csharp': 'dotnet-csharp-10',
    'go': 'go-1.26'
};

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * GET /api/v1/labs
 */
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
                ls.grade,
                ls.status
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

/**
 * GET /api/v1/labs/:id
 */
async function getLabById(req, res) {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
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

        const subRes = await client.query(`
            SELECT submitted_code, language, status, teacher_comment, unit_tests_passed, submitted_at
            FROM "lab_submissions"
            WHERE user_id = $1 AND lab_id = $2;
        `, [userId, id]);

        const submission = subRes.rows[0] || null;

        return res.json({
            status: 'success',
            lab: {
                ...lab,
                userSubmission: submission ? {
                    submittedCode: submission.submitted_code,
                    language: submission.language,
                    status: submission.status || 'SUBMITTED',
                    teacherComment: submission.teacher_comment || '',
                    unitTestsPassed: submission.unit_tests_passed,
                    submittedAt: submission.submitted_at
                } : null
            }
        });
    } catch (error) {
        console.error(`Ошибка получения лабораторной ${id}:`, error);
        return res.status(500).json({ error: 'Ошибка сервера при получении лабораторной работы' });
    } finally {
        await client.end();
    }
}

/**
 * POST /api/v1/labs/save
 */
async function saveLab(req, res) { 
    const userId = req.user ? req.user.id : null;
    const { lab_id, student_code } = req.body;

    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Требуется авторизация.' });
    }
    if (!lab_id) {
        return res.status(400).json({ status: 'error', message: 'Не указан lab_id.' });
    }

    const client = getDbClient();

    try {
        await client.connect();

        const upsertQuery = `
            INSERT INTO "lab_submissions" (id, user_id, lab_id, submitted_code, status, submitted_at)
            VALUES (gen_random_uuid(), $1, $2, $3, 'DRAFT', NOW())
            ON CONFLICT (user_id, lab_id)
            DO UPDATE SET
                status = 'DRAFT',
                submitted_code = EXCLUDED.submitted_code;
        `;

        await client.query(upsertQuery, [userId, lab_id, student_code || '']);

        return res.json({
            status: 'success',
            message: 'Черновик успешно сохранен'
        });

    } catch (error) {
        console.error('Save Draft Error:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/**
 * POST /api/v1/labs/run
 */
async function runTests(req, res) {
    const client = getDbClient();

    try {
        const { lab_id, student_code, language = 'cpp' } = req.body;

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

        const targetCompiler = COMPILER_MAP[language] || 'g++-15';

        const executionResult = await executeLabTests({
            studentCode: student_code,
            testCases: currentLab.test_cases,
            language: language,
            compiler: targetCompiler
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
            language: language,
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

/**
 * POST /api/v1/labs/submit
 */
async function submitLab(req, res) {   
    const client = getDbClient();

    try {
        const userId = req.user ? req.user.id : null;
        const { lab_id, student_code, language = 'cpp' } = req.body;

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

        const targetCompiler = COMPILER_MAP[language] || 'g++-15';

        const executionResult = await executeLabTests({
            studentCode: student_code,
            testCases: currentLab.test_cases,
            language: language,
            compiler: targetCompiler
        });

       if (executionResult.status === 'compile_error') {
            await client.query(`
                INSERT INTO "lab_submissions" (id, user_id, lab_id, submitted_code, status, submitted_at)
                VALUES (gen_random_uuid(), $1, $2, $3, 'DRAFT', NOW())
                ON CONFLICT (user_id, lab_id)
                DO UPDATE SET submitted_code = EXCLUDED.submitted_code;
            `, [userId, lab_id, student_code]);

            return res.json({
                status: 'compile_error',
                message: 'Ошибка компиляции. Код сохранен как черновик.',
                compile_output: executionResult.compile_output
            });
        }

        const isPassed = Boolean(executionResult.all_passed);
        const score = isPassed ? 100 : 0;

        const upsertQuery = `
            INSERT INTO "lab_submissions" (id, user_id, lab_id, submitted_code, language, grade, status, unit_tests_passed, unit_tests_details, submitted_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'SUBMITTED', $6, $7, NOW())
            ON CONFLICT (user_id, lab_id)
            DO UPDATE SET 
                submitted_code = EXCLUDED.submitted_code,
                language = EXCLUDED.language,
                grade = EXCLUDED.grade,
                unit_tests_passed = EXCLUDED.unit_tests_passed,
                unit_tests_details = EXCLUDED.unit_tests_details,
                status = 'SUBMITTED',
                submitted_at = NOW()
            RETURNING id, grade, status, submitted_at;
        `;

        const submissionResult = await client.query(upsertQuery, [
            userId,
            lab_id,
            student_code,
            language,
            score,
            isPassed,
            JSON.stringify(executionResult.tests || [])
        ]);

        const submission = submissionResult.rows[0];

        return res.json({
            status: 'success',
            message: 'Работа успешно отправлена на проверку!',
            submission: {
                id: submission.id,
                score: submission.grade,
                status: submission.status,
                submitted_at: submission.submitted_at,
                all_passed: isPassed,
                tests: executionResult.tests || []
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
    saveLab,
    runTests,
    submitLab
};