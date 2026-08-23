const express = require('express');
const router = express.Router();
const { rebuildStock } = require('../controllers/rebuildController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.post('/rebuild-stock', protect, admin, rebuildStock);

module.exports = router;