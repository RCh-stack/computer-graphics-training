async function executeLabTests({ studentCode, testCases, compiler = 'g++-15' }) {
    let tests = testCases || [];
    if (typeof tests === 'string') {
        try {
            tests = JSON.parse(tests);
        } catch (e) {
            tests = [];
        }
    }

    const testResults = [];
    let allPassed = true;

    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        const testId = test.id || i + 1;
        const testName = test.name || `Тест #${testId}`;
        const inputData = test.input || '';
        const expectedOutput = String(test.expected_output || test.expectedOutput || '').trim();

        const startTime = Date.now();

        const apiResponse = await fetch('https://api.onlinecompiler.io/api/run-code-sync/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: process.env.COMPILER_API_KEY || '',
            },
            body: JSON.stringify({
                compiler: compiler,
                code: studentCode,
                input: inputData,
            }),
        });

        const compilerData = await apiResponse.json();
        const executionTimeMs = Date.now() - startTime;

        if (compilerData.status === 'error' || compilerData.compile_output) {
            return {
                status: 'compile_error',
                compile_output: compilerData.compile_output || compilerData.error || 'Ошибка компиляции',
                tests: []
            };
        }

        const actualOutput = String(compilerData.output || '').trim();
        const isPassed = actualOutput === expectedOutput;

        if (!isPassed) {
            allPassed = false;
        }

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

    return {
        status: 'success',
        all_passed: allPassed && testResults.length > 0,
        tests: testResults
    };
}

module.exports = { executeLabTests };