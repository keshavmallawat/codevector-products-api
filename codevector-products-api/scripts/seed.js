const db = require('../src/db');

async function seed() {
  console.log('--- Database Seeding Started ---');
  const startTime = new Date();
  console.log(`Start Time: ${startTime.toISOString()}`);

  try {
    // 1. Create table if it doesn't exist
    console.log('Creating table "products" if not exists...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // 2. Create indexes
    console.log('Creating indexes...');
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category_created_at_id 
      ON products (category, created_at DESC, id DESC);
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_products_created_at_id 
      ON products (created_at DESC, id DESC);
    `);

    // 3. Clear existing products for idempotency
    console.log('Clearing existing product records...');
    await db.query('TRUNCATE TABLE products RESTART IDENTITY;');

    // 4. Seed exactly 200,000 products using generate_series()
    console.log('Inserting 200,000 mock products via generate_series()...');
    
    // We sequentially decrement created_at by 10-second intervals for s.id
    // This gives a clean, deterministic, chronological distribution
    await db.query(`
      INSERT INTO products (name, description, price, category, created_at, updated_at)
      SELECT 
        'Product ' || s.id AS name,
        'This is the description for Product ' || s.id AS description,
        (random() * 990 + 10)::numeric(10,2) AS price,
        (ARRAY[
          'Electronics', 
          'Clothing', 
          'Home & Kitchen', 
          'Books', 
          'Sports & Outdoors', 
          'Beauty & Personal Care'
        ])[floor(random() * 6) + 1] AS category,
        NOW() - (s.id || ' seconds')::INTERVAL AS created_at,
        NOW() - (s.id || ' seconds')::INTERVAL AS updated_at
      FROM generate_series(1, 200000) AS s(id);
    `);

    // 5. Query final row count to verify
    const countResult = await db.query('SELECT COUNT(*) FROM products;');
    const totalCount = countResult.rows[0].count;

    const endTime = new Date();
    const durationMs = endTime - startTime;
    const durationSec = (durationMs / 1000).toFixed(2);

    console.log('\n--- Seeding Completed Successfully ---');
    console.log(`End Time: ${endTime.toISOString()}`);
    console.log(`Execution Duration: ${durationSec} seconds (${durationMs} ms)`);
    console.log(`Total Row Count in Database: ${totalCount}`);

  } catch (error) {
    console.error('Seeding failed with error:', error);
  } finally {
    // End database pool connection
    await db.pool.end();
    console.log('Database pool connection closed.');
  }
}

seed();
