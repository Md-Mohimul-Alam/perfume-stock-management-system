const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Load model
let RawMaterial;
try {
  RawMaterial = require('./src/models/RawMaterial');
} catch (e) {
  RawMaterial = require('../models/RawMaterial');
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

async function reverseCorrection() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  // Find all materials that have a correction purchase
  const materials = await RawMaterial.find({
    'purchases.supplier': 'Manual Correction',
    'purchases.invoiceNo': 'CORRECTION',
  });

  if (materials.length === 0) {
    console.log('ℹ️ No correction purchases found.');
    await mongoose.disconnect();
    return;
  }

  console.log(`🔍 Found ${materials.length} materials with correction purchases.`);

  let totalRemoved = 0;

  for (const material of materials) {
    // Filter out correction entries
    const originalLength = material.purchases.length;
    material.purchases = material.purchases.filter(
      p => !(p.supplier === 'Manual Correction' && p.invoiceNo === 'CORRECTION')
    );
    const removed = originalLength - material.purchases.length;

    if (removed === 0) continue;

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
    totalRemoved += removed;
    console.log(`✅ Removed ${removed} correction purchase(s) from ${material.name} (${material.sku}) – stock restored to ${material.currentStockMl}ml`);
  }

  console.log(`\n🎉 Reversal complete. Removed ${totalRemoved} correction purchase entries.`);
  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

reverseCorrection().catch(console.error);