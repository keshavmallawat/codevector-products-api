const express = require('express');
const cors = require('cors');
require('dotenv').config();

const healthRouter = require('./routes/health');

const app = express();

// Standard Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

module.exports = app;
