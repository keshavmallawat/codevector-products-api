const productsService = require('../services/productsService');

async function listProducts(req, res, next) {
  try {
    let { limit, category, cursor } = req.query;

    // 1. Validate limit (default 20, max 100, must be positive integer)
    let limitVal = parseInt(limit, 10);
    if (isNaN(limitVal) || limitVal <= 0) {
      limitVal = 20;
    } else if (limitVal > 100) {
      limitVal = 100;
    }

    // 2. Query data via service layer
    const result = await productsService.getProducts({
      limit: limitVal,
      category: category ? String(category).trim() : null,
      cursor: cursor ? String(cursor).trim() : null
    });

    // 3. Return response payload
    res.json({
      data: result.data,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listProducts
};
