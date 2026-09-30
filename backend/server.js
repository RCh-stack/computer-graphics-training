require('dotenv').config();

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
const labRoutes = require('./src/routers/labs');
const testRoutes = require('./src/routers/tests');
const progressRoutes = require('./src/routers/progress');

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/labs', labRoutes);
app.use('/api/v1/tests', testRoutes);
app.use('/api/v1/progress', progressRoutes);

const { notFoundHandler, globalErrorHandler } = require('./src/services/errorHandler.js');
app.use(notFoundHandler);
app.use(globalErrorHandler);

app.listen(PORT, () => {
    console.log(`server start ${URL}:${PORT}`);
});