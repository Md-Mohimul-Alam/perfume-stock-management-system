const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// ----- Model loader (same as rebuild script) -----
function loadModel(name) {
  const paths = [
    path.join(__dirname, 'src/models', name),
    path.join(__dirname, 'models', name),
    path.join(__dirname, '../src/models', name),
  ];
  for (const p of paths) {
    try { return require(p); } catch {}
  }
  throw new Error(`Cannot find model "${name}"`);
}

let Purchase, RawMaterial;
try {
  Purchase = loadModel('Purchase');
  RawMaterial = loadModel('RawMaterial');
  console.log('✅ Loaded models');
} catch (err) {
  console.error('❌ Failed to load models:', err.message);
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

function maskUri(uri) {
  try {
    const url = new URL(uri);
    if (url.password) url.password = '****';
    return url.toString();
  } catch {
    return uri.replace(/\/\/[^@]+@/, '//****:****@');
  }
}
console.log(`🔗 Connecting to: ${maskUri(MONGO_URI)}`);

async function checkSKUs(skuList) {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB\n');

    // 1. Find materials by SKU
    const materials = await RawMaterial.find({ sku: { $in: skuList } });
    if (materials.length === 0) {
      console.log('❌ No materials found for SKUs:', skuList.join(', '));
      return;
    }

    console.log(`📦 Found ${materials.length} material(s):`);
    for (const mat of materials) {
      console.log(`   - ${mat.name} (${mat.sku}) _id: ${mat._id}`);
    }
    console.log('');

    // 2. For each material, find purchases
    for (const mat of materials) {
      console.log(`\n🔍 Checking purchases for "${mat.name}" (SKU: ${mat.sku})`);
      const purchases = await Purchase.find({
        'items.item': mat._id,
        'items.itemType': 'RawMaterial',
      }).sort('-purchaseDate');

      if (purchases.length === 0) {
        console.log(`   ❌ No purchase records found for ${mat.sku}`);
        continue;
      }

      console.log(`   ✅ Found ${purchases.length} purchase invoice(s):`);
      for (const p of purchases) {
        // Find the specific item in this purchase
        const item = p.items.find(i => i.item.toString() === mat._id.toString());
        if (!item) continue;
        console.log(`      • Invoice: ${p.invoiceNo}`);
        console.log(`        Date: ${new Date(p.purchaseDate).toLocaleDateString()}`);
        console.log(`        Supplier: ${p.supplier || '—'}`);
        console.log(`        Quantity: ${item.quantity} ml`);
        console.log(`        Cost per unit: ৳${item.costPerUnit.toFixed(2)}`);
        console.log(`        Total: ৳${item.totalCost.toFixed(2)}`);
        console.log('');
      }
    }

    // 3. Summary
    console.log('\n📊 Summary:');
    for (const mat of materials) {
      const count = await Purchase.countDocuments({
        'items.item': mat._id,
        'items.itemType': 'RawMaterial',
      });
      console.log(`   ${mat.sku}: ${count} purchase(s)`);
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// ----- Run -----
const skusToCheck = ['TubRos', 'Rose'];  // <-- you can change this list
checkSKUs(skusToCheck);