const express = require('express');
const router = express.Router();
const {
  getMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getBottles,
  createBottle,
  updateBottle,
  deleteBottle,
  getLogs,
  bulkCreateMaterials,
  bulkCreateBottles,
  importMaterialsWithPurchases,
  bulkAddStockToBottles,
  addBottlePurchase,
} = require('../controllers/inventoryController');
const { protect } = require('../middlewares/authMiddleware');

// Raw materials
router.route('/materials')
  .get(protect, getMaterials)
  .post(protect, createMaterial);

router.route('/materials/:id')
  .get(protect, getMaterialById)
  .put(protect, updateMaterial)
  .delete(protect, deleteMaterial);

// Bottles
router.route('/bottles')
  .get(protect, getBottles)
  .post(protect, createBottle);

router.route('/bottles/:id')
  .put(protect, updateBottle)
  .delete(protect, deleteBottle);

// Inventory logs
router.get('/logs', protect, getLogs);
router.post('/bottles/:id/purchase', protect, addBottlePurchase);
// Bulk and import endpoints
router.post('/materials/bulk', protect, bulkCreateMaterials);
router.post('/bottles/bulk', protect, bulkCreateBottles);
router.post('/materials/import', protect, importMaterialsWithPurchases);
router.post('/bottles/bulk-add-stock', protect, bulkAddStockToBottles);

module.exports = router;