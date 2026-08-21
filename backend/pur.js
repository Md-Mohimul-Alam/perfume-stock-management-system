const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Build absolute paths using __dirname
const modelPaths = [
  path.join(__dirname, 'src/models/Purchase'),
  path.join(__dirname, 'models/Purchase'),
  path.join(__dirname, '../src/models/Purchase'),
];

let Purchase, RawMaterial;
let loaded = false;
for (const p of modelPaths) {
  try {
    Purchase = require(p);
    RawMaterial = require(p.replace('Purchase', 'RawMaterial'));
    console.log(`✅ Loaded models from: ${p}`);
    loaded = true;
    break;
  } catch (e) {
    // try next
  }
}

if (!loaded) {
  console.error('❌ Cannot find models. Tried paths:', modelPaths);
  process.exit(1);
}

// Use MONGO_URI from .env
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

// Mask password for logging
function maskUri(uri) {
  try {
    const url = new URL(uri);
    if (url.password) {
      url.password = '****';
    }
    return url.toString();
  } catch {
    return uri;
  }
}
console.log(`🔗 Connecting to: ${maskUri(MONGO_URI)}`);

async function rebuildPurchases() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Fetch all purchases WITHOUT populating (just get raw item IDs)
    const purchases = await Purchase.find().lean();

    console.log(`📦 Found ${purchases.length} purchase records`);

    // 2. Group purchase items by RawMaterial ID
    const materialPurchaseMap = {};

    for (const purchase of purchases) {
      const invoiceNo = purchase.invoiceNo;
      const supplier = purchase.supplier || '';
      const purchaseDate = purchase.purchaseDate || new Date();

      for (const item of purchase.items) {
        if (item.itemType !== 'RawMaterial') continue;

        const materialId = item.item.toString();
        if (!materialPurchaseMap[materialId]) {
          materialPurchaseMap[materialId] = [];
        }

        materialPurchaseMap[materialId].push({
          quantityMl: item.quantity,
          costPerMl: item.costPerUnit,
          totalCost: item.totalCost,
          purchaseDate: purchaseDate,
          supplier: supplier,
          invoiceNo: invoiceNo,
        });
      }
    }

    const materialIds = Object.keys(materialPurchaseMap);
    console.log(`🔄 Found ${materialIds.length} raw materials with purchase history`);

    // 3. Process each material
    let updatedCount = 0;
    let totalEntries = 0;

    for (const materialId of materialIds) {
      const entries = materialPurchaseMap[materialId];

      const material = await RawMaterial.findById(materialId);
      if (!material) {
        console.warn(`⚠️ Material ${materialId} not found – skipping`);
        continue;
      }

      // Clear all existing purchases
      material.purchases = [];

      // Add all new entries
      for (const entry of entries) {
        material.purchases.push({
          quantityMl: entry.quantityMl,
          costPerMl: entry.costPerMl,
          totalCost: entry.totalCost,
          purchaseDate: entry.purchaseDate,
          supplier: entry.supplier,
          invoiceNo: entry.invoiceNo,
        });
      }

      // Recalculate stock and avg cost
      let totalQty = 0;
      let totalCostSum = 0;
      for (const p of material.purchases) {
        totalQty += p.quantityMl;
        totalCostSum += p.totalCost;
      }
      material.currentStockMl = totalQty;
      material.avgCostPerMl = totalQty > 0 ? totalCostSum / totalQty : 0;

      await material.save();
      updatedCount++;
      totalEntries += material.purchases.length;
      console.log(`✅ ${material.name} (${material.sku}) – ${material.purchases.length} entries, stock: ${material.currentStockMl}ml, avg cost: ${material.avgCostPerMl.toFixed(2)}`);
    }

    console.log(`\n🎉 Rebuild complete!`);
    console.log(`   ✅ Updated ${updatedCount} materials`);
    console.log(`   📝 Total purchase entries added: ${totalEntries}`);

    // 4. Reset materials with no purchases
    const allMaterials = await RawMaterial.find({});
    let noPurchaseCount = 0;
    for (const m of allMaterials) {
      if (m.purchases.length === 0 && m.currentStockMl > 0) {
        console.warn(`⚠️ ${m.name} has stock ${m.currentStockMl}ml but no purchase history – setting stock to 0.`);
        m.currentStockMl = 0;
        m.avgCostPerMl = 0;
        await m.save();
        noPurchaseCount++;
      }
    }
    if (noPurchaseCount > 0) {
      console.log(`📌 Reset stock to 0 for ${noPurchaseCount} materials with no purchase history.`);
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('authentication')) {
      console.error('🔑 Authentication failed. Please check your MONGO_URI in .env');
      console.error('   Ensure the username, password, and database name are correct.');
    }
    process.exit(1);
  }
}

rebuildPurchases();