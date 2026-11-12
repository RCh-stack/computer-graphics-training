const { z } = require('zod');

const baseWidgetSchema = z.looseObject({
    id: z.string().min(1).optional(),
    type: z.string().trim().min(1, 'Укажите тип виджета'),
    title: z.string().trim().optional(),
    config: z.record(z.any()).optional()
});

const widgetsConfigSchema = z.preprocess((val) => {
    if (typeof val === 'string') {
        if (!val.trim()) return [];
        try {
            return JSON.parse(val);
        } catch {
            return val;
        }
    }
    return val;
}, z.array(baseWidgetSchema, {
    invalid_type_error: 'Поле widgets_config должно быть массивом виджетов'
}).optional().default([]));

const saveArticleSchema = z.preprocess((val) => {
    if (typeof val !== 'object' || val === null) return val;

    const chapterId = val.chapter_id ?? val.chapterId;
    const contentPath = val.content_path ?? val.contentPath ?? '';
    const widgetsConfig = val.widgets_config ?? val.widgetsConfig ?? [];
    const htmlContent = val.content ?? val.html ?? val.content_html ?? val.contentHtml ?? val.body ?? '';

    return {
        ...val,
        chapter_id: chapterId,
        content_path: contentPath === null ? '' : String(contentPath),
        widgets_config: widgetsConfig,
        content: typeof htmlContent === 'string' ? htmlContent : ''
    };
}, z.looseObject({
    title: z.string({
        required_error: 'Заголовок статьи обязателен'
    }).trim().min(2, 'Заголовок статьи должен содержать минимум 2 символа').max(250),
    content_path: z.string().trim().optional().default(''),
    content: z.string().optional().default(''),
    order: z.coerce.number().int().min(0).default(0),
    widgets_config: widgetsConfigSchema
}));

module.exports = {
    widgetsConfigSchema,
    saveArticleSchema
};