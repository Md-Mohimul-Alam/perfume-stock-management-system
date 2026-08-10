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
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getSales)
  .post(protect, createSale);

router.post('/bulk', protect, bulkCreateSales);
router.get('/:id', protect, getSaleById);
router.put('/:id/payment', protect, updatePayment);   // optional, keep for backward compatibility
router.patch('/:id', protect, updatePayment);         // 👈 new – handles frontend PATCH
router.delete('/:id', protect, deleteSale);

module.exports = router;