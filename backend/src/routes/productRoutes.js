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
  triggerBestsellerUpdate,           // 👈 new
} = require('../controllers/productController');
const { protect, admin } = require('../middlewares/authMiddleware'); // ensure admin middleware exists

// All routes are protected (require auth)
router.route('/')
  .get(protect, getProducts)
  .post(protect, createProduct);

router.route('/:id')
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

router.post('/:id/calculate-cost', protect, calculateCost);
router.post('/bulk', protect, bulkCreateProducts);
router.post('/correct-types', protect, correctProductTypes);
router.post('/fix-product-types', protect, fixProductTypesAndBottles);

// 👇 New endpoint – can be triggered manually (only admin)
router.post('/update-bestsellers', protect, admin, triggerBestsellerUpdate);

module.exports = router;