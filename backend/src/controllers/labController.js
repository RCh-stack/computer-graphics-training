const { Client } = require('pg');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

async function getAllLabs(req, res) {
    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            `SELECT id, title, description, "order"
            FROM "labs"
            ORDER BY "order" ASC;`
        );

        return res.json({ labs: result.rows });
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
            `SELECT id, title, description, "template_code", "test_cases", "order"
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

        if (!student_code || !student_code.trim()) {
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
                message: `Лабораторная работа '${lab_id}' не найдена в базе данных.`,
            });
        }

        let tests = currentLab.test_cases || [];
        if (typeof tests === 'string') {
            try {
                tests = JSON.parse(tests);
            } catch (e) {
                tests = [];
            }
        }

        const testResults = [];

        for (let i = 0; i < tests.length; i++) {
            const test = tests[i];
            const testId = test.id || i + 1;
            const testName = test.name || `Тест #${testId}`;
            const inputData = test.input || '';
            const expectedOutput = String(test.expected_output || test.expectedOutput || '').trim();

            const startTime = Date.now();

            // Отправка запроса во внешний Online Compiler API
            const apiResponse = await fetch('https://api.onlinecompiler.io/api/run-code-sync/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: process.env.COMPILER_API_KEY || '',
                },
                body: JSON.stringify({
                    compiler: compiler,
                    code: student_code,
                    input: inputData,
                }),
            });

            const compilerData = await apiResponse.json();
            const executionTimeMs = Date.now() - startTime;

            // Обработка ошибки компиляции
            if (compilerData.status === 'error' || compilerData.compile_output) {
                return res.json({
                    status: 'compile_error',
                    compile_output:
                        compilerData.compile_output || compilerData.error || 'Ошибка компиляции',
                });
            }

            const actualOutput = String(compilerData.output || '').trim();
            const isPassed = actualOutput === expectedOutput;

            testResults.push({
                id: testId,
                name: testName,
                passed: isPassed,
                time_ms: executionTimeMs,
                input: inputData,
                expected_output: expectedOutput,
                actual_output: actualOutput,
                message: isPassed ? null : `Ожидалось: "${expectedOutput}", Получено: "${actualOutput}"`
            });
        }

        return res.json({
            status: 'success',
            lab_id: lab_id,
            tests: testResults
        });

    } catch (error) {
        console.error('Run Error:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
    finally {
        await client.end()
    }
};

async function submitLab(req, res) {
    try {
        return res.status(200).json({ status: 'success', message: 'Лабораторная отправлена' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = {
    getAllLabs,
    getLabById,
    runTests,
    submitLab
};