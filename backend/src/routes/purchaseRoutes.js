const express = require('express');
const router = express.Router();
const {
  createPurchase,
  getPurchases,
  getPurchaseById,
  bulkCreatePurchases,
  updatePurchase,
  deletePurchase,
} = require('../controllers/purchaseController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getPurchases)
  .post(protect, createPurchase);

router.post('/bulk', protect, bulkCreatePurchases);

router.route('/:id')
  .get(protect, getPurchaseById)
  .put(protect, updatePurchase)
  .delete(protect, deletePurchase);

module.exports = router;