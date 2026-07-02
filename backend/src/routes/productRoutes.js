// src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const {
  getProducts,
  createProduct,
  updateProduct,
  calculateCost,
  deleteProduct,
  bulkCreateProducts,
  correctProductTypes,
  fixProductTypesAndBottles,
} = require('../controllers/productController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getProducts)
  .post(protect, createProduct);

router.route('/:id')
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

// ✅ Bulk route is here
router.post('/bulk', protect, bulkCreateProducts);  // Make sure this exists!

router.post('/:id/calculate-cost', protect, calculateCost);
router.post('/correct-types', protect, correctProductTypes);
router.post('/fix-product-types', protect, fixProductTypesAndBottles);

module.exports = router;