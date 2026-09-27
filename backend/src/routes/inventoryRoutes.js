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
  stockOutMaterial,
  adjustMaterialStock,
} = require('../controllers/inventoryController');

const {
  getBottlesWithSales,
  stockOutBottle,   // ✅ NEW
  wasteBottle,      // ✅ NEW
} = require('../controllers/bottleController');

const { protect } = require('../middlewares/authMiddleware');

// ============================================
// Raw materials
// ============================================
router.route('/materials')
  .get(protect, getMaterials)
  .post(protect, createMaterial);

router.route('/materials/:id')
  .get(protect, getMaterialById)
  .put(protect, updateMaterial)
  .delete(protect, deleteMaterial);

// ✅ Stock-out route (raw materials)
router.route('/materials/:id/stock-out')
  .post(protect, stockOutMaterial);

// ✅ Manual stock adjustment (recount reconciliation)
router.route('/materials/:id/adjust')
  .post(protect, adjustMaterialStock);

// ============================================
// Bottles
// ============================================
router.route('/bottles')
  .get(protect, getBottles)
  .post(protect, createBottle);

router.route('/bottles/:id')
  .put(protect, updateBottle)
  .delete(protect, deleteBottle);

router.post('/bottles/:id/purchase', protect, addBottlePurchase);

// ✅ NEW: Bottle stock-out (full – remaining → wastage)
router.post('/bottles/:id/stock-out', protect, stockOutBottle);

// ✅ NEW: Bottle waste (partial)
router.post('/bottles/:id/waste', protect, wasteBottle);

// ============================================
// Bulk & import endpoints
// ============================================
router.post('/materials/bulk', protect, bulkCreateMaterials);
router.post('/bottles/bulk', protect, bulkCreateBottles);
router.post('/materials/import', protect, importMaterialsWithPurchases);
router.post('/bottles/bulk-add-stock', protect, bulkAddStockToBottles);

// ============================================
// Aggregated data
// ============================================
router.get('/bottles/with-sales', protect, getBottlesWithSales);

// ============================================
// Inventory logs
// ============================================
router.get('/logs', protect, getLogs);

module.exports = router;