const db = require('../db');

/**
 * Decodes a base64 encoded cursor into an object containing timestamp (created_at) and id.
 * Returns null if the cursor is missing or malformed.
 */
function decodeCursor(cursorStr) {
  if (!cursorStr) return null;
  try {
    const jsonStr = Buffer.from(cursorStr, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (!parsed.t || !parsed.i) return null;
    return {
      createdAt: new Date(parsed.t).toISOString(),
      id: parsed.i
    };
  } catch (error) {
    console.error('Failed to decode cursor safely. Falling back to page 1.', error.message);
    return null;
  }
}

/**
 * Encodes a row's created_at timestamp and id into a Base64 cursor string.
 */
function encodeCursor(createdAt, id) {
  const payload = {
    t: new Date(createdAt).getTime(),
    i: id
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Service to fetch a page of products with cursor-based pagination.
 */
async function getProducts({ limit, category, cursor }) {
  const limitPlusOne = limit + 1;
  const decoded = decodeCursor(cursor);

  let queryText = '';
  const queryParams = [];

  if (category) {
    queryParams.push(category); // $1

    if (decoded) {
      queryParams.push(decoded.createdAt); // $2
      queryParams.push(decoded.id);        // $3
      queryParams.push(limitPlusOne);     // $4
      
      queryText = `
        SELECT id, name, description, price, category, created_at, updated_at
        FROM products
        WHERE category = $1
          AND (
            created_at < $2
            OR (created_at = $2 AND id < $3)
          )
        ORDER BY created_at DESC, id DESC
        LIMIT $4;
      `;
    } else {
      queryParams.push(limitPlusOne);     // $2
      
      queryText = `
        SELECT id, name, description, price, category, created_at, updated_at
        FROM products
        WHERE category = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2;
      `;
    }
  } else {
    if (decoded) {
      queryParams.push(decoded.createdAt); // $1
      queryParams.push(decoded.id);        // $2
      queryParams.push(limitPlusOne);     // $3
      
      queryText = `
        SELECT id, name, description, price, category, created_at, updated_at
        FROM products
        WHERE (
          created_at < $1
          OR (created_at = $1 AND id < $2)
        )
        ORDER BY created_at DESC, id DESC
        LIMIT $3;
      `;
    } else {
      queryParams.push(limitPlusOne);     // $1
      
      queryText = `
        SELECT id, name, description, price, category, created_at, updated_at
        FROM products
        ORDER BY created_at DESC, id DESC
        LIMIT $1;
      `;
    }
  }

  const result = await db.query(queryText, queryParams);
  const rows = result.rows;

  let hasMore = false;
  let nextCursor = null;

  // If we fetched the extra row, there is a next page
  if (rows.length === limitPlusOne) {
    hasMore = true;
    // Discard the extra (last) row
    rows.pop();
    
    // Generate nextCursor using the new last row in the list (the limit-th item)
    const lastRow = rows[rows.length - 1];
    nextCursor = encodeCursor(lastRow.created_at, lastRow.id);
  }

  return {
    data: rows,
    nextCursor,
    hasMore
  };
}

module.exports = {
  getProducts
};
