const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../src/models/Product');
const RawMaterial = require('../src/models/RawMaterial');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // ---------- 1. Find the raw material with SKU "Fant_2" ----------
    let fant2Raw = await RawMaterial.findOne({ sku: 'Fant_2' });
    if (!fant2Raw) {
      console.error('❌ Raw material with SKU "Fant_2" not found. Please create it first.');
      process.exit(1);
    }

    // ---------- 2. Update its type and name ----------
    console.log(`📦 Before: ${fant2Raw.name} (${fant2Raw.sku}) – type: ${fant2Raw.type}`);
    fant2Raw.type = 'oil';
    fant2Raw.name = 'Fantasy Perfume (ready)';
    await fant2Raw.save();
    console.log(`✅ Updated: ${fant2Raw.name} (${fant2Raw.sku}) – type: ${fant2Raw.type}`);

    // ---------- 3. Find ethanol ----------
    const ethanol = await RawMaterial.findOne({ sku: 'ETH' });
    if (!ethanol) {
      console.error('❌ Ethanol (ETH) not found');
      process.exit(1);
    }

    // ---------- 4. Reassign spray product(s) to use Fant_2 oil ----------
    // Which spray products should use Fant_2? Those that are Fantasy sprays.
    // Based on sales, we have Fant_2_SP. Also possible Fant_SP if exists.
    const targetSpraySkus = ['Fant_2_SP', 'Fant_SP']; // include both variants
    const sprayProducts = await Product.find({ sku: { $in: targetSpraySkus }, type: 'spray' });

    if (sprayProducts.length === 0) {
      console.log('ℹ️ No spray products found for SKUs:', targetSpraySkus.join(', '));
    } else {
      for (const prod of sprayProducts) {
        // Overwrite blendComponents to use Fant_2 oil (45%) + Ethanol (55%)
        prod.blendComponents = [
          { material: fant2Raw._id, percentage: 45 },
          { material: ethanol._id, percentage: 55 }
        ];
        await prod.save();
        console.log(`✅ Updated spray ${prod.name} (${prod.sku}) → 45% ${fant2Raw.name} + 55% Ethanol`);
      }
    }

    // ---------- 5. Optional: check if roll‑on product "Fant" is still using "Fant" oil ----------
    const rollOnFant = await Product.findOne({ sku: 'Fant', type: 'roll-on' });
    if (rollOnFant && rollOnFant.baseOil) {
      const oldOil = await RawMaterial.findById(rollOnFant.baseOil);
      console.log(`ℹ️ Roll‑on ${rollOnFant.name} uses baseOil: ${oldOil ? oldOil.name : 'unknown'}`);
    }

    console.log('\n🎉 Done. Fantasy spray products now use the new oil.');
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });