const express =
  require('express');

const router =
  express.Router();

const {
  getInvestors,
  createInvestor,
  addContribution,
  updateContribution,
  deleteContribution,
  getShares,
  deleteInvestor,
  getSettlements,
} =
  require('../controllers/investorController');

const {
  protect,
} =
  require('../middlewares/authMiddleware');

/* ========================================
   BASE
======================================== */

router
  .route('/')
  .get(
    protect,
    getInvestors
  )
  .post(
    protect,
    createInvestor
  );

/* ========================================
   STATIC ROUTES
   Keep these before /:id
======================================== */

router.get(
  '/shares',
  protect,
  getShares
);

router.get(
  '/settlements',
  protect,
  getSettlements
);

/* ========================================
   CONTRIBUTIONS
======================================== */

router.post(
  '/:id/contribute',
  protect,
  addContribution
);

router.put(
  '/:id/contributions/:contributionId',
  protect,
  updateContribution
);

router.delete(
  '/:id/contributions/:contributionId',
  protect,
  deleteContribution
);

/* ========================================
   INVESTOR
======================================== */

router.delete(
  '/:id',
  protect,
  deleteInvestor
);

module.exports =
  router;