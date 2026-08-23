const mongoose = require('mongoose');
const path = require('path');
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

const Product = loadModel('Product');
const RawMaterial = loadModel('RawMaterial');
const Bottle = loadModel('Bottle');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

// ----- Main -----
async function resetProductBlends() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // 1. Fetch all raw materials
    const materials = await RawMaterial.find();
    const matByName = {};
    const matBySku = {};
    materials.forEach(m => {
      matByName[m.name.toLowerCase()] = m;
      matBySku[m.sku] = m;
    });

    // 2. Find ethanol (required for sprays)
    let ethanol = await RawMaterial.findOne({ type: 'ethanol' });
    if (!ethanol) {
      console.warn('⚠️ No ethanol found. Sprays will use 100% oil.');
      ethanol = null;
    }

    // 3. Fetch all products (including inactive? we'll only update active ones)
    const products = await Product.find({ isActive: true });
    console.log(`📦 Found ${products.length} active products.`);

    let updatedRollOn = 0;
    let updatedSpray = 0;
    let skipped = 0;
    let errors = [];

    for (const product of products) {
      try {
        // Determine base name for matching
        let baseName = product.name;
        if (product.type === 'spray' && baseName.endsWith(' Spray')) {
          baseName = baseName.slice(0, -6); // remove " Spray"
        }
        // Also try to remove any trailing "(al-haramain)" etc.?
        // We'll keep it simple: remove anything after a '('
        const parenIndex = baseName.indexOf('(');
        if (parenIndex !== -1) {
          baseName = baseName.slice(0, parenIndex).trim();
        }

        const lowerName = baseName.toLowerCase();
        let matchedMaterial = matByName[lowerName];

        // If not found by name, try by SKU (e.g., product.sku without _SP)
        if (!matchedMaterial) {
          let skuBase = product.sku;
          if (product.type === 'spray' && skuBase.endsWith('_SP')) {
            skuBase = skuBase.slice(0, -3);
          }
          if (skuBase.endsWith('_2')) {
            skuBase = skuBase.slice(0, -2);
          }
          matchedMaterial = matBySku[skuBase];
        }

        // Special case: Fantasy Perfume (ready) – use Fant_2
        if (product.sku === 'Fant_2_SP' || product.sku === 'Fant_SP') {
          matchedMaterial = matBySku['Fant_2'] || matBySku['Fant'];
          if (!matchedMaterial) {
            errors.push(`No material for special SKU ${product.sku}`);
            continue;
          }
          // Ensure it's oil type
          if (matchedMaterial.type !== 'oil') {
            matchedMaterial.type = 'oil';
            await matchedMaterial.save();
            console.log(`✅ Updated ${matchedMaterial.name} type to oil`);
          }
        }

        if (!matchedMaterial) {
          console.warn(`⚠️ No matching material for "${product.name}" (SKU: ${product.sku})`);
          skipped++;
          continue;
        }

        // 4. Clear existing blends/baseOil
        if (product.type === 'roll-on') {
          product.baseOil = matchedMaterial._id;
          product.blendComponents = [];
          await product.save();
          updatedRollOn++;
          console.log(`✅ Roll‑on ${product.name} → baseOil: ${matchedMaterial.name}`);
        } else if (product.type === 'spray') {
          // Build blend: oil + ethanol
          const blend = [{ material: matchedMaterial._id, percentage: 70 }];
          if (ethanol) {
            blend.push({ material: ethanol._id, percentage: 30 });
          } else {
            // If no ethanol, use 100% oil
            blend[0].percentage = 100;
          }
          product.blendComponents = blend;
          // Clear any old baseOil (sprays shouldn't have it)
          product.baseOil = null;
          await product.save();
          updatedSpray++;
          const ethanolLabel = ethanol ? ` + Ethanol (30%)` : '';
          console.log(`✅ Spray ${product.name} → blend: ${matchedMaterial.name} (70%)${ethanolLabel}`);
        } else {
          console.warn(`⏭️ Unknown type for ${product.name} – skipping`);
          skipped++;
        }

        // 5. Recalculate making costs for all sizes
        for (let i = 0; i < product.sizes.length; i++) {
          await product.calculateMakingCost(i);
        }
        await product.save();

      } catch (err) {
        errors.push(`Error processing ${product.name}: ${err.message}`);
        console.error(`❌ Error: ${err.message}`);
      }
    }

    // 6. Summary
    console.log('\n📊 Summary:');
    console.log(`   ✅ Roll‑on updated: ${updatedRollOn}`);
    console.log(`   ✅ Spray updated: ${updatedSpray}`);
    console.log(`   ⏭️ Skipped: ${skipped}`);
    if (errors.length) {
      console.log(`   ❌ Errors: ${errors.length}`);
      errors.slice(0, 10).forEach(e => console.log(`     • ${e}`));
      if (errors.length > 10) console.log(`     ... and ${errors.length - 10} more`);
    }

    // 7. Optionally, check for materials with wrong type
    const wrongType = materials.filter(m => !['oil', 'ethanol', 'fixative'].includes(m.type));
    if (wrongType.length) {
      console.log('\n⚠️ Raw materials with non‑standard types:');
      wrongType.forEach(m => console.log(`   ${m.name} (${m.sku}) – type: ${m.type}`));
      console.log('   Consider updating them to oil/ethanol/fixative if needed.');
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetProductBlends();