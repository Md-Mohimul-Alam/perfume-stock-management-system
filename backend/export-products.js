// export-products.js
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ----- Try to locate Product model -----
let Product;
const possiblePaths = [
  './models/Product',
  './src/models/Product',
  '../models/Product',
  '../src/models/Product',
];
for (const p of possiblePaths) {
  try {
    Product = require(p);
    console.log(`✅ Loaded Product from ${p}`);
    break;
  } catch (e) { /* ignore */ }
}
if (!Product) {
  console.error('❌ Could not find Product model. Please adjust the require path manually.');
  process.exit(1);
}

// ----- Connect & export -----
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const format = args[0] || 'csv';           // 'csv' or 'json'
const outputDir = args[1] || './exports';
const onlyActive = args.includes('--active');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const baseFileName = `products_${timestamp}`;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    const filter = onlyActive ? { isActive: true } : {};
    const products = await Product.find(filter).sort({ name: 1 });
    console.log(`📦 Found ${products.length} products.`);

    if (products.length === 0) {
      console.log('⚠️ No products found. Export cancelled.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // ----- Flat export (one row per size) -----
    const flatRows = [];
    products.forEach(p => {
      (p.sizes || []).forEach(size => {
        flatRows.push({
          name: p.name,
          sku: p.sku,
          type: p.type,
          sizeMl: size.sizeMl,
          sellingPrice: size.sellingPrice,
          oilMlUsed: size.oilMlUsed,
          ethanolMlUsed: size.ethanolMlUsed || 0,
          fixativeMlUsed: size.fixativeMlUsed || 0,
          makingCost: size.makingCost || 0,
          isActive: p.isActive,
          description: p.description || '',
          intensity: p.intensity || '',
          bestFor: p.bestFor || '',
          notes: p.notes || '',
          baseOil: p.baseOil || '',
          blendComponents: p.blendComponents || '',
        });
      });
    });

    // ----- Wide format (one row per product, columns = sizes) -----
    const allSizeMls = new Set();
    products.forEach(p => (p.sizes || []).forEach(s => allSizeMls.add(s.sizeMl)));
    const sortedSizeMls = Array.from(allSizeMls).sort((a, b) => a - b);

    const wideRows = products.map(p => {
      const sizeMap = {};
      (p.sizes || []).forEach(s => { sizeMap[s.sizeMl] = s.sellingPrice; });
      const row = { name: p.name, sku: p.sku, type: p.type, isActive: p.isActive };
      sortedSizeMls.forEach(ml => {
        row[`${ml}ml_price`] = sizeMap[ml] !== undefined ? sizeMap[ml] : null;
      });
      return row;
    });

    // ----- Save JSON (always) -----
    const jsonFile = path.join(outputDir, `${baseFileName}_flat.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(flatRows, null, 2));
    console.log(`✅ JSON (flat) exported: ${jsonFile}`);

    // ----- CSV if requested -----
    if (format === 'csv' || format === 'both') {
      // Flat CSV
      if (flatRows.length) {
        const headers = Object.keys(flatRows[0]);
        const csvRows = [headers.join(',')];
        for (const row of flatRows) {
          const vals = headers.map(h => {
            let v = row[h] ?? '';
            if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
              v = `"${v.replace(/"/g, '""')}"`;
            }
            return v;
          });
          csvRows.push(vals.join(','));
        }
        const csvFile = path.join(outputDir, `${baseFileName}_flat.csv`);
        fs.writeFileSync(csvFile, csvRows.join('\n'));
        console.log(`✅ CSV (flat) exported: ${csvFile}`);
      }

      // Wide CSV
      if (wideRows.length) {
        const headers = Object.keys(wideRows[0]);
        const csvRows = [headers.join(',')];
        for (const row of wideRows) {
          const vals = headers.map(h => {
            let v = row[h] ?? '';
            if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
              v = `"${v.replace(/"/g, '""')}"`;
            }
            return v;
          });
          csvRows.push(vals.join(','));
        }
        const wideCsvFile = path.join(outputDir, `${baseFileName}_wide.csv`);
        fs.writeFileSync(wideCsvFile, csvRows.join('\n'));
        console.log(`✅ CSV (wide) exported: ${wideCsvFile}`);
      }
    }

    // ----- Summary -----
    const summary = {
      totalProducts: products.length,
      activeProducts: products.filter(p => p.isActive).length,
      totalSizeVariants: flatRows.length,
      distinctSizeMl: sortedSizeMls,
      types: {},
    };
    products.forEach(p => {
      const t = p.type || 'unknown';
      summary.types[t] = (summary.types[t] || 0) + 1;
    });
    const summaryFile = path.join(outputDir, `${baseFileName}_summary.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`✅ Summary exported: ${summaryFile}`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    console.log(`\n📁 All files saved in: ${outputDir}/`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });