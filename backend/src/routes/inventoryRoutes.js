const express = require('express');
const router = express.Router();
const {
  getMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  getBottles,
  createBottle,
  getLogs,
} = require('../controllers/inventoryController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/materials')
  .get(protect, getMaterials)
  .post(protect, createMaterial);

router.route('/materials/:id')
  .get(protect, getMaterialById)
  .put(protect, updateMaterial);

router.route('/bottles')
  .get(protect, getBottles)
  .post(protect, createBottle);

router.get('/logs', protect, getLogs);

module.exports = router;