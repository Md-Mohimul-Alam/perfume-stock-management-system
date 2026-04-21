const express = require('express');
const router = express.Router();
const {
  createPurchase,
  getPurchases,
  getPurchaseById,
} = require('../controllers/purchaseController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getPurchases)
  .post(protect, createPurchase);

router.get('/:id', protect, getPurchaseById);

module.exports = router;