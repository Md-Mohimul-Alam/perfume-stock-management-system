const express = require('express');
const router = express.Router();
const {
  getStockReport,
  getSalesReport,
  getProfitReport,
  getInvestorProfitReport,
  getAvailableCash,          // 👈 import
} = require('../controllers/reportController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/stock', protect, getStockReport);
router.get('/sales', protect, getSalesReport);
router.get('/profit', protect, getProfitReport);
router.get('/investor-profit', protect, getInvestorProfitReport);
router.get('/available-cash', protect, getAvailableCash);   // 👈 new

module.exports = router;