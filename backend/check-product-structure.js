const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./src/models/Product');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

async function inspectProducts() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Fetch a few products (limit 5) to examine structure
  const products = await Product.find({}).limit(5).lean(); // lean() returns plain JS objects

  if (products.length === 0) {
    console.log('⚠️ No products found.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\n📦 Found ${products.length} sample products:\n`);

  products.forEach((p, idx) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📌 Product #${idx + 1}: ${p.name} (SKU: ${p.sku})`);
    console.log(`   Type: ${p.type}`);
    console.log(`   Active: ${p.isActive}`);

    // Check top-level images field
    const hasTopImages = p.images && Array.isArray(p.images) && p.images.length > 0;
    console.log(`   Top-level images: ${hasTopImages ? p.images.join(', ') : '❌ none'}`);

    // Inspect sizes
    const sizes = p.sizes || [];
    console.log(`   Sizes: ${sizes.length} variants`);

    sizes.forEach((s, i) => {
      const sizeInfo = [
        `sizeMl: ${s.sizeMl}`,
        `sellingPrice: ${s.sellingPrice}`,
      ];
      // Check if image field exists on this size
      const hasSizeImage = s.image !== undefined && s.image !== null && s.image !== '';
      if (hasSizeImage) {
        sizeInfo.push(`image: ${s.image}`);
      } else {
        sizeInfo.push('image: ❌ missing or empty');
      }
      // Also show any other custom fields you might have
      if (s.bottleType) sizeInfo.push(`bottleType: ${s.bottleType}`);
      if (s.oilMlUsed !== undefined) sizeInfo.push(`oilMlUsed: ${s.oilMlUsed}`);
      console.log(`      ${i + 1}. ${sizeInfo.join(', ')}`);
    });

    // If no sizes, mention it
    if (sizes.length === 0) {
      console.log('      (no size variants)');
    }

    console.log('');
  });

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

inspectProducts().catch(console.error);