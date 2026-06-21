const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Neon requires SSL. Setting rejectUnauthorized to false allows connection without custom certificates.
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
