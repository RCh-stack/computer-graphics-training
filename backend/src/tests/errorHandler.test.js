const AppError = require('../utils/appError');
const { globalErrorHandler } = require('../services/errorHandler');

describe('Unit: Server Error Handler', () => {
    let req, res, next;

    beforeEach(() => {
        req = {};
        res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    test('Ошибка Not Found (404)', () => {
        const error = new AppError('Ресурс не найден', 404);

        expect(error.statusCode).toBe(404);
        expect(error.status).toBe('fail');
        expect(error.isOperational).toBe(true);
        expect(error.message).toBe('Ресурс не найден');
    });

    test('Ошибка Unauthorized (401)', () => {
        const error = new AppError('Пользователь не найден', 401);

        expect(error.statusCode).toBe(401);
        expect(error.status).toBe('fail');
        expect(error.message).toBe('Пользователь не найден');
    });

    test('Сторонняя ошибка сервера (500)', () => {
        process.env.NODE_ENV = 'production';
        const err = new Error('Отсутствует указанная таблица базы данных');

        globalErrorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Что-то пошло не так!',
        });
    });
});