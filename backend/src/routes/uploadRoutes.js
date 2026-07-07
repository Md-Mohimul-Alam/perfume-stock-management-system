const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const { uploadImage } = require('../controllers/uploadController');
const { protect } = require('../middlewares/authMiddleware');

// Protect the upload route – only authenticated users can upload
router.post('/', protect, upload.single('image'), uploadImage);

module.exports = router;