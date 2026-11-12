const { Client } = require('pg');
const { executeLabTests } = require('../../services/compiler');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

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
const getAllLabs = catchAsync(async (req, res) => {
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
            ORDER BY l.order ASC;
        `;

        const result = await client.query(query, [userId]);

        return res.json({
            status: 'success',
            labs: result.rows
        });
    } finally {
        await client.end();
    }
});

/**
 * GET /api/v1/labs/:id
 */
const getLabById = catchAsync(async (req, res) => {
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
            throw new AppError('Лабораторная работа не найдена', 404, 'LAB_NOT_FOUND');
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
    } finally {
        await client.end();
    }
});

/**
 * POST /api/v1/labs/save
 */
const saveLab = catchAsync(async (req, res) => {
    const userId = req.user ? req.user.id : null;
    const { lab_id, student_code, language } = req.body;

    if (!userId) {
        throw new AppError('Требуется авторизация', 401, 'UNAUTHORIZED');
    }
    if (!lab_id) {
        throw new AppError('Не указан lab_id', 400, 'MISSING_LAB_ID');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const upsertQuery = `
            INSERT INTO "lab_submissions" (id, user_id, lab_id, submitted_code, status, submitted_at, language)
            VALUES (gen_random_uuid(), $1, $2, $3, 'DRAFT', NOW(), $4)
            ON CONFLICT (user_id, lab_id)
            DO UPDATE SET
                status = 'DRAFT',
                submitted_code = EXCLUDED.submitted_code,
                language = EXCLUDED.language;
        `;

        await client.query(upsertQuery, [userId, lab_id, student_code || '', language || 'cpp']);

        return res.json({
            status: 'success',
            message: 'Черновик успешно сохранен'
        });
    } finally {
        await client.end();
    }
});

/**
 * POST /api/v1/labs/run
 */
const runTests = catchAsync(async (req, res) => {
    const { lab_id, student_code, language = 'cpp' } = req.body;

    if (!student_code?.trim()) {
        throw new AppError('Передан пустой код', 400, 'EMPTY_CODE');
    }
    if (!lab_id) {
        throw new AppError('Не указан lab_id', 400, 'MISSING_LAB_ID');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const labResult = await client.query(
            `SELECT id, "test_cases" FROM "labs" WHERE id = $1 LIMIT 1;`,
            [lab_id]
        );

        const currentLab = labResult.rows[0];
        if (!currentLab) {
            throw new AppError(`Лабораторная работа '${lab_id}' не найдена`, 404, 'LAB_NOT_FOUND');
        }

        const targetCompiler = COMPILER_MAP[language] || 'g++-15';

        const executionResult = await executeLabTests({
            studentCode: student_code,
            testCases: currentLab.test_cases,
            language,
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
            lab_id,
            language,
            all_passed: executionResult.all_passed,
            tests: executionResult.tests
        });
    } finally {
        await client.end();
    }
});

/**
 * POST /api/v1/labs/submit
 */
const submitLab = catchAsync(async (req, res) => {
    const userId = req.user ? req.user.id : null;
    const { lab_id, student_code, language = 'cpp' } = req.body;

    if (!userId) {
        throw new AppError('Требуется авторизация', 401, 'UNAUTHORIZED');
    }
    if (!student_code?.trim()) {
        throw new AppError('Передан пустой код', 400, 'EMPTY_CODE');
    }
    if (!lab_id) {
        throw new AppError('Не указан lab_id', 400, 'MISSING_LAB_ID');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const labResult = await client.query(
            `SELECT id, "test_cases" FROM "labs" WHERE id = $1 LIMIT 1;`,
            [lab_id]
        );

        const currentLab = labResult.rows[0];
        if (!currentLab) {
            throw new AppError('Лабораторная работа не найдена', 404, 'LAB_NOT_FOUND');
        }

        const targetCompiler = COMPILER_MAP[language] || 'g++-15';

        const executionResult = await executeLabTests({
            studentCode: student_code,
            testCases: currentLab.test_cases,
            language,
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
    } finally {
        await client.end();
    }
});

module.exports = {
    getAllLabs,
    getLabById,
    saveLab,
    runTests,
    submitLab
};