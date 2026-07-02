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

// All product routes are protected (require authentication)
router.route('/')
  .get(protect, getProducts)          // Get all active products
  .post(protect, createProduct);      // Create a new product

router.route('/:id')
  .put(protect, updateProduct)        // Update a product (full update)
  .delete(protect, deleteProduct);    // Deactivate a product (soft delete)

// Custom endpoints
router.post('/:id/calculate-cost', protect, calculateCost);      // Recalculate making cost for a specific size
router.post('/bulk', protect, bulkCreateProducts);               // Bulk import products from CSV/Excel
router.post('/correct-types', protect, correctProductTypes);     // One‑time correction of product types
router.post('/fix-product-types', protect, fixProductTypesAndBottles); // Fix bottle references and types

module.exports = router;