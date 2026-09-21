const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

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

let Purchase, RawMaterial, Bottle;
try {
  Purchase = loadModel('Purchase');
  RawMaterial = loadModel('RawMaterial');
  Bottle = loadModel('Bottle');
  console.log('✅ Loaded all models');
} catch (err) {
  console.error('❌ Failed to load models:', err.message);
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

function maskUri(uri) { /* ... */ }

console.log(`🔗 Connecting to: ${maskUri(MONGO_URI)}`);

// ----- Rebuild from purchases only -----
async function rebuildEntity(Model, itemType) {
  const entityName = Model.modelName;
  console.log(`\n🔄 Rebuilding ${entityName} from purchases...`);

  const purchases = await Purchase.find().lean();
  console.log(`   📦 Found ${purchases.length} purchase records`);

  // Map: entityId -> array of purchase entries
  const purchaseMap = {};
  for (const purchase of purchases) {
    const invoiceNo = purchase.invoiceNo;
    const supplier = purchase.supplier || '';
    const purchaseDate = purchase.purchaseDate || new Date();
    for (const item of purchase.items) {
      if (item.itemType !== itemType) continue;
      const entityId = item.item.toString();
      if (!purchaseMap[entityId]) purchaseMap[entityId] = [];
      purchaseMap[entityId].push({
        quantity: item.quantity,
        costPerUnit: item.costPerUnit,
        totalCost: item.totalCost,
        purchaseDate,
        supplier,
        invoiceNo,
      });
    }
  }

  const ids = Object.keys(purchaseMap);
  console.log(`   🔍 Found ${ids.length} ${entityName} types with purchase history`);

  let updated = 0;
  let totalEntries = 0;

  for (const entityId of ids) {
    const entries = purchaseMap[entityId];
    const entity = await Model.findById(entityId);
    if (!entity) {
      console.warn(`   ⚠️ ${entityName} ${entityId} not found – skipping`);
      continue;
    }

    // Clear and rebuild purchases array
    entity.purchases = [];
    for (const entry of entries) {
      if (itemType === 'RawMaterial') {
        entity.purchases.push({
          quantityMl: entry.quantity,
          costPerMl: entry.costPerUnit,
          totalCost: entry.totalCost,
          purchaseDate: entry.purchaseDate,
          supplier: entry.supplier,
          invoiceNo: entry.invoiceNo,
        });
      } else {
        entity.purchases.push({
          quantity: entry.quantity,
          costPerUnit: entry.costPerUnit,
          totalCost: entry.totalCost,
          purchaseDate: entry.purchaseDate,
          supplier: entry.supplier,
          invoiceNo: entry.invoiceNo,
        });
      }
    }

    // Calculate total quantity and average cost from purchases only
    let totalQty = 0;
    let totalCostSum = 0;
    for (const p of entity.purchases) {
      const qty = itemType === 'RawMaterial' ? p.quantityMl : p.quantity;
      totalQty += qty;
      totalCostSum += p.totalCost;
    }

    // Set stock to total purchased quantity
    if (itemType === 'RawMaterial') {
      entity.currentStockMl = totalQty;
      entity.avgCostPerMl = totalQty > 0 ? totalCostSum / totalQty : 0;
    } else {
      entity.currentStock = totalQty;
      entity.avgCostPerUnit = totalQty > 0 ? totalCostSum / totalQty : 0;
      entity.totalPurchased = totalQty;
    }

    await entity.save();
    updated++;
    totalEntries += entity.purchases.length;
    console.log(`   ✅ ${entity.name || entity.sizeMl + 'ml'} – purchases: ${entity.purchases.length}, stock: ${totalQty}`);
  }

  // Reset entities with no purchases to zero
  const allEntities = await Model.find({});
  let zeroed = 0;
  for (const e of allEntities) {
    const entityId = e._id.toString();
    if (!purchaseMap[entityId]) {
      if (e.purchases.length > 0 || (itemType === 'RawMaterial' ? e.currentStockMl : e.currentStock) !== 0) {
        console.warn(`   ⚠️ ${e.name || e.sizeMl + 'ml'} has no purchases – resetting to 0`);
        if (itemType === 'RawMaterial') {
          e.currentStockMl = 0;
          e.avgCostPerMl = 0;
        } else {
          e.currentStock = 0;
          e.avgCostPerUnit = 0;
          e.totalPurchased = 0;
        }
        e.purchases = [];
        await e.save();
        zeroed++;
      }
    }
  }
  if (zeroed) console.log(`   📌 Reset ${zeroed} entities with no purchase history.`);

  console.log(`   ✅ ${entityName} rebuild complete. Updated ${updated} entities, ${totalEntries} purchase entries.`);
  return { updated, totalEntries };
}

// ----- Main -----
async function rebuildAll() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    await rebuildEntity(RawMaterial, 'RawMaterial');
    await rebuildEntity(Bottle, 'Bottle');

    console.log('\n🎉 Stock rebuild from purchases complete!');
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

rebuildAll();