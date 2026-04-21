const express = require('express');
const router = express.Router();
const {
  createSale,
  getSales,
  getSaleById,
  updatePayment,
} = require('../controllers/saleController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getSales)
  .post(protect, createSale);

router.get('/:id', protect, getSaleById);
router.put('/:id/payment', protect, updatePayment);

module.exports = router;