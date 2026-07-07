// sku.js – supports .csv and .xlsx files, updates product sizes and meta fields

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
require('dotenv').config();

const Product = require('../src/models/Product');
// If you have a Bottle model, you can import it to map bottleType to ObjectId
// const Bottle = require('./src/models/Bottle');

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

// ---------- Helper: parse size string (e.g., "3.5ml Roll-on") ----------
function parseSize(sizeStr) {
  if (!sizeStr) return null;
  const trimmed = String(sizeStr).trim();
  // Try "3.5ml Roll-on" or "3ml Spray"
  const match = trimmed.match(/^([\d.]+)\s*ml\s*(.+)$/i);
  if (match) {
    const sizeMl = parseFloat(match[1]);
    let type = match[2].toLowerCase().trim();
    if (type.includes('role') || type.includes('roll')) type = 'roll-on';
    else if (type.includes('spray')) type = 'spray';
    else type = 'spray'; // fallback
    return { sizeMl, type };
  }
  // Alternate format: "3ml Role"
  const altMatch = trimmed.match(/^([\d.]+)\s*ml\s*(.+)$/i);
  if (altMatch) {
    const sizeMl = parseFloat(altMatch[1]);
    let type = altMatch[2].toLowerCase().trim();
    if (type.includes('role') || type.includes('roll')) type = 'roll-on';
    else if (type.includes('spray')) type = 'spray';
    else type = 'spray';
    return { sizeMl, type };
  }
  console.warn(`⚠️ Could not parse size: "${sizeStr}"`);
  return null;
}

// ---------- Parse file (CSV or Excel) ----------
function parseFile(filePath) {
  let rows = [];
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.xlsx' || ext === '.xls') {
    console.log('📖 Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    console.log('✅ Excel parsed successfully');
  } else {
    console.log('📖 Reading CSV file...');
    let content = fs.readFileSync(filePath, 'utf-8');
    // Remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) content = content.substring(1);
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

    const allKeys = Object.keys(rows[0]);
    console.log('📋 Available columns:', allKeys);

    // ----- Detect columns (case-insensitive) -----
    const skuKey = allKeys.find(k => /^sku$|^product sku$|^sku code$/i.test(k.trim()));
    const nameKey = allKeys.find(k => /^product name$|^name$/i.test(k.trim()));
    const sizeKey = allKeys.find(k => /^size$/i.test(k.trim()));
    const priceKey = allKeys.find(k => /^sellingprice$|^price$|^selling price$/i.test(k.trim()));
    const descKey = allKeys.find(k => /description|desc/i.test(k.trim()));
    const intensityKey = allKeys.find(k => /intensity|strength/i.test(k.trim()));
    const bestForKey = allKeys.find(k => /best for|bestfor|occasion/i.test(k.trim()));
    const notesKey = allKeys.find(k => /notes|scent notes|scentnotes/i.test(k.trim()));
    const bestsellerKey = allKeys.find(k => /bestseller|isbestseller/i.test(k.trim()));

    if (!skuKey) {
      console.error('❌ Could not find a SKU column. Available columns:', allKeys);
      process.exit(1);
    }
    if (!sizeKey || !priceKey) {
      console.error('❌ Missing "Size" or "Price" column. Found:', allKeys);
      process.exit(1);
    }

    console.log(`🔍 Using columns: SKU="${skuKey}", Size="${sizeKey}", Price="${priceKey}"`);

    // ----- Group rows by SKU -----
    const groups = {};
    for (const row of rows) {
      const sku = String(row[skuKey] || '').trim();
      if (!sku) continue;
      if (!groups[sku]) groups[sku] = [];
      groups[sku].push(row);
    }

    console.log(`📦 Grouped into ${Object.keys(groups).length} unique SKUs.`);

    let updated = 0;
    let notFound = 0;
    let skipped = 0;
    let errors = [];

    // ----- Process each SKU group -----
    for (const [sku, groupRows] of Object.entries(groups)) {
      // Find product in DB
      const product = await Product.findOne({ sku });
      if (!product) {
        notFound++;
        console.warn(`⚠️ SKU not found: ${sku}`);
        continue;
      }

      // Prepare top-level updates (from first row of the group)
      const firstRow = groupRows[0];
      const updateData = {};

      if (descKey && firstRow[descKey]) updateData.description = String(firstRow[descKey]).trim();
      if (intensityKey && firstRow[intensityKey]) {
        const intensity = String(firstRow[intensityKey]).trim().toLowerCase();
        if (['light', 'medium', 'strong'].includes(intensity)) {
          updateData.intensity = intensity;
        } else {
          updateData.intensity = 'medium';
        }
      }
      if (bestForKey && firstRow[bestForKey]) {
        const bestFor = String(firstRow[bestForKey]).split(',').map(s => s.trim()).filter(Boolean);
        if (bestFor.length) updateData.bestFor = bestFor;
      }
      if (notesKey && firstRow[notesKey]) {
        const notes = String(firstRow[notesKey]).split(',').map(s => s.trim()).filter(Boolean);
        if (notes.length) updateData.notes = notes;
      }
      if (bestsellerKey && firstRow[bestsellerKey]) {
        updateData.isBestseller = String(firstRow[bestsellerKey]).toLowerCase().trim() === 'true';
      }
      // Optionally update product type (infer from size)
      // We'll set type based on first size parsed
      const firstSizeParsed = parseSize(String(firstRow[sizeKey] || '').trim());
      if (firstSizeParsed && firstSizeParsed.type) {
        // Only set if product.type is not already set or if you want to override
        if (!product.type || product.type !== firstSizeParsed.type) {
          updateData.type = firstSizeParsed.type;
        }
      }

      // Apply top-level updates
      if (Object.keys(updateData).length > 0) {
        Object.assign(product, updateData);
      }

      // ----- Update sizes (sellingPrice) -----
      let sizeUpdated = 0;
      for (const row of groupRows) {
        const sizeStr = String(row[sizeKey] || '').trim();
        const priceStr = String(row[priceKey] || '').trim();
        if (!sizeStr || !priceStr) {
          errors.push(`SKU ${sku}: missing size or price in row`);
          continue;
        }

        const sizeInfo = parseSize(sizeStr);
        if (!sizeInfo) {
          errors.push(`SKU ${sku}: cannot parse size "${sizeStr}"`);
          continue;
        }

        const price = parseFloat(priceStr);
        if (isNaN(price) || price < 0) {
          errors.push(`SKU ${sku}: invalid price "${priceStr}"`);
          continue;
        }

        // Find the size variant with matching sizeMl (and optionally bottleType)
        // Since we don't have bottle IDs here, we match by sizeMl only.
        // If there are multiple variants with same sizeMl but different bottle (rare), we might need to match by bottleType as well.
        // We can enhance by finding a bottle by type and matching ObjectId, but that requires Bottle model.
        // For simplicity, we match by sizeMl.
        const sizeVariant = product.sizes.find(s => s.sizeMl === sizeInfo.sizeMl);
        if (!sizeVariant) {
          errors.push(`SKU ${sku}: size ${sizeInfo.sizeMl}ml not found in product sizes`);
          continue;
        }

        // Update sellingPrice
        sizeVariant.sellingPrice = price;
        sizeUpdated++;
      }

      if (sizeUpdated > 0) {
        await product.save();
        updated++;
        console.log(`✅ Updated SKU: ${sku} (${sizeUpdated} size(s) price updated)`);
      } else {
        skipped++;
        console.log(`⏭️ SKU ${sku}: no sizes updated (maybe missing matching size)`);
      }
    }

    // ----- Summary -----
    console.log('\n📊 Summary:');
    console.log(`  ✅ Updated SKUs: ${updated}`);
    console.log(`  ❌ Not Found: ${notFound}`);
    console.log(`  ⏭️ Skipped (no size matched): ${skipped}`);
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