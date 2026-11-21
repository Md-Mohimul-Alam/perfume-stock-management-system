
const express = require('express');
const router = express.Router();

const {
  createSale,
  getSales,
  getSaleById,
  updatePayment,
  bulkCreateSales,
  deleteSale,
} = require('../controllers/saleController');

const {
  protect,
  admin,
} = require('../middlewares/authMiddleware');

// View sales and create individual sales
router.route('/')
  .get(protect, getSales)
  .post(protect, createSale);

// Bulk sales import - Admin only
router.post(
  '/bulk',
  protect,
  admin,
  bulkCreateSales
);

// View individual sale
router.get(
  '/:id',
  protect,
  getSaleById
);

// Update payment status - Admin only
router.put(
  '/:id/payment',
  protect,
  admin,
  updatePayment
);

// Backward compatibility with frontend PATCH
router.patch(
  '/:id',
  protect,
  admin,
  updatePayment
);

// Delete sale - Admin only
router.delete(
  '/:id',
  protect,
  admin,
  deleteSale
);

module.exports = router;
