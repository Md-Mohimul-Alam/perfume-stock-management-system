const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./src/models/Product');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

async function remove3mlSizes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all products that have a size of 3ml
    const products = await Product.find({ 'sizes.sizeMl': 3 });

    if (products.length === 0) {
      console.log('✅ No products with 3ml sizes found.');
      await mongoose.disconnect();
      return;
    }

    console.log(`📦 Found ${products.length} products with 3ml sizes.`);

    let updatedCount = 0;

    for (const product of products) {
      // Filter out sizes with sizeMl === 3
      const originalLength = product.sizes.length;
      product.sizes = product.sizes.filter(size => size.sizeMl !== 3);

      if (product.sizes.length < originalLength) {
        await product.save();
        updatedCount++;
        console.log(`✅ Updated ${product.name} (${product.sku}) – removed 3ml size`);
      }
    }

    console.log(`\n📊 Done. Removed 3ml size from ${updatedCount} products.`);
    await mongoose.disconnect();
    console.log('🔌 Disconnected.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

remove3mlSizes();