const Product = require('../models/Product');
const Sale = require('../models/Sale');

/**
 * Updates the `isBestseller` flag for products based on sales.
 * Top N bestsellers are selected separately for each product type (spray and roll-on).
 * 
 * @param {number} topN - Number of top-selling products per type to mark (default: 5)
 * @param {string} timeRange - 'all', 'month', 'week' (default: 'all')
 * @returns {Promise<Array>} – Array of product IDs that became bestsellers
 */
exports.updateBestsellers = async (topN = 5, timeRange = 'all') => {
  const dateFilter = {};
  if (timeRange === 'month') {
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    dateFilter.saleDate = { $gte: start };
  } else if (timeRange === 'week') {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    dateFilter.saleDate = { $gte: start };
  }

  // Aggregate pipeline:
  // 1. Match paid sales within time range
  // 2. Unwind items
  // 3. Lookup product type
  // 4. Group by productId + type, sum quantity
  // 5. Rank within each type by totalSold
  // 6. Keep only top N per type
  // 7. Extract product IDs
  const pipeline = [
    { $match: { ...dateFilter, paymentStatus: 'paid' } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $group: {
        _id: {
          productId: '$items.product',
          type: '$productInfo.type'
        },
        totalSold: { $sum: '$items.quantity' }
      }
    },
    // Rank within each type
    {
      $setWindowFields: {
        partitionBy: '$_id.type',
        sortBy: { totalSold: -1 },
        output: {
          rank: { $rank: {} }
        }
      }
    },
    { $match: { rank: { $lte: topN } } },
    // Extract product IDs
    { $group: { _id: null, productIds: { $push: '$_id.productId' } } }
  ];

  const result = await Sale.aggregate(pipeline);
  const topProductIds = result.length > 0 ? result[0].productIds : [];

  // Reset all bestsellers to false, then set the top ones per type
  await Product.updateMany({}, { isBestseller: false });
  if (topProductIds.length) {
    await Product.updateMany(
      { _id: { $in: topProductIds } },
      { isBestseller: true }
    );
  }

  return topProductIds;
};