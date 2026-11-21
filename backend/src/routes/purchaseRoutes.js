
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

const {
  protect,
  admin,
} = require('../middlewares/authMiddleware');

/*
  All authenticated users can view purchases.
  Only admins can create, import, edit, or delete.
*/

router.route('/')
  .get(protect, getPurchases)
  .post(protect, admin, createPurchase);

router.post(
  '/bulk',
  protect,
  admin,
  bulkCreatePurchases
);

router.route('/:id')
  .get(protect, getPurchaseById)
  .put(protect, admin, updatePurchase)
  .delete(protect, admin, deletePurchase);

module.exports = router;
