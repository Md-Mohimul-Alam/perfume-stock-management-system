const express = require('express');
const router = express.Router();
const {
  getInvestors,
  createInvestor,
  addContribution,
  getShares,
} = require('../controllers/investorController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getInvestors)
  .post(protect, createInvestor);

router.post('/:id/contribute', protect, addContribution);
router.get('/shares', protect, getShares);

module.exports = router;