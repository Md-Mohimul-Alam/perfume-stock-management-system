const express =
  require('express');

const router =
  express.Router();

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
} = require('../middlewares/authMiddleware');

/* ========================================
   PUBLIC BOTTLE CATALOGUE

   Customer website can access this.
======================================== */

router.get(
  '/bottles/public',
  getPublicBottles
);

/* ========================================
   RAW MATERIALS
======================================== */

router
  .route('/materials')
  .get(
    protect,
    getMaterials
  )
  .post(
    protect,
    createMaterial
  );

router
  .route('/materials/:id')
  .get(
    protect,
    getMaterialById
  )
  .put(
    protect,
    updateMaterial
  )
  .delete(
    protect,
    deleteMaterial
  );

/* ========================================
   MATERIAL STOCK OUT
======================================== */

router.post(
  '/materials/:id/stock-out',
  protect,
  stockOutMaterial
);

/* ========================================
   MATERIAL ADJUSTMENT
======================================== */

router.post(
  '/materials/:id/adjust',
  protect,
  adjustMaterialStock
);

/* ========================================
   BOTTLES WITH SALES / USAGE
======================================== */

router.get(
  '/bottles/with-sales',
  protect,
  getBottlesWithSales
);

/* ========================================
   BOTTLES
======================================== */

router
  .route('/bottles')
  .get(
    protect,
    getBottles
  )
  .post(
    protect,
    createBottle
  );

router
  .route('/bottles/:id')
  .put(
    protect,
    updateBottle
  )
  .delete(
    protect,
    deleteBottle
  );

/* ========================================
   BOTTLE PURCHASE
======================================== */

router.post(
  '/bottles/:id/purchase',
  protect,
  addBottlePurchase
);

/* ========================================
   BOTTLE STOCK OUT
======================================== */

router.post(
  '/bottles/:id/stock-out',
  protect,
  stockOutBottle
);

/* ========================================
   BOTTLE WASTAGE
======================================== */

router.post(
  '/bottles/:id/waste',
  protect,
  wasteBottle
);

/* ========================================
   BULK / IMPORT
======================================== */

router.post(
  '/materials/bulk',
  protect,
  bulkCreateMaterials
);

router.post(
  '/bottles/bulk',
  protect,
  bulkCreateBottles
);

router.post(
  '/materials/import',
  protect,
  importMaterialsWithPurchases
);

router.post(
  '/bottles/bulk-add-stock',
  protect,
  bulkAddStockToBottles
);

/* ========================================
   LOGS
======================================== */

router.get(
  '/logs',
  protect,
  getLogs
);

module.exports =
  router;