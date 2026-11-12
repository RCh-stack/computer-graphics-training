const { z } = require('zod');

const optionalString = z.string().nullish().transform(val => val ?? '');

const optionItemSchema = z.object({
    id: z.string().default(''),
    text: z.string().default('')
});

const normalizeQuestionData = (val) => {
    if (typeof val !== 'object' || val === null) return val;

    const questionText = val.question_text ?? val.questionText ?? val.text ?? val.question ?? '';
    const correctAnswer = val.correct_answer ?? val.correctAnswer ?? val.correct ?? '';
    const rawOptions = val.options_json ?? val.optionsJson ?? val.options ?? [];

    let parsedOptions = rawOptions;
    if (typeof parsedOptions === 'string') {
        try {
            parsedOptions = JSON.parse(parsedOptions);
        } catch {
            parsedOptions = [];
        }
    }

    let qType = val.type ?? val.question_type ?? val.questionType ?? '';
    let codeSnippet = val.code_snippet ?? val.codeSnippet ?? '';
    let mediaUrl = val.media_url ?? val.mediaUrl ?? '';
    let rawOptionsArray = [];

    if (Array.isArray(parsedOptions)) {
        rawOptionsArray = parsedOptions;
    } else if (typeof parsedOptions === 'object' && parsedOptions !== null) {
        if (!qType && parsedOptions.type) qType = parsedOptions.type;
        if (!codeSnippet && (parsedOptions.code_snippet || parsedOptions.codeSnippet)) {
            codeSnippet = parsedOptions.code_snippet ?? parsedOptions.codeSnippet;
        }
        if (!mediaUrl && (parsedOptions.media_url || parsedOptions.mediaUrl)) {
            mediaUrl = parsedOptions.media_url ?? parsedOptions.mediaUrl;
        }

        if (Array.isArray(parsedOptions.options)) {
            rawOptionsArray = parsedOptions.options;
        } else if (typeof parsedOptions.options === 'object' && parsedOptions.options !== null) {
            const reservedKeys = ['type', 'options_json', 'code_snippet', 'media_url', 'codeSnippet', 'mediaUrl'];
            rawOptionsArray = Object.entries(parsedOptions.options)
                .filter(([k]) => !reservedKeys.includes(k))
                .map(([k, v]) => (typeof v === 'object' && v !== null ? { id: k, ...v } : { id: k, text: String(v) }));
        } else {
            const reservedKeys = ['type', 'options_json', 'code_snippet', 'media_url', 'codeSnippet', 'mediaUrl', 'options'];
            rawOptionsArray = Object.entries(parsedOptions)
                .filter(([k]) => !reservedKeys.includes(k))
                .map(([k, v]) => (typeof v === 'object' && v !== null ? { id: k, ...v } : { id: k, text: String(v) }));
        }
    }

    if (!qType) qType = 'single_choice';

    const optionsList = rawOptionsArray.map((item, idx) => {
        if (typeof item === 'object' && item !== null) {
            let textVal = item.text ?? item.title ?? item.label ?? item.value ?? item.option;
            if (textVal === undefined || textVal === null || textVal === 'undefined') {
                textVal = (item.id !== undefined && item.id !== 'undefined') ? item.id : '';
            }
            textVal = String(textVal).trim();

            let idVal = item.id;
            if (idVal === undefined || idVal === null || idVal === '' || idVal === 'undefined') {
                idVal = (item.value !== undefined && item.value !== null && item.value !== '' && item.value !== 'undefined')
                    ? item.value
                    : `opt_${idx + 1}`;
            }
            idVal = String(idVal).trim();

            return {
                id: idVal,
                text: textVal
            };
        }

        let strVal = item;
        if (strVal === undefined || strVal === null || strVal === 'undefined') {
            strVal = '';
        } else {
            strVal = String(strVal).trim();
        }

        return {
            id: `opt_${idx + 1}`,
            text: strVal
        };
    });

    return {
        id: val.id,
        question_text: String(questionText),
        options_json: {
            type: String(qType),
            options: optionsList,
            code_snippet: String(codeSnippet ?? ''),
            media_url: String(mediaUrl ?? '')
        },
        correct_answer: String(correctAnswer)
    };
};

const testQuestionSchema = z.preprocess(
    normalizeQuestionData,
    z.object({
        id: z.string().optional(),
        question_text: z.string({
            required_error: 'Заполните текст вопроса',
            invalid_type_error: 'Текст вопроса должен быть строкой'
        }).trim().min(3, 'Текст вопроса слишком короткий (минимум 3 символа)'),
        options_json: z.object({
            type: z.string().default('single_choice'),
            options: z.array(optionItemSchema),
            code_snippet: optionalString,
            media_url: optionalString
        }),
        correct_answer: z.string({
            required_error: 'Укажите правильный ответ'
        }).trim().min(1, 'Укажите правильный ответ')
    })
).superRefine((q, ctx) => {
    const qType = q.options_json.type;
    const isTextOrNumeric = ['text_input', 'numeric_input'].includes(qType);
    const opts = q.options_json.options;

    if (isTextOrNumeric) {
        return;
    }

    const validOptionsCount = opts.filter(o => o.text.trim().length > 0 || o.id.trim().length > 0).length;
    if (validOptionsCount < 2) {
        ctx.addIssue({
            code: "custom",
            message: 'Для выбранного типа вопроса укажите минимум 2 варианта ответа',
            path: ['options_json']
        });
    }

    const rawAns = q.correct_answer.trim();
    if (!rawAns) {
        ctx.addIssue({
            code: "custom",
            message: 'Укажите правильный ответ',
            path: ['correct_answer']
        });
        return;
    }

    const checkSingleMatch = (part) => {
        const p = part.trim().toLowerCase();
        const pIdx = Number(p);

        return opts.some((o, idx) => {
            const idMatch = o.id.trim().toLowerCase() === p;
            const textMatch = o.text.trim().toLowerCase() === p;
            const idxMatch = !isNaN(pIdx) && pIdx === idx;
            return idMatch || textMatch || idxMatch;
        });
    };

    const isMatched = rawAns.split(',').every(checkSingleMatch);

    if (!isMatched) {
        ctx.addIssue({
            code: "custom",
            message: 'Указанный правильный ответ не совпадает ни с одним из предложенных вариантов ответа',
            path: ['correct_answer']
        });
    }
});

const saveTestSchema = z.preprocess((val) => {
    if (typeof val !== 'object' || val === null) return val;

    const timeLimitVal = val.time_limit ?? val.timeLimit ?? 15;
    const isUnlockedVal = val.is_unlocked ?? val.isUnlocked ?? false;

    return {
        ...val,
        title: val.title,
        description: val.description ?? '',
        difficulty: val.difficulty ?? 'Средний',
        is_unlocked: Boolean(isUnlockedVal),
        time_limit: Number(timeLimitVal),
        questions: val.questions ?? []
    };
}, z.looseObject({
    title: z.string().trim().min(3, 'Название теста должно содержать минимум 3 символа').max(200),
    description: z.string().optional().default(''),
    difficulty: z.string().optional().default('Средний'),
    is_unlocked: z.boolean().optional().default(false),
    time_limit: z.coerce.number()
        .int('Лимит времени должен быть целым числом')
        .min(1, 'Минимальное время — 1 минута')
        .max(180, 'Максимальное время — 180 минут')
        .default(15),
    questions: z.array(testQuestionSchema).min(1, 'Добавьте хотя бы один вопрос в тест')
}));

module.exports = {
    testQuestionSchema,
    saveTestSchema
};