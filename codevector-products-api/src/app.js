const express = require('express');
const cors = require('cors');
require('dotenv').config();

const healthRouter = require('./routes/health');
const productsRouter = require('./routes/products');

const app = express();

// Standard Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    service: 'CodeVector Products API',
    status: 'running',
    endpoints: [
      '/api/health',
      '/api/products'
    ]
  });
});

app.use('/api/health', healthRouter);
app.use('/api/products', productsRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

module.exports = app;
