const { z } = require('zod');
const { languageEnum } = require('./common');

const templatesObjectSchema = z.object({
    cpp: z.string().optional().default(''),
    python: z.string().optional().default(''),
    csharp: z.string().optional().default(''),
    go: z.string().optional().default('')
}).refine(
    data => Boolean(data.cpp.trim() || data.python.trim() || data.csharp.trim() || data.go.trim()),
    { message: 'Задайте стартовый шаблон кода хотя бы для одного языка программирования' }
);

const templateCodeSchema = z.preprocess((val) => {
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            if (typeof parsed === 'object' && parsed !== null) return parsed;
        } catch {
            return { cpp: val, python: '', csharp: '', go: '' };
        }
    }
    return val;
}, templatesObjectSchema).transform(obj => JSON.stringify(obj));

const testCaseSchema = z.object({
    id: z.number().int().positive().optional(),
    name: z.string().trim().min(1, 'Укажите название тест-кейса').max(100),
    input: z.string().min(1, 'Ожидаемый ввод (stdin) не может быть пустым'),
    expected_output: z.string().min(1, 'Ожидаемый вывод (stdout) не может быть пустым'),
    timeout_ms: z.coerce.number()
        .int('Таймаут должен быть целым числом')
        .min(100, 'Минимальный таймаут выполнения — 100 мс')
        .max(15000, 'Максимальный таймаут выполнения — 15 000 мс')
        .default(1000)
});

const saveLabSchema = z.object({
    title: z.string().trim().min(3, 'Название работы должно содержать минимум 3 символа').max(200),
    description: z.string().trim().min(1, 'Добавьте описание лабораторной работы'),
    difficulty: z.enum(['Легкий', 'Средний', 'Сложный'], {
        errorMap: () => ({ message: 'Уровень сложности должен быть: Легкий, Средний или Сложный' })
    }),
    order: z.coerce.number().int().min(0).default(0),
    isUnlocked: z.boolean().default(false),
    templateCode: templateCodeSchema,
    taskJson: z.object({
        title: z.string().trim().min(1, 'Заголовок задания обязателен'),
        instruction: z.string().trim().min(1, 'Инструкция к заданию обязательна'),
        requirements: z.array(z.string().trim().min(1, 'Требование не может быть пустым')).default([])
    }),
    testCases: z.array(testCaseSchema).min(1, 'Добавьте хотя бы один тест-кейс')
});

const executeLabSchema = z.object({
    lab_id: z.string('Не указан lab_id'),
    student_code: z.string().trim().min(1, 'Код программы не может быть пустым'),
    language: languageEnum.default('cpp'),
    compiler: z.string().optional()
});

const saveDraftSchema = z.object({
    lab_id: z.string('Не указан lab_id'),
    student_code: z.string().max(50000).default(''),
    language: languageEnum.optional().default('cpp')
});

const reviewSubmissionSchema = z.object({
    status: z.enum(['PASSED', 'REVISION', 'REJECTED'], {
        error: 'Некорректный статус проверки (Доступны: PASSED, REVISION, REJECTED)'
    }),
    teacherComment: z.string().trim().max(2000, 'Комментарий не должен превышать 2000 символов').optional().default('')
});

module.exports = {
    saveLabSchema,
    executeLabSchema,
    saveDraftSchema,
    reviewSubmissionSchema
};