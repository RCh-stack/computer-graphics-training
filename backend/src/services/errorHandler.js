const AppError = require('../utils/appError');

function notFoundHandler(req, res, next) {
  next(new AppError(`Ресурс ${req.originalUrl} не найден`, 404));
}

function globalErrorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,     
    });
  }

  return res.status(500).json({
    status: 'error',
    message: 'Что-то пошло не так!',
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};