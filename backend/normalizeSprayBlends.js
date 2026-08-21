const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// ----- Load models -----
let Product, RawMaterial;
try {
  Product = require('./src/models/Product');
  RawMaterial = require('./src/models/RawMaterial');
  console.log('✅ Loaded models from ./src/models');
} catch (e) {
  try {
    Product = require('../models/Product');
    RawMaterial = require('../models/RawMaterial');
    console.log('✅ Loaded models from ./models');
  } catch (e2) {
    console.error('❌ Cannot find models.');
    process.exit(1);
  }
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

// ----- Helper to find material by name (case‑insensitive) -----
async function findMaterialByName(name) {
  const materials = await RawMaterial.find({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
  if (materials.length === 0) {
    throw new Error(`Material "${name}" not found`);
  }
  return materials[0];
}

async function setSizeBasedSprayBlends() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Fetch all oil materials (to identify oil components)
    const oilMaterials = await RawMaterial.find({ type: 'oil' });
    const oilIdSet = new Set(oilMaterials.map(m => m._id.toString()));

    // 2. Find the required others
    let ethanol, isoE, galaxolide, ambroxan;
    try {
      ethanol = await findMaterialByName('Ethanol');
      isoE = await findMaterialByName('Iso E Super');
      galaxolide = await findMaterialByName('Galaxolide');
      ambroxan = await findMaterialByName('Ambroxan');
    } catch (err) {
      console.error('❌ Missing required material:', err.message);
      console.error('   Ensure Ethanol, Iso E Super, Galaxolide, Ambroxan exist.');
      process.exit(1);
    }

    // 3. Fetch all active spray products
    const products = await Product.find({ type: 'spray', isActive: true });
    console.log(`📦 Found ${products.length} active spray products`);

    // 4. Define groups
    const groups = {
      small: {   // 6ml, 15ml
        oilTarget: 35,
        others: [
          { material: ethanol, percentage: 62 },
          { material: isoE, percentage: 1 },
          { material: galaxolide, percentage: 1 },
          { material: ambroxan, percentage: 1 },
        ],
      },
      large: {   // 30ml, 50ml, 100ml
        oilTarget: 55,
        others: [
          { material: ethanol, percentage: 42 },
          { material: isoE, percentage: 1 },
          { material: galaxolide, percentage: 1 },
          { material: ambroxan, percentage: 1 },
        ],
      },
    };

    let updatedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      // Determine group based on sizes
      const sizes = product.sizes.map(s => s.sizeMl);
      const hasLarge = sizes.some(s => [30, 50, 100].includes(s));
      const group = hasLarge ? groups.large : groups.small;

      // Extract oil components (those whose material is in the oil set)
      const oilComps = product.blendComponents.filter(comp => {
        const matId = comp.material?._id || comp.material;
        return matId && oilIdSet.has(matId.toString());
      });

      if (oilComps.length === 0) {
        console.log(`⏭️ Skipping ${product.name} – no oil components`);
        skippedCount++;
        continue;
      }

      // Calculate current oil total
      const currentOilTotal = oilComps.reduce((sum, c) => sum + c.percentage, 0);
      if (currentOilTotal === 0) {
        console.log(`⏭️ Skipping ${product.name} – oil total is 0`);
        skippedCount++;
        continue;
      }

      // Scale oil components to the target oil percentage
      const targetOil = group.oilTarget;
      const scale = targetOil / currentOilTotal;
      const newOilComps = oilComps.map(comp => ({
        material: comp.material,
        percentage: parseFloat((comp.percentage * scale).toFixed(2)),
      }));

      // Build others from group definition
      const others = group.others.map(o => ({
        material: o.material._id,
        percentage: o.percentage,
      }));

      // Combine
      product.blendComponents = [
        ...newOilComps,
        ...others,
      ];

      await product.save();
      updatedCount++;
      const groupName = hasLarge ? 'large (55%)' : 'small (35%)';
      console.log(`✅ Updated ${product.name} – group: ${groupName}, oil: ${newOilComps.map(c => `${c.percentage}%`).join(', ')}, others: ${others.map(o => `${o.percentage}%`).join(', ')}`);
    }

    console.log(`\n🎉 Done!`);
    console.log(`   ✅ Updated ${updatedCount} products`);
    console.log(`   ⏭️ Skipped ${skippedCount} products`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

setSizeBasedSprayBlends();