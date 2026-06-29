const express = require('express');
const router = express.Router();
const {
  createPurchase,
  getPurchases,
  getPurchaseById,
  bulkCreatePurchases,
} = require('../controllers/purchaseController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getPurchases)
  .post(protect, createPurchase);

// ✅ Corrected – use the imported function directly
router.post('/bulk', protect, bulkCreatePurchases);

router.get('/:id', protect, getPurchaseById);

module.exports = router;