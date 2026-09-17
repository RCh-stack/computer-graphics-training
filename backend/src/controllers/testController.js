const path = require('path');
const fs = require('fs');

const MANIFEST_PATH = path.join(__dirname, '../../../frontend/testing/content/manifest.json');

function loadManifest() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error('Файл manifest.json не найден');
    }
    const rawData = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    return JSON.parse(rawData);
}

/**
 * GET /api/v1/tests/manifest
 */
exports.getManifest = (req, res) => {
    try {
        const manifest = loadManifest();
        
        // Очищаем вопросы от правильных ответов и пояснений
        const sanitizedManifest = manifest.map(test => ({
            ...test,
            questions: test.questions.map(t => {
                const { correct_option, expected_value, explanation, ...publicQuestion } = t;
                return publicQuestion;
            })
        }));

        return res.json(sanitizedManifest);
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * GET /api/v1/tests/:id
 */
exports.getTestById = (req, res) => {
    try {
        const { id } = req.params;
        const manifest = loadManifest();
        const test = manifest.find(t => t.id === id);

        if (!test) {
            return res.status(404).json({ status: 'error', message: 'Тест не найден' });
        }

        // Удаляем верные ответы перед отправкой клиенту
        const publicTest = {
            ...test,
            questions: test.questions.map(t => {
                const { correct_option, expected_value, explanation, ...publicQuestion } = t;
                return publicQuestion;
            })
        };

        return res.json(publicTest);
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * POST /api/v1/tests/:id/verify
 */
exports.verifyTest = (req, res) => {
    try {
        const { id } = req.params;
        const { answers = {} } = req.body; // Структура: { "q1": "opt_b", "q2": 16.0 }

        const manifest = loadManifest();
        const test = manifest.find(t => t.id === id);

        if (!test) {
            return res.status(404).json({ status: 'error', message: 'Тест не найден' });
        }

        let correctCount = 0;
        const detailedResults = [];

        test.questions.forEach(t => {
            const userAnswer = answers[t.id];
            let isCorrect = false;

            // 1. Проверка вопросов с выбором варианта (single_choice / code_analysis / image_choice)
            if (t.correct_option !== undefined) {
                isCorrect = userAnswer === t.correct_option;
            } 
            // 2. Проверка числовых ответов с учетом погрешности (numeric_input)
            else if (t.expected_value !== undefined) {
                const numAnswer = parseFloat(userAnswer);
                const tolerance = t.tolerance || 0.001;
                if (!isNaN(numAnswer)) {
                    isCorrect = Math.abs(numAnswer - t.expected_value) <= tolerance;
                }
            }

            if (isCorrect) {
                correctCount++;
            }

            detailedResults.push({
                question_id: t.id,
                is_correct: isCorrect,
                user_answer: userAnswer !== undefined ? userAnswer : null,
                correct_option: t.correct_option,
                expected_value: t.expected_value,
                explanation: t.explanation || 'Пояснение отсутствует.'
            });
        });

        const totalCount = test.questions.length;
        const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

        return res.json({
            test_id: id,
            score_percent: scorePercent,
            correct_count: correctCount,
            total_count: totalCount,
            passed: scorePercent >= test.passing_score_percent,
            details: detailedResults
        });

    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};