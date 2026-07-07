const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,           // <-- add this import
  createProduct,
  updateProduct,
  calculateCost,
  deleteProduct,
  bulkCreateProducts,
  correctProductTypes,
  fixProductTypesAndBottles,
  triggerBestsellerUpdate,
} = require('../controllers/productController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/')
  .get(getProducts)
  .post(protect, createProduct);

router.route('/:id')
  .get(getProductById)      // <-- add this route
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

router.post('/:id/calculate-cost', calculateCost);
router.post('/bulk', protect, bulkCreateProducts);
router.post('/correct-types', correctProductTypes);
router.post('/fix-product-types', protect, fixProductTypesAndBottles);
router.post('/update-bestsellers', protect, admin, triggerBestsellerUpdate);

module.exports = router;