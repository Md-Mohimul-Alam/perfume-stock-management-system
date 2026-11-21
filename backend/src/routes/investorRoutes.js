
const express = require('express');

const router = express.Router();

const {
  getInvestors,
  createInvestor,
  addContribution,
  updateContribution,
  deleteContribution,
  getShares,
  deleteInvestor,
  getSettlements,
} = require('../controllers/investorController');

const {
  protect,
  admin,
} = require('../middlewares/authMiddleware');

/* ========================================
   VIEW INVESTORS
======================================== */

router
  .route('/')
  .get(protect, getInvestors)
  .post(protect, admin, createInvestor);

/* ========================================
   STATIC ROUTES
======================================== */

router.get('/shares', protect, getShares);

router.get('/settlements', protect, getSettlements);

/* ========================================
   CONTRIBUTIONS
======================================== */

router.post(
  '/:id/contribute',
  protect,
  admin,
  addContribution
);

router.put(
  '/:id/contributions/:contributionId',
  protect,
  admin,
  updateContribution
);

router.delete(
  '/:id/contributions/:contributionId',
  protect,
  admin,
  deleteContribution
);

/* ========================================
   CLOSE INVESTOR
======================================== */

router.delete(
  '/:id',
  protect,
  admin,
  deleteInvestor
);

module.exports = router;
