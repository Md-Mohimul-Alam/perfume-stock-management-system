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
   PUBLIC BOTTLES

   Must stay BEFORE /bottles/:id.
======================================== */

router.get(
  '/bottles/public',
  getPublicBottles
);

/* ========================================
   RAW MATERIALS
======================================== */

router
  .route(
    '/materials'
  )
  .get(
    protect,
    getMaterials
  )
  .post(
    protect,
    createMaterial
  );

router
  .route(
    '/materials/:id'
  )
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

router.post(
  '/materials/:id/stock-out',
  protect,
  stockOutMaterial
);

router.post(
  '/materials/:id/adjust',
  protect,
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

router
  .route(
    '/bottles'
  )
  .get(
    protect,
    getBottles
  )
  .post(
    protect,
    createBottle
  );

router
  .route(
    '/bottles/:id'
  )
  .put(
    protect,
    updateBottle
  )
  .delete(
    protect,
    deleteBottle
  );

router.post(
  '/bottles/:id/purchase',
  protect,
  addBottlePurchase
);

router.post(
  '/bottles/:id/stock-out',
  protect,
  stockOutBottle
);

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