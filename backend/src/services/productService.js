const Product = require('../models/Product');
const Sale = require('../models/Sale');

/**
 * Updates the `isBestseller` flag for products based on sales.
 * @param {number} topN - Number of top-selling products to mark (default: 5)
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

  // Aggregate paid sales
  const pipeline = [
    { $match: { ...dateFilter, paymentStatus: 'paid' } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: topN },
  ];

  const topProducts = await Sale.aggregate(pipeline);
  const topProductIds = topProducts.map(item => item._id);

  // Reset all bestsellers to false, then set the top ones
  await Product.updateMany({}, { isBestseller: false });
  if (topProductIds.length) {
    await Product.updateMany(
      { _id: { $in: topProductIds } },
      { isBestseller: true }
    );
  }

  return topProductIds;
};