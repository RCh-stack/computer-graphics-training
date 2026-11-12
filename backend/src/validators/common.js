const { z } = require('zod');

const uuidParamSchema = z.object({
    id: z.uuid('Некорректный формат идентификатора (ожидается UUID)')
});

const languageEnum = z.enum(['cpp', 'python', 'csharp', 'go'], {
    errorMap: () => ({ message: 'Неподдерживаемый язык программирования (допустимы: cpp, python, csharp, go)' })
});

module.exports = {
    uuidParamSchema,
    languageEnum
};