const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
require('dotenv').config();
const Product = require('../src/models/Product');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

const IMAGE_BASE_URL = 'http://localhost:5000/images/'; // change for production
const EXCEL_PATH = path.join(__dirname, 'image-mapping.xlsx');

async function injectImages() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  if (rows.length === 0) {
    console.log('❌ Excel file is empty.');
    process.exit(1);
  }

  console.log(`📄 Found ${rows.length} rows.`);

  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  console.log('🔍 Detected columns:', keys);

  // Find columns flexibly
  const skuKey = keys.find(k => k.toLowerCase() === 'sku');
  const sizeKey = keys.find(k => k.toLowerCase() === 'sizeml' || k.toLowerCase() === 'sizemi' || k.toLowerCase() === 'size');
  const imageKey = keys.find(k => /image/i.test(k)); // any column with "image" in its name

  if (!skuKey || !sizeKey) {
    console.error('❌ Missing required columns: sku and sizeMl');
    console.log('   Found:', keys);
    process.exit(1);
  }

  if (!imageKey) {
    console.error('❌ No column containing "image" found. Please add a column named "imageFile".');
    console.log('   Found:', keys);
    process.exit(1);
  }

  console.log(`✅ Using columns: sku="${skuKey}", size="${sizeKey}", image="${imageKey}"`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const sku = row[skuKey]?.toString().trim();
    const sizeMl = parseFloat(row[sizeKey]);
    let imageFile = row[imageKey]?.toString().trim();

    if (!sku || isNaN(sizeMl) || !imageFile) {
      skipped++;
      continue;
    }

    const imageUrl = imageFile.startsWith('http') ? imageFile : IMAGE_BASE_URL + imageFile;

    const product = await Product.findOne({ sku });
    if (!product) {
      console.warn(`⚠️ Product not found: ${sku}`);
      skipped++;
      continue;
    }

    const sizeObj = product.sizes.find(s => s.sizeMl === sizeMl);
    if (!sizeObj) {
      console.warn(`⚠️ Size ${sizeMl}ml not found in ${sku}`);
      skipped++;
      continue;
    }

    sizeObj.image = imageUrl;
    await product.save();
    updated++;
    console.log(`✅ ${sku} (${sizeMl}ml) → ${imageUrl}`);
  }

  console.log(`\n📊 Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

injectImages().catch(console.error);