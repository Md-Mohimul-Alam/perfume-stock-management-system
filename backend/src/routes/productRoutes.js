
const express = require('express');
const router = express.Router();

const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  calculateCost,
  deleteProduct,
  bulkCreateProducts,
  correctProductTypes,
  fixProductTypesAndBottles,
  triggerBestsellerUpdate,
} = require('../controllers/productController');

const {
  protect,
  admin,
} = require('../middlewares/authMiddleware');

// Public product listing.
router.get('/', getProducts);
router.get('/:id', getProductById);

// Authenticated product management.
router.post('/', protect, createProduct);
router.put('/:id', protect, updateProduct);
router.patch('/:id', protect, updateProduct);
router.delete('/:id', protect, admin, deleteProduct);

// Administrative maintenance operations.
router.post(
  '/:id/calculate-cost',
  protect,
  admin,
  calculateCost
);

router.post(
  '/bulk',
  protect,
  admin,
  bulkCreateProducts
);

router.post(
  '/correct-types',
  protect,
  admin,
  correctProductTypes
);

router.post(
  '/fix-product-types',
  protect,
  admin,
  fixProductTypesAndBottles
);

router.post(
  '/update-bestsellers',
  protect,
  admin,
  triggerBestsellerUpdate
);

module.exports = router;
