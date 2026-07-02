// sku.js – supports .csv and .xlsx files

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
require('dotenv').config();

const Product = require('./src/models/Product');

const filePath = process.argv[2] || 'products.csv';

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ---------- Parse file (CSV or Excel) ----------
function parseFile(filePath) {
  let rows = [];
  
  // Check extension
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.xlsx' || ext === '.xls') {
    // Excel file
    console.log('📖 Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    console.log('✅ Excel parsed successfully');
  } else {
    // CSV file
    console.log('📖 Reading CSV file...');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Remove BOM
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.substring(1);
    }
    // Parse CSV
    const lines = content.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
      console.error('❌ File is empty');
      process.exit(1);
    }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    console.log('📋 Headers:', headers);
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
      rows.push(row);
    }
  }
  return rows;
}

async function updateProducts() {
  try {
    console.log(`📄 Reading file: ${filePath}`);
    const rows = parseFile(filePath);
    console.log(`📊 Found ${rows.length} rows.`);

    if (rows.length === 0) {
      console.warn('⚠️ No data found in file.');
      process.exit(0);
    }

    // Log first row to see columns
    console.log('📋 First row sample:', Object.keys(rows[0]));

    // Find SKU column (case-insensitive)
    const allKeys = Object.keys(rows[0]);
    const skuKey = allKeys.find(k => /^sku$|^product sku$|^sku code$/i.test(k.trim()));
    if (!skuKey) {
      console.error('❌ Could not find a SKU column. Available columns:', allKeys);
      process.exit(1);
    }
    console.log(`🔍 Using SKU column: "${skuKey}"`);

    // Find other columns
    const descKey = allKeys.find(k => /description|desc/i.test(k.trim()));
    const intensityKey = allKeys.find(k => /intensity|strength/i.test(k.trim()));
    const bestForKey = allKeys.find(k => /best for|bestfor|occasion/i.test(k.trim()));
    const notesKey = allKeys.find(k => /notes|scent notes|scentnotes/i.test(k.trim()));
    const bestsellerKey = allKeys.find(k => /bestseller|isbestseller/i.test(k.trim()));

    let updated = 0;
    let notFound = 0;
    let errors = [];

    for (const row of rows) {
      const sku = String(row[skuKey] || '').trim();
      if (!sku) {
        errors.push(`Row: Missing SKU`);
        continue;
      }

      // Prepare update object
      const updateData = {};
      if (descKey && row[descKey]) updateData.description = String(row[descKey]).trim();
      if (intensityKey && row[intensityKey]) {
        const intensity = String(row[intensityKey]).trim().toLowerCase();
        if (['light', 'medium', 'strong', 'fresh'].includes(intensity)) {
          updateData.intensity = intensity;
        } else {
          updateData.intensity = 'medium';
        }
      }
      if (bestForKey && row[bestForKey]) {
        const bestFor = String(row[bestForKey]).split(',').map(s => s.trim()).filter(Boolean);
        if (bestFor.length) updateData.bestFor = bestFor;
      }
      if (notesKey && row[notesKey]) {
        const notes = String(row[notesKey]).split(',').map(s => s.trim()).filter(Boolean);
        if (notes.length) updateData.notes = notes;
      }
      if (bestsellerKey && row[bestsellerKey]) {
        updateData.isBestseller = String(row[bestsellerKey]).toLowerCase().trim() === 'true';
      }

      if (Object.keys(updateData).length === 0) {
        errors.push(`SKU ${sku}: No fields to update`);
        continue;
      }

      // Find product by SKU
      const product = await Product.findOne({ sku: sku });
      if (!product) {
        notFound++;
        console.warn(`⚠️ SKU not found: ${sku}`);
        continue;
      }

      Object.assign(product, updateData);
      await product.save();
      updated++;
      console.log(`✅ Updated SKU: ${sku}`);
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ❌ Not Found: ${notFound}`);
    if (errors.length) {
      console.log(`  ⚠️ Errors: ${errors.length}`);
      errors.slice(0, 10).forEach(e => console.log(`     • ${e}`));
      if (errors.length > 10) console.log(`     ... and ${errors.length - 10} more`);
    }

  } catch (err) {
    console.error('❌ Script error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

updateProducts();