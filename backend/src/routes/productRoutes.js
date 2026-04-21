const express = require('express');
const router = express.Router();
const {
  getProducts,
  createProduct,
  updateProduct,
  calculateCost,
  deleteProduct,
} = require('../controllers/productController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getProducts)
  .post(protect, createProduct);

router.route('/:id')
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

router.post('/:id/calculate-cost', protect, calculateCost);

module.exports = router;