const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();
const Product = require('./src/models/Product');

// ========== CONFIGURATION ==========
const MONGO_URI = process.env.MONGO_URI;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const EXCEL_PATH = path.join(__dirname, 'image-mapping.xlsx');
const IMAGE_FOLDER = path.join(__dirname, 'images-to-upload');

// ========== VALIDATE ENV ==========
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

// ========== STEP 1: GENERATE EXCEL ==========
async function generateExcel() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const products = await Product.find({ isActive: true }).select('name sku sizes');
  const rows = [];

  products.forEach(p => {
    (p.sizes || []).forEach(size => {
      rows.push({
        sku: p.sku,
        sizeMl: size.sizeMl,
        productName: p.name,
        imageFile: '', // ← user fills this
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'image-mapping');
  XLSX.writeFile(wb, EXCEL_PATH);

  console.log(`✅ Created ${EXCEL_PATH} with ${rows.length} rows.`);
  console.log(`📝 Open it, fill the 'imageFile' column with filenames, then re-run this script.`);
  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

// ========== STEP 2: UPLOAD AND UPDATE ==========
async function uploadToImgBB(filePath) {
  const formData = new FormData();
  formData.append('image', fs.createReadStream(filePath));
  formData.append('key', IMGBB_API_KEY);

  try {
    const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
      headers: formData.getHeaders(),
    });
    return response.data.data.url;
  } catch (err) {
    throw new Error(err.response?.data?.error?.message || err.message);
  }
}

async function uploadAndUpdate() {
  if (!IMGBB_API_KEY) {
    console.error('❌ IMGBB_API_KEY not set in .env');
    process.exit(1);
  }
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ Excel file not found: ${EXCEL_PATH}. Run script again after filling it.`);
    process.exit(1);
  }
  if (!fs.existsSync(IMAGE_FOLDER)) {
    console.error(`❌ Image folder not found: ${IMAGE_FOLDER}. Create it and place your images.`);
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`📄 Found ${rows.length} rows in Excel.`);

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sku = row.sku?.trim();
    const sizeMl = parseFloat(row.sizeMl);
    const imageFile = row.imageFile?.trim();

    if (!sku || isNaN(sizeMl) || !imageFile) {
      console.warn(`⚠️ Row ${i+1}: Skipping (missing sku/size/imageFile)`);
      skipped++;
      continue;
    }

    const localPath = path.join(IMAGE_FOLDER, imageFile);
    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️ Row ${i+1}: Image file not found: ${imageFile}`);
      skipped++;
      continue;
    }

    console.log(`📤 Uploading ${imageFile} ...`);
    let imageUrl;
    try {
      imageUrl = await uploadToImgBB(localPath);
    } catch (err) {
      console.error(`❌ Upload failed for ${imageFile}:`, err.message);
      skipped++;
      continue;
    }

    const product = await Product.findOne({ sku });
    if (!product) {
      console.warn(`⚠️ Row ${i+1}: Product SKU "${sku}" not found`);
      skipped++;
      continue;
    }

    const sizeObj = product.sizes.find(s => s.sizeMl === sizeMl);
    if (!sizeObj) {
      console.warn(`⚠️ Row ${i+1}: Size ${sizeMl}ml not found for SKU "${sku}"`);
      skipped++;
      continue;
    }

    sizeObj.image = imageUrl;
    await product.save();
    updated++;
    console.log(`✅ Row ${i+1}: ${sku} (${sizeMl}ml) → ${imageUrl}`);
  }

  console.log(`\n📊 Summary: Updated ${updated}, Skipped ${skipped}`);
  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

// ========== MAIN ==========
async function main() {
  // If Excel doesn't exist, generate it and exit.
  if (!fs.existsSync(EXCEL_PATH)) {
    console.log('📄 image-mapping.xlsx not found. Generating...');
    await generateExcel();
    console.log('📌 Please fill the imageFile column and run the script again.');
    process.exit(0);
  }

  // Otherwise, run the upload/update step.
  await uploadAndUpdate();
}

main().catch(err => {
  console.error('❌ Script error:', err);
  process.exit(1);
});