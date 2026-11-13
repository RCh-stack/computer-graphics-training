const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const Sentry = require('./src/utils/instrument');

const express = require('express');

const {
  corsMiddleware,
  apiLimiter,
  authLimiter,
  helmetMiddleware,
} = require('./config/security');

const app = express();
const URL = process.env.URL;
const PORT = process.env.PORT;

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use('/api/v1', apiLimiter);
app.use(express.json({ limit: '10kb' }));

const authRoutes = require('./src/routers/auth');
const userRoutes = require('./src/routers/users');
const ebookRoutes = require('./src/routers/ebook');
const labRoutes = require('./src/routers/labs');
const testRoutes = require('./src/routers/tests');
const progressRoutes = require('./src/routers/progress');
const adminRoutes = require('./src/routers/admin');
const newsRoutes = require('./src/routers/news');

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/ebook', ebookRoutes);
app.use('/api/v1/labs', labRoutes);
app.use('/api/v1/tests', testRoutes);
app.use('/api/v1/progress', progressRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/news', newsRoutes);

const { notFoundHandler, globalErrorHandler } = require('./src/services/errorHandler.js');
app.use('/api', notFoundHandler);
app.use(globalErrorHandler);

app.listen(PORT, () => {
    console.log(`server start ${URL}:${PORT}`);
});

process.on('unhandledRejection', (error) => {
  console.error('[UNHANDLED REJECTION]', error);
  Sentry.captureException(err);
});

process.on('uncaughtException', async (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  await Sentry.close(2000);
  process.exit(1);
});