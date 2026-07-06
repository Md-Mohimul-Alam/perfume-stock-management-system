const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./src/models/Product');
const RawMaterial = require('./src/models/RawMaterial');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    const products = await Product.find({ isActive: true });
    const materials = await RawMaterial.find({});

    // Build a map: material name (lowercase) -> material document
    const materialMap = {};
    materials.forEach(m => {
      materialMap[m.name.toLowerCase()] = m;
    });

    // Find ethanol material (for sprays)
    const ethanol = await RawMaterial.findOne({ type: 'ethanol' });

    let updatedRollOn = 0;
    let updatedSpray = 0;

    for (const product of products) {
      // Skip if product type is not recognized
      if (!['roll-on', 'spray'].includes(product.type)) continue;

      // Determine the base name for matching:
      // For spray, remove " Spray" suffix; for roll-on, keep as is.
      let baseName = product.name;
      if (product.type === 'spray' && baseName.endsWith(' Spray')) {
        baseName = baseName.slice(0, -6); // remove " Spray" (6 chars including space)
      }

      const baseNameLower = baseName.toLowerCase();
      const matchedMaterial = materialMap[baseNameLower];

      if (!matchedMaterial) {
        console.warn(`⚠️ No matching material found for ${product.name} (tried "${baseName}")`);
        continue;
      }

      // Check if already assigned correctly
      let alreadyCorrect = false;
      if (product.type === 'roll-on') {
        if (product.baseOil && product.baseOil.toString() === matchedMaterial._id.toString()) {
          alreadyCorrect = true;
        }
      } else if (product.type === 'spray') {
        if (product.blendComponents && product.blendComponents.length > 0) {
          const firstMat = product.blendComponents[0].material;
          if (firstMat && firstMat.toString() === matchedMaterial._id.toString()) {
            alreadyCorrect = true;
          }
        }
      }

      if (alreadyCorrect) {
        console.log(`⏭️ ${product.name} already has correct material – skipping`);
        continue;
      }

      // Assign the correct material
      if (product.type === 'roll-on') {
        product.baseOil = matchedMaterial._id;
        await product.save();
        updatedRollOn++;
        console.log(`✅ Roll-on ${product.name} → baseOil: ${matchedMaterial.name}`);
      } else if (product.type === 'spray') {
        // Build blend: 70% oil, 30% ethanol (or 100% oil if no ethanol)
        const blend = [];
        blend.push({ material: matchedMaterial._id, percentage: 70 });
        if (ethanol) {
          blend.push({ material: ethanol._id, percentage: 30 });
        } else {
          blend[0].percentage = 100;
        }
        product.blendComponents = blend;
        await product.save();
        updatedSpray++;
        console.log(`✅ Spray ${product.name} → blendComponents: ${matchedMaterial.name} (70%) ${ethanol ? `+ ${ethanol.name} (30%)` : ''}`);
      }
    }

    console.log(`\n🎉 Done. Updated ${updatedRollOn} roll‑on products and ${updatedSpray} spray products.`);
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });