// list-skus.js
const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../src/models/Product'); // adjust path if needed

async function listSkus() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const products = await Product.find({}, 'sku name type sizes').lean();
  console.log(`📦 Total products: ${products.length}\n`);

  products.forEach(p => {
    const sizeCount = p.sizes?.length || 0;
    console.log(`SKU: ${p.sku} | Name: ${p.name} | Type: ${p.type} | Sizes: ${sizeCount}`);
    if (p.sizes?.length) {
      p.sizes.forEach(s => console.log(`  - ${s.sizeMl}ml @ ৳${s.sellingPrice}`));
    }
    console.log('');
  });

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

listSkus().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});