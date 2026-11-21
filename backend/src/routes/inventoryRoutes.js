
const express = require('express');
const router = express.Router();

const {
  getMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,

  getBottles,
  getPublicBottles,
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
  stockOutBottle,
  wasteBottle,
} = require('../controllers/bottleController');

const {
  protect,
  admin,
} = require('../middlewares/authMiddleware');

/* ========================================
   PUBLIC BOTTLES

   Keep this before /bottles/:id.
======================================== */

router.get(
  '/bottles/public',
  getPublicBottles
);

/* ========================================
   RAW MATERIALS
======================================== */

// Read
router.get(
  '/materials',
  protect,
  getMaterials
);

router.get(
  '/materials/:id',
  protect,
  getMaterialById
);

// Create, update and delete
router.post(
  '/materials',
  protect,
  admin,
  createMaterial
);

router.put(
  '/materials/:id',
  protect,
  admin,
  updateMaterial
);

router.delete(
  '/materials/:id',
  protect,
  admin,
  deleteMaterial
);

// Stock operations
router.post(
  '/materials/:id/stock-out',
  protect,
  admin,
  stockOutMaterial
);

router.post(
  '/materials/:id/adjust',
  protect,
  admin,
  adjustMaterialStock
);

/* ========================================
   BOTTLE AGGREGATED DATA
======================================== */

router.get(
  '/bottles/with-sales',
  protect,
  getBottlesWithSales
);

/* ========================================
   BOTTLES
======================================== */

// Read
router.get(
  '/bottles',
  protect,
  getBottles
);

// Create
router.post(
  '/bottles',
  protect,
  admin,
  createBottle
);

// Update
router.put(
  '/bottles/:id',
  protect,
  admin,
  updateBottle
);

// Delete
router.delete(
  '/bottles/:id',
  protect,
  admin,
  deleteBottle
);

// Bottle purchase
router.post(
  '/bottles/:id/purchase',
  protect,
  admin,
  addBottlePurchase
);

// Bottle stock-out
router.post(
  '/bottles/:id/stock-out',
  protect,
  admin,
  stockOutBottle
);

// Bottle wastage
router.post(
  '/bottles/:id/waste',
  protect,
  admin,
  wasteBottle
);

/* ========================================
   BULK / IMPORT
======================================== */

router.post(
  '/materials/bulk',
  protect,
  admin,
  bulkCreateMaterials
);

router.post(
  '/bottles/bulk',
  protect,
  admin,
  bulkCreateBottles
);

router.post(
  '/materials/import',
  protect,
  admin,
  importMaterialsWithPurchases
);

router.post(
  '/bottles/bulk-add-stock',
  protect,
  admin,
  bulkAddStockToBottles
);

/* ========================================
   INVENTORY LOGS
======================================== */

router.get(
  '/logs',
  protect,
  getLogs
);

module.exports = router;
