const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const Product = require('../src/models/Product');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

async function generateMapping() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  const products = await Product.find({ isActive: true }).select('name sku sizes');
  const rows = [];

  products.forEach(p => {
    (p.sizes || []).forEach(size => {
      rows.push({
        sku: p.sku,
        sizeMl: size.sizeMl,
        productName: p.name,
        imageFile: '', // <-- you fill this column
      });
    });
  });

  // Write CSV
  const csv = ['sku,sizeMl,productName,imageFile'];
  rows.forEach(r => {
    // Escape commas in product name
    const safeName = r.productName.includes(',') ? `"${r.productName}"` : r.productName;
    csv.push(`${r.sku},${r.sizeMl},${safeName},${r.imageFile}`);
  });
  const filePath = path.join(__dirname, 'image-mapping.csv');
  fs.writeFileSync(filePath, csv.join('\n'));
  console.log(`✅ Mapping CSV created: ${filePath} (${rows.length} rows)`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

generateMapping().catch(console.error);