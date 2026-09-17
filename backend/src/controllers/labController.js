const path = require('path');
const fs = require('fs');

function getManifest() {
    const manifestPath = path.join(__dirname, '../../../frontend/workspace/content/manifest.json');
    const rawData = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(rawData);
}

exports.getAllLabs = async (req, res) => {
    try {
        return res.status(200).json({ status: 'success', data: [] });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getLabById = async (req, res) => {
    try {
        const { id } = req.params;
        return res.status(200).json({ status: 'success', labId: id });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.runTests = async (req, res) => {
    try {
        const { lab_id, student_code, compiler = 'g++-15' } = req.body;

        if (!student_code || !student_code.trim()) {
            return res.status(400).json({ status: 'error', message: 'Передан пустой код.' });
        }

        const labs = getManifest();
        const currentLab = labs.find(l => l.id === lab_id);

        if (!currentLab) {
            return res.status(404).json({ status: 'error', message: `Лабораторная work '${lab_id}' не найдена в манифесте.` });
        }

        const testResults = [];

        for (const test of currentLab.tests) {
            const startTime = Date.now();

            // Запрос в онлайн компилятор с индивидуальным input для каждого теста
            const apiResponse = await fetch('https://api.onlinecompiler.io/api/run-code-sync/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': process.env.COMPILER_API_KEY
                },
                body: JSON.stringify({
                    compiler: compiler,
                    code: student_code,
                    input: test.input || ''
                })
            });

            const compilerData = await apiResponse.json();
            const executionTimeMs = Date.now() - startTime;

            if (compilerData.status === 'error' || compilerData.compile_output) {
                return res.json({
                    status: 'compile_error',
                    compile_output: compilerData.compile_output || compilerData.error || 'Ошибка компиляции'
                });
            }

            const actualOutput = (compilerData.output || '').trim();
            const expectedOutput = (test.expected_output || '').trim();

            const isPassed = actualOutput === expectedOutput;

            testResults.push({
                id: test.id,
                name: test.is_hidden ? `Скрытый тест #${test.id}` : test.name,
                passed: isPassed,
                time_ms: executionTimeMs,
                input: test.input,
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
};

exports.submitLab = async (req, res) => {
    try {
        return res.status(200).json({ status: 'success', message: 'Лабораторная отправлена' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};