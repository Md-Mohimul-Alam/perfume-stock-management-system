const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ----- Helper: load model -----
function loadModel(name) {
  const paths = [
    path.join(__dirname, 'src/models', name),
    path.join(__dirname, 'models', name),
    path.join(__dirname, '../src/models', name),
  ];
  for (const p of paths) {
    try { return require(p); } catch {}
  }
  throw new Error(`Model ${name} not found`);
}

// ----- Load models -----
const Product = loadModel('Product');
const RawMaterial = loadModel('RawMaterial');
const Bottle = loadModel('Bottle');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

// ----- Parse command line arguments -----
const args = process.argv.slice(2);
const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || null;
const format = args.includes('--json') ? 'json' : 'table';

// ----- Main -----
async function fetchProducts() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Fetch all products with full population
    const products = await Product.find()
      .populate('baseOil', 'name sku type')
      .populate('blendComponents.material', 'name sku type')
      .populate('sizes.bottle', 'sizeMl type')
      .sort({ name: 1 });

    console.log(`📦 Found ${products.length} products.`);

    if (products.length === 0) {
      console.log('No products found.');
      await mongoose.disconnect();
      return;
    }

    // ----- Prepare data for output -----
    const data = products.map(p => {
      const baseOil = p.baseOil ? `${p.baseOil.name} (${p.baseOil.sku})` : 'None';
      const blend = p.blendComponents.map(c => {
        const mat = c.material;
        return mat ? `${mat.name} (${mat.sku}) ${c.percentage}%` : `Unknown ${c.percentage}%`;
      }).join('; ');
      const sizes = p.sizes.map(s => {
        const bottle = s.bottle;
        const bottleLabel = bottle ? `${bottle.sizeMl}ml (${bottle.type})` : 'No bottle';
        return `${s.sizeMl}ml @ ৳${s.sellingPrice} (bottle: ${bottleLabel})`;
      }).join(' | ');

      return {
        id: p._id.toString(),
        name: p.name,
        sku: p.sku,
        type: p.type,
        isActive: p.isActive,
        isBestseller: p.isBestseller,
        description: p.description || '',
        intensity: p.intensity || '',
        bestFor: p.bestFor.join(', '),
        notes: p.notes.join(', '),
        baseOil: baseOil,
        blendComponents: blend,
        sizes: sizes,
        images: p.images.join(', '),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    // ----- Output -----
    if (outputFile) {
      if (format === 'json') {
        fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
        console.log(`✅ Data written to ${outputFile} (JSON)`);
      } else {
        // CSV
        const headers = [
          'id', 'name', 'sku', 'type', 'isActive', 'isBestseller',
          'description', 'intensity', 'bestFor', 'notes',
          'baseOil', 'blendComponents', 'sizes', 'images',
          'createdAt', 'updatedAt'
        ];
        const rows = [headers.join(',')];
        for (const row of data) {
          const line = headers.map(h => {
            let val = row[h] || '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
              val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(',');
          rows.push(line);
        }
        fs.writeFileSync(outputFile, rows.join('\n'));
        console.log(`✅ Data written to ${outputFile} (CSV)`);
      }
    } else {
      // Console table
      console.table(data.map(p => ({
        Name: p.name,
        SKU: p.sku,
        Type: p.type,
        Active: p.isActive ? '✅' : '❌',
        Bestseller: p.isBestseller ? '⭐' : '',
        BaseOil: p.baseOil,
        'Blend Components': p.blendComponents.slice(0, 40) + (p.blendComponents.length > 40 ? '…' : ''),
        'Sizes (ml)': p.sizes,
      })));

      // Summary
      console.log(`\n📊 Summary:`);
      console.log(`  Total products: ${products.length}`);
      console.log(`  Active: ${products.filter(p => p.isActive).length}`);
      console.log(`  Spray: ${products.filter(p => p.type === 'spray').length}`);
      console.log(`  Roll-on: ${products.filter(p => p.type === 'roll-on').length}`);
      console.log(`  Bestsellers: ${products.filter(p => p.isBestseller).length}`);
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchProducts();