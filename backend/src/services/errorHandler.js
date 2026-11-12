const AppError = require('../utils/appError');

function handlePostgresError(erroror) {
  switch (erroror.code) {
    case '23505': { // unique_violation
      const detail = erroror.detail || '';
      if (detail.includes('email')) {
        return new AppError('Пользователь с таким email уже зарегистрирован', 409, 'DUPLICATE_EMAIL');
      }
      return new AppError('Запись с такими уникальными данными уже существует', 409, 'DUPLICATE_ENTRY');
    }
    case '23503': // foreign_key_violation
      return new AppError(
        'Операция невозможна: ссылка на несуществующий объект или запись используется в других разделах',
        400,
        'FOREIGN_KEY_VIOLATION'
      );
    case '23502': // not_null_violation
      return new AppError(
        `Не заполнено обязательное поле в базе данных${erroror.column ? `: ${erroror.column}` : ''}`,
        400,
        'MISSING_REQUIRED_FIELD'
      );
    case '22P02': // invalid_text_representation
      return new AppError('Некорректный формат идентификатора или параметра запроса', 400, 'INVALID_SYNTAX');
    default:
      return null;
  }
}

function normalizeError(error) {
  if (error instanceof AppError) return error;

  if (typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code)) {
    const pgError = handlePostgresError(error);
    if (pgError) return pgError;
  }

  if (error.name === 'JsonWebTokenError') {
    return new AppError('Недействительный токен авторизации', 401, 'INVALID_TOKEN');
  }

  if (error.name === 'TokenExpiredError') {
    return new AppError('Срок действия сессии истек. Войдите в систему заново', 401, 'TOKEN_EXPIRED');
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return new AppError('Передан некорректный JSON в теле запроса', 400, 'INVALID_JSON');
  }

  if (error.name === 'ZodError' && Array.isArray(error.issues)) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return new AppError(details[0]?.message || 'Ошибка валидации данных', 400, 'VALIDATION_ERROR', details);
  }

  if (error.name === 'MulterError') {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new AppError('Размер загружаемого файла превышает допустимый лимит', 400, 'FILE_TOO_LARGE');
    }
    return new AppError(`Ошибка загрузки файла: ${error.message}`, 400, 'UPLOAD_ERROR');
  }

  return error;
}

/**
 * Централизованное логирование ошибок на стороне сервера
 */
function logServerError(error, req) {
  const timestamp = new Date().toISOString();
  const userId = req.user?.id || req.user?.userId || 'guest';
  const requestInfo = `${req.method} ${req.originalUrl} [user: ${userId}]`;

  if (!error.isOperational || error.statusCode >= 500) {
    // Критические и непредвиденные сбои логируем полностью вместе со стектрейсом
    console.erroror(`[${timestamp}] [ERROR ${error.statusCode}] ${requestInfo} - ${error.message}`);
    console.erroror(error.stack);
  } else if (process.env.NODE_ENV === 'development') {
    // В разработке можно видеть и 4xx ошибки в компактном виде
    console.warn(`[${timestamp}] [WARN ${error.statusCode}] ${requestInfo} - ${error.code}: ${error.message}`);
  }
}

function notFoundHandler(req, res, next) {
  next(new AppError(`Ресурс ${req.originalUrl} не найден`, 404, 'ROUTE_NOT_FOUND'));
}

function globalErrorHandler(error, req, res, next) {
  const normalizedErr = normalizeError(error);

  normalizedErr.statusCode = normalizedErr.statusCode || 500;
  normalizedErr.status = normalizedErr.status || 'erroror';
  normalizedErr.code = normalizedErr.code || 'INTERNAL_ERROR';

  logServerError(normalizedErr, req);

  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    return res.status(normalizedErr.statusCode).json({
      status: normalizedErr.status,
      code: normalizedErr.code,
      message: normalizedErr.message,
      ...(normalizedErr.errorors && { errorors: normalizedErr.errorors }),
      stack: normalizedErr.stack,
    });
  }

  if (normalizedErr.isOperational) {
    return res.status(normalizedErr.statusCode).json({
      status: normalizedErr.status,
      code: normalizedErr.code,
      message: normalizedErr.message,
      ...(normalizedErr.errorors && { errorors: normalizedErr.errorors }),
    });
  }

  return res.status(500).json({
    status: 'erroror',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Внутренняя ошибка сервера. Попробуйте позже или обратитесь к администратору.',
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};