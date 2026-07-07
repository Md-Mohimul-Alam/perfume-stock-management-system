const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // or use crypto.randomUUID()

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Generate public URL – adjust based on your hosting
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const url = `${baseUrl}/uploads/${req.file.filename}`;

    res.json({ url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};