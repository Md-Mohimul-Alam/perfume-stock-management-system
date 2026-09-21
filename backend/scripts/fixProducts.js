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
  throw new Error(`Model ${name} not found`);
}

const Product = loadModel('Product');
const RawMaterial = loadModel('RawMaterial');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

// Increase oil percentage by this value (e.g., 5 = +5%)
const INCREASE_BY = 5;

async function increaseOilFor30ml() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected');

    // Find all spray products that have a 30ml size
    const products = await Product.find({
      type: 'spray',
      'sizes.sizeMl': 30,
      isActive: true,
    });

    console.log(`📦 Found ${products.length} spray products with 30ml size.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      // 1. Check if all blend components reference valid materials
      let allValid = true;
      const invalidComponents = [];
      const validComponents = [];

      for (const comp of product.blendComponents) {
        const matId = comp.material;
        if (!matId) {
          allValid = false;
          invalidComponents.push(comp);
          continue;
        }
        const material = await RawMaterial.findById(matId);
        if (!material) {
          allValid = false;
          invalidComponents.push(comp);
          continue;
        }
        validComponents.push(comp);
      }

      if (!allValid) {
        console.warn(`⚠️ Skipping product "${product.name}" – invalid blend components: ${invalidComponents.map(c => c.material).join(', ')}`);
        skippedCount++;
        continue; // skip this product
      }

      // 2. Separate oil vs non‑oil components using material type
      const materialIds = validComponents.map(c => c.material);
      const materials = await RawMaterial.find({ _id: { $in: materialIds } });
      const materialMap = {};
      materials.forEach(m => materialMap[m._id.toString()] = m);

      const oilComponents = [];
      const otherComponents = [];

      for (const comp of validComponents) {
        const mat = materialMap[comp.material.toString()];
        if (mat && mat.type === 'oil') {
          oilComponents.push(comp);
        } else {
          otherComponents.push(comp);
        }
      }

      if (oilComponents.length === 0) {
        console.warn(`⚠️ Skipping "${product.name}" – no oil components`);
        skippedCount++;
        continue;
      }

      // 3. Calculate new percentages
      const totalOil = oilComponents.reduce((sum, c) => sum + c.percentage, 0);
      const newTotalOil = totalOil + INCREASE_BY;

      if (newTotalOil > 100) {
        console.warn(`⚠️ Skipping "${product.name}" – new total oil would exceed 100% (${newTotalOil})`);
        skippedCount++;
        continue;
      }

      const scale = newTotalOil / totalOil;
      const newOilComps = oilComponents.map(c => ({
        ...c.toObject(),
        percentage: parseFloat((c.percentage * scale).toFixed(2)),
      }));

      // Adjust other components proportionally
      const totalOther = otherComponents.reduce((sum, c) => sum + c.percentage, 0);
      const newTotalOther = 100 - newTotalOil;
      const otherScale = totalOther > 0 ? newTotalOther / totalOther : 0;
      const newOtherComps = otherComponents.map(c => ({
        ...c.toObject(),
        percentage: parseFloat((c.percentage * otherScale).toFixed(2)),
      }));

      // 4. Update product blend
      product.blendComponents = [...newOilComps, ...newOtherComps];

      // 5. Save – this will trigger pre‑save hooks and recalculate size usage
      try {
        await product.save();
        updatedCount++;
        console.log(`✅ Updated ${product.name} – oil now ${newTotalOil.toFixed(2)}%`);
      } catch (saveError) {
        console.error(`❌ Error saving ${product.name}:`, saveError.message);
        skippedCount++;
      }
    }

    console.log(`\n🎉 Done. Updated ${updatedCount} products, skipped ${skippedCount}.`);
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

increaseOilFor30ml();