const express = require('express');
const router = express.Router();
const {
  getInvestors,
  createInvestor,
  addContribution,
  getShares,
  deleteInvestor,
  getSettlements,            // 👈 NEW
} = require('../controllers/investorController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getInvestors)
  .post(protect, createInvestor);

router.post('/:id/contribute', protect, addContribution);
router.get('/shares', protect, getShares);
router.delete('/:id', protect, deleteInvestor);

// NEW: Get settlements total
router.get('/settlements', protect, getSettlements);

module.exports = router;