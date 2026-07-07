const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../src/models/Product');
const RawMaterial = require('../src/models/RawMaterial');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

const log = (msg, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✅';
  console.log(`${timestamp} ${prefix} ${msg}`);
};

mongoose.connect(MONGO_URI)
  .then(async () => {
    log('Connected to MongoDB');

    // ---------- 1. Load materials ----------
    const materials = await RawMaterial.find({});
    const matBySku = {};
    const matByName = {};
    materials.forEach(m => {
      matBySku[m.sku] = m;
      matByName[m.name] = m;
    });

    const ethanol = matBySku['ETH'];
    if (!ethanol) {
      log('Ethanol (ETH) not found – please create it first.', 'error');
      process.exit(1);
    }

    // ---------- 2. Special handling for Fant_2 ----------
    let fant2 = matBySku['Fant_2'];
    if (fant2) {
      // Change type to oil and rename
      if (fant2.type !== 'oil' || fant2.name !== 'Fantasy Perfume (ready)') {
        fant2.type = 'oil';
        fant2.name = 'Fantasy Perfume (ready)';
        await fant2.save();
        log(`Raw material Fant_2 → oil, renamed to "Fantasy Perfume (ready)"`);
      } else {
        log(`Fant_2 already set up as oil with correct name.`);
      }
    } else {
      log('Fant_2 not found – skipping special handling.', 'warn');
    }

    // ---------- 3. Update Fant_2_SP product to use Fant_2 oil ----------
    const targetSprays = ['Fant_2_SP', 'Fant_SP'];
    for (const sku of targetSprays) {
      const product = await Product.findOne({ sku, type: 'spray' });
      if (product) {
        const oilToUse = fant2 || matBySku['Fant']; // fallback to Fant if Fant_2 missing
        if (oilToUse) {
          const newBlend = [
            { material: oilToUse._id, percentage: 45 },
            { material: ethanol._id, percentage: 55 }
          ];
          // Check if already correct
          const current = product.blendComponents || [];
          const isCorrect = current.length === 2 &&
            current.some(c => c.material && c.material.toString() === oilToUse._id.toString() && c.percentage === 45) &&
            current.some(c => c.material && c.material.toString() === ethanol._id.toString() && c.percentage === 55);
          if (!isCorrect) {
            product.blendComponents = newBlend;
            await product.save();
            log(`Updated ${product.name} (${product.sku}) to use ${oilToUse.name}.`);
          } else {
            log(`${product.sku} already correct – skipping.`);
          }
        }
      }
    }

    // ---------- 4. Now run the full assignment for all other products ----------
    // (We'll reuse the logic from the main script, but skip products we just fixed)
    const specialBlends = {
      'SR_SP': [
        { material: matBySku['DunIco']?._id, percentage: 43.87 },
        { material: matBySku['DipTam']?._id, percentage: 21.12 },
        { material: ethanol._id, percentage: 35 }
      ],
      'SR2_SP': [
        { material: matBySku['DunIco']?._id, percentage: 43.87 },
        { material: matBySku['DipTam']?._id, percentage: 21.12 },
        { material: ethanol._id, percentage: 35 }
      ],
      'LUXE1_SP': [
        { material: matBySku['CreAve']?._id, percentage: 43.87 },
        { material: matBySku['GucFla']?._id, percentage: 21.12 },
        { material: ethanol._id, percentage: 35 }
      ]
    };

    // Explicit map for tricky SKUs – now pointing to Fant_2
    const explicitOilMap = {
      'Fant_2_SP': 'Fant_2',
      'Fant_SP': 'Fant_2',
    };

    function findOilForProduct(product) {
      if (explicitOilMap[product.sku]) {
        const oil = matBySku[explicitOilMap[product.sku]];
        if (oil) return oil;
      }
      let baseSku = product.sku;
      if (product.type === 'spray') {
        if (baseSku.endsWith('_SP')) baseSku = baseSku.slice(0, -3);
        if (baseSku.endsWith('_2')) baseSku = baseSku.slice(0, -2);
      }
      let oil = matBySku[baseSku];
      if (oil) return oil;
      let baseName = product.name;
      if (product.type === 'spray' && baseName.endsWith(' Spray')) {
        baseName = baseName.slice(0, -6);
      }
      oil = matByName[baseName];
      if (oil) return oil;
      return matBySku[product.sku] || null;
    }

    const products = await Product.find({ isActive: true });
    let fixedRollOn = 0;
    let fixedSpray = 0;
    let warnings = [];

    for (const product of products) {
      // Skip products we've already handled (Fant_2_SP, Fant_SP)
      if (targetSprays.includes(product.sku)) continue;

      if (product.type === 'roll-on') {
        const oil = findOilForProduct(product);
        if (!oil) {
          warnings.push(`No oil found for roll‑on ${product.name} (${product.sku})`);
          continue;
        }
        if (!product.baseOil || product.baseOil.toString() !== oil._id.toString()) {
          product.baseOil = oil._id;
          await product.save();
          fixedRollOn++;
          log(`Roll‑on ${product.name} (${product.sku}) → baseOil: ${oil.name}`);
        }
        continue;
      }

      if (product.type === 'spray') {
        if (specialBlends[product.sku]) {
          const blend = specialBlends[product.sku];
          const valid = blend.every(b => b.material);
          if (!valid) {
            warnings.push(`Special blend for ${product.sku} has missing material – skipping`);
            continue;
          }
          product.blendComponents = blend;
          await product.save();
          fixedSpray++;
          log(`Special spray ${product.name} (${product.sku}) updated with custom blend.`);
          continue;
        }

        const oil = findOilForProduct(product);
        if (!oil) {
          warnings.push(`No oil found for spray ${product.name} (${product.sku})`);
          continue;
        }
        product.blendComponents = [
          { material: oil._id, percentage: 45 },
          { material: ethanol._id, percentage: 55 }
        ];
        await product.save();
        fixedSpray++;
        log(`Spray ${product.name} (${product.sku}) → 45% ${oil.name} + 55% Ethanol`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Roll‑on fixed: ${fixedRollOn}`);
    console.log(`   Spray fixed:   ${fixedSpray}`);
    if (warnings.length) {
      console.log(`   Warnings:      ${warnings.length}`);
      warnings.forEach(w => console.log(`     ⚠️ ${w}`));
    }

    const invalidMaterials = materials.filter(m => m.type === 'spray');
    if (invalidMaterials.length) {
      console.log('\n⚠️ Found raw materials with type "spray":');
      invalidMaterials.forEach(m => console.log(`   - ${m.name} (${m.sku}) – should be oil/ethanol/fixative`));
      console.log('   You may delete them manually from the Inventory page if they are not needed.');
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });