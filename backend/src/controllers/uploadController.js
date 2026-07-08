const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists (still needed for multer)
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Build form data for imgBB
    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path));
    formData.append('key', process.env.IMGBB_API_KEY);

    // Upload to imgBB
    const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
      headers: formData.getHeaders(),
    });

    // Delete local file after successful upload
    fs.unlinkSync(req.file.path);

    // Return the permanent URL from imgBB
    res.json({ url: response.data.data.url });
  } catch (error) {
    // Clean up local file if upload fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Upload error:', error.message);
    res.status(500).json({ message: error.response?.data?.error?.message || error.message });
  }
};