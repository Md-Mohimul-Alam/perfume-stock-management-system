// update-bestsellers-direct.js
// Runs the bestseller update using the service function – no API call, no auth.

const mongoose = require('mongoose');
require('dotenv').config();
const { updateBestsellers } = require('./src/services/productService');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    // Parameters: topN (default 5), timeRange ('all', 'month', 'week')
    const updated = await updateBestsellers(5, 'all');
    console.log(`✅ Bestsellers updated – ${updated.length} products marked as bestsellers`);
    console.log('📋 Product IDs:', updated);
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });