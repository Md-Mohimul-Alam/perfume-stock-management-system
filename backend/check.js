const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// ----- Helper: load models -----
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

let Sale, Product;
try {
  Sale = loadModel('Sale');
  Product = loadModel('Product');
  console.log('✅ Loaded models');
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
  } catch {
    return uri;
  }
}
console.log(`🔗 Connecting to: ${maskUri(MONGO_URI)}`);

// ----- Only this SKU -----
const TARGET_SKU = 'ParHil';

// ----- Oil content rules (bottle size in ml -> oil %) -----
// OIL ONLY — no spray percentages here.
const OIL_RULES = { 6: 100, 15: 100, 30: 100, 50: 100, 100: 100 };
const OIL_BUCKETS = Object.keys(OIL_RULES)
  .map(Number)
  .sort((a, b) => a - b);

function getOilPercent(maxSizeMl) {
  for (const size of OIL_BUCKETS) {
    if (maxSizeMl <= size) return OIL_RULES[size];
  }
  // Fallback to largest bucket
  return OIL_RULES[OIL_BUCKETS[OIL_BUCKETS.length - 1]];
}

async function checkSales() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // 1. Find the only target product
    const targetProduct = await Product.findOne({ sku: TARGET_SKU });

    console.log('\n📦 Target product:');
    console.log(
      `  ${TARGET_SKU}:`,
      targetProduct ? `${targetProduct.name} (${targetProduct._id})` : '❌ NOT FOUND'
    );

    if (!targetProduct) {
      console.log(`❌ Product with SKU "${TARGET_SKU}" does not exist. Create it first.`);
      process.exit(0);
    }

    // 2. Fetch all sales with product populated
    const sales = await Sale.find().populate('items.product');
    console.log(`\n📋 Total sales found: ${sales.length}`);

    // 3. Accumulate oil usage ONLY for ParHil
    let oilUsedMl = 0;

    for (const sale of sales) {
      if (!sale.items) continue;

      for (const item of sale.items) {
        const product = item.product;
        if (!product) continue;

        // Skip anything that is not the target product
        if (product._id.toString() !== targetProduct._id.toString()) continue;

        const sizeMl = item.sizeMl || 0;
        const qty = item.quantity || 0;

        // Determine oil % from the product's largest bottle size
        const maxSize = product.sizes && product.sizes.length > 0
          ? Math.max(...product.sizes.map(s => s.sizeMl))
          : sizeMl;

        const oilPct = getOilPercent(maxSize);
        const oilMl = sizeMl * (oilPct / 100) * qty;

        oilUsedMl += oilMl;
      }
    }

    // 4. Print results — oil only, ParHil only
    console.log('\n📊 Oil usage for SKU ParHil:');
    console.log('─────────────────────────────');
    console.log(`Oil Used (ml): ${oilUsedMl.toFixed(2)}`);
    console.log('─────────────────────────────');

    if (oilUsedMl === 0) {
      console.log('\n⚠️  No oil usage found for SKU ParHil.');
    } else {
      console.log('\n✅ Oil usage calculated (spray quantities excluded).');
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSales();