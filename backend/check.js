const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// ----- Helper: load models (same as your push_sell_data.js) -----
function loadModel(modelName) {
  const paths = [
    path.join(__dirname, 'src/models', modelName),
    path.join(__dirname, 'models', modelName),
    path.join(__dirname, '../src/models', modelName),
  ];
  for (const p of paths) {
    try {
      return require(p);
    } catch (e) {}
  }
  throw new Error(`Cannot find model "${modelName}"`);
}

let Sale, Product, RawMaterial, Bottle, Transaction, InventoryLog;
try {
  Sale = loadModel('Sale');
  Product = loadModel('Product');
  RawMaterial = loadModel('RawMaterial');
  Bottle = loadModel('Bottle');
  Transaction = loadModel('Transaction');
  InventoryLog = loadModel('InventoryLog');
  console.log('✅ Loaded all models');
} catch (err) {
  console.error('❌ Failed to load models:', err.message);
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

function maskUri(uri) {
  try {
    const url = new URL(uri);
    if (url.password) url.password = '****';
    return url.toString();
  } catch { return uri; }
}
console.log(`🔗 Connecting to: ${maskUri(MONGO_URI)}`);

async function checkSales() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // 1. Find target products
    const srProduct = await Product.findOne({ sku: 'SR_SP' });
    const luxeProduct = await Product.findOne({ sku: 'LUXE1_SP' });

    console.log('\n📦 Target products:');
    console.log('  SR_SP:', srProduct ? `${srProduct.name} (${srProduct._id})` : '❌ NOT FOUND');
    console.log('  LUXE1_SP:', luxeProduct ? `${luxeProduct.name} (${luxeProduct._id})` : '❌ NOT FOUND');

    if (!srProduct && !luxeProduct) {
      console.log('❌ Neither product exists. Create them first.');
      process.exit(0);
    }

    // 2. Fetch all sales with product population
    const sales = await Sale.find().populate('items.product');
    console.log(`\n📋 Total sales found: ${sales.length}`);

    // 3. Count usage
    const usage = { SR_SP: 0, LUXE1_SP: 0 };
    const unitCount = { SR_SP: 0, LUXE1_SP: 0 };
    const sprayRules = { '6': 45, '15': 45, '30': 45, '50': 50, '100': 55 };

    for (const sale of sales) {
      if (!sale.items) continue;
      for (const item of sale.items) {
        const product = item.product;
        if (!product) continue;

        let targetKey = null;
        if (srProduct && product._id.toString() === srProduct._id.toString()) {
          targetKey = 'SR_SP';
        } else if (luxeProduct && product._id.toString() === luxeProduct._id.toString()) {
          targetKey = 'LUXE1_SP';
        }
        if (!targetKey) continue;

        const sizeMl = item.sizeMl || 0;
        const qty = item.quantity || 0;
        unitCount[targetKey] += qty;

        // Determine oil percentage
        const maxSize = product.sizes.length > 0
          ? Math.max(...product.sizes.map(s => s.sizeMl))
          : sizeMl;
        let oilPct = 45;
        for (const [max, pct] of Object.entries(sprayRules)) {
          if (maxSize <= parseInt(max)) { oilPct = pct; break; }
        }

        const oilMl = (sizeMl * (oilPct / 100)) * qty;
        usage[targetKey] += oilMl;
      }
    }

    // 4. Print results
    console.log('\n📊 Results:');
    console.log('─────────────────────────────');
    console.log('Product       | Units Sold | Oil Used (ml)');
    console.log('──────────────|────────────|──────────────');
    console.log(`SRK Spray     | ${String(unitCount.SR_SP).padStart(10)} | ${usage.SR_SP.toFixed(2)}`);
    console.log(`Luxe Special  | ${String(unitCount.LUXE1_SP).padStart(10)} | ${usage.LUXE1_SP.toFixed(2)}`);
    console.log('─────────────────────────────');

    if (unitCount.SR_SP === 0 && unitCount.LUXE1_SP === 0) {
      console.log('\n⚠️  No sales found for these products – that\'s why usedOil is 0.');
    } else {
      console.log('\n✅ Sales exist – the virtual material usage should now be >0.');
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSales();