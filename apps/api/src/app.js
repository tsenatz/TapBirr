const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Request logging

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

// Catch-all for non-existent routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    errorCode: 'NOT_FOUND',
    message: 'Resource not found',
    details: null
  });
});

// Error Handling Middleware
app.use(errorHandler);

module.exports = app;

