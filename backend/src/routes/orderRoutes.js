const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  convertOrderToSale,
  deleteOrder,
} = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');

// Public — client site posts orders here (no auth)
router.post('/', createOrder);

// Admin — everything else needs auth
router.get('/', protect, getOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/status', protect, updateOrderStatus);
router.post('/:id/place', protect, convertOrderToSale);
router.delete('/:id', protect, deleteOrder);

module.exports = router;