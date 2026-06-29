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
  fixProductTypesAndBottles,   // 👈 new
} = require('../controllers/productController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getProducts)
  .post(protect, createProduct);

router.route('/:id')
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

router.post('/:id/calculate-cost', protect, calculateCost);
router.post('/bulk', protect, bulkCreateProducts);
router.post('/correct-types', protect, correctProductTypes);
router.post('/fix-product-types', protect, fixProductTypesAndBottles);   // 👈 new

module.exports = router;