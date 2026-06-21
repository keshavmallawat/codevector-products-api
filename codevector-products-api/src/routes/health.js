const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({
      status: 'ok',
      db: 'connected',
      time: result.rows[0].now
    });
  } catch (error) {
    console.error('Database connection error:', error.message);
    res.status(503).json({
      status: 'error',
      db: 'disconnected'
    });
  }
});

module.exports = router;
