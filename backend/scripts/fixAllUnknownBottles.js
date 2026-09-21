const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// ----- Helper: load model with fallback paths -----
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

// ----- Load models -----
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

// ----- Helper: rebuild one entity (raw material or bottle) -----
async function rebuildEntity(Model, itemType, idField, purchaseKey) {
  const entityName = Model.modelName;
  console.log(`\n🔄 Rebuilding ${entityName} stock...`);

  // 1. Fetch all purchases
  const purchases = await Purchase.find().lean();
  console.log(`   📦 Found ${purchases.length} purchase records`);

  // 2. Group items by entity ID
  const map = {};
  for (const purchase of purchases) {
    const invoiceNo = purchase.invoiceNo;
    const supplier = purchase.supplier || '';
    const purchaseDate = purchase.purchaseDate || new Date();

    for (const item of purchase.items) {
      if (item.itemType !== itemType) continue;
      const entityId = item.item.toString();
      if (!map[entityId]) map[entityId] = [];

      map[entityId].push({
        quantity: item.quantity,
        costPerUnit: item.costPerUnit,
        totalCost: item.totalCost,
        purchaseDate,
        supplier,
        invoiceNo,
      });
    }
  }

  const ids = Object.keys(map);
  console.log(`   🔍 Found ${ids.length} ${entityName} types with purchase history`);

  let updated = 0;
  let totalEntries = 0;

  // 3. Process each entity
  for (const entityId of ids) {
    const entries = map[entityId];
    const entity = await Model.findById(entityId);
    if (!entity) {
      console.warn(`   ⚠️ ${entityName} ${entityId} not found – skipping`);
      continue;
    }

    // Clear existing purchases
    entity.purchases = [];

    // Add new entries
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

    // Recalculate stock and average cost
    let totalQty = 0;
    let totalCostSum = 0;
    for (const p of entity.purchases) {
      const qty = itemType === 'RawMaterial' ? p.quantityMl : p.quantity;
      totalQty += qty;
      totalCostSum += p.totalCost;
    }

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
    console.log(`   ✅ ${entity.name || entity.sizeMl + 'ml'} – ${entity.purchases.length} entries, stock: ${totalQty}`);
  }

  // 4. Reset entities with no purchases
  const allEntities = await Model.find({});
  let zeroed = 0;
  for (const e of allEntities) {
    const stock = itemType === 'RawMaterial' ? e.currentStockMl : e.currentStock;
    if (e.purchases.length === 0 && stock > 0) {
      console.warn(`   ⚠️ ${e.name || e.sizeMl + 'ml'} has stock ${stock} but no purchases – setting to 0.`);
      if (itemType === 'RawMaterial') {
        e.currentStockMl = 0;
        e.avgCostPerMl = 0;
      } else {
        e.currentStock = 0;
        e.avgCostPerUnit = 0;
        e.totalPurchased = 0;
      }
      await e.save();
      zeroed++;
    }
  }
  if (zeroed) console.log(`   📌 Reset ${zeroed} entities with no purchase history.`);

  console.log(`   ✅ ${entityName} rebuild complete. Updated ${updated} entities, ${totalEntries} purchase entries.`);
  return { updated, totalEntries };
}

// ----- Main -----
async function rebuildAll() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Rebuild Raw Materials
    await rebuildEntity(RawMaterial, 'RawMaterial', 'material', 'quantityMl');

    // Rebuild Bottles
    await rebuildEntity(Bottle, 'Bottle', 'bottle', 'quantity');

    console.log('\n🎉 All stock rebuild complete!');
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

rebuildAll();