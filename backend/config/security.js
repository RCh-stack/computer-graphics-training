const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Слишком много запросов с этого IP. Попробуйте позже',
  },
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10, 
  message: {
    status: 'fail',
    message: 'Слишком много попыток входа. Попробуйте позже.',
  },
});

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
});

module.exports = {
  corsMiddleware: cors(corsOptions),
  apiLimiter,
  authLimiter,
  helmetMiddleware: helmetConfig,
};