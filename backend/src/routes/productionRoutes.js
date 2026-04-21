const express = require('express');
const router = express.Router();
const {
  createProduction,
  getProductions,
  getProductionById,
} = require('../controllers/productionController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getProductions)
  .post(protect, createProduction);

router.get('/:id', protect, getProductionById);

module.exports = router;