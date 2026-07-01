const express = require('express');
const router = express.Router();
const {
  getInvestors,
  createInvestor,
  addContribution,
  getShares,
  deleteInvestor,
} = require('../controllers/investorController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getInvestors)
  .post(protect, createInvestor);

router.post('/:id/contribute', protect, addContribution);
router.get('/shares', protect, getShares);
router.delete('/:id', protect, deleteInvestor);

module.exports = router;