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
const Purchase = loadModel('Purchase');
const Transaction = loadModel('Transaction');
const InventoryLog = loadModel('InventoryLog');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

// ----- Configuration -----
// Set to true to actually add purchase records for missing fixatives
const APPLY_FIX = process.argv.includes('--apply');
// Amount to add for each fixative (ml) if stock is zero
const FIXATIVE_ADD_ML = 100;

async function fixZeroStockBlends() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // 1. Load all materials and check stock
    const materials = await RawMaterial.find();
    const stockMap = {};
    materials.forEach(m => {
      stockMap[m._id.toString()] = m.currentStockMl || 0;
    });

    // 2. Identify fixatives that are commonly used: Iso E Super (Iso), Galaxolide (Glx), Ambroxan (Ambx)
    const fixativeSkus = ['Iso', 'Glx', 'Ambx'];
    const fixatives = materials.filter(m => fixativeSkus.includes(m.sku));
    const zeroFixatives = fixatives.filter(m => (m.currentStockMl || 0) === 0);

    // 3. If fixatives have zero stock and we are applying fixes, add purchase records
    if (APPLY_FIX && zeroFixatives.length) {
      console.log(`🔧 Adding ${FIXATIVE_ADD_ML} ml for each missing fixative...`);
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        for (const mat of zeroFixatives) {
          const costPerMl = mat.avgCostPerMl || (mat.sku === 'Iso' ? 4 : mat.sku === 'Glx' ? 5 : 12);
          const totalCost = FIXATIVE_ADD_ML * costPerMl;
          const invoiceNo = `PUR-FIX-${Date.now()}-${mat.sku}`;

          const purchase = new Purchase({
            invoiceNo,
            supplier: 'System Adjustment',
            purchaseDate: new Date(),
            items: [{
              itemType: 'RawMaterial',
              item: mat._id,
              quantity: FIXATIVE_ADD_ML,
              costPerUnit: costPerMl,
              totalCost: totalCost,
            }],
            totalAmount: totalCost,
            notes: `Auto-fix: added ${FIXATIVE_ADD_ML} ml of ${mat.name}`,
          });
          await purchase.save({ session });

          mat.addPurchase(FIXATIVE_ADD_ML, costPerMl, totalCost, 'System Adjustment', invoiceNo);
          await mat.save({ session });

          await InventoryLog.create([{
            material: mat._id,
            changeQuantity: FIXATIVE_ADD_ML,
            reason: 'adjustment',
            reference: purchase._id,
            refModel: 'Purchase',
            notes: `Auto-fix: added ${FIXATIVE_ADD_ML} ml`,
          }], { session });

          await Transaction.create([{
            type: 'cash_out',
            amount: totalCost,
            category: 'Purchase',
            reference: purchase._id,
            refModel: 'Purchase',
            description: `Auto-fix purchase for ${mat.name}`,
          }], { session });

          console.log(`✅ Added ${FIXATIVE_ADD_ML} ml of ${mat.name} (${mat.sku})`);
        }
        await session.commitTransaction();
        console.log('✅ Fixatives added successfully.');
      } catch (error) {
        await session.abortTransaction();
        console.error('❌ Transaction failed:', error.message);
      } finally {
        session.endSession();
      }
    } else if (zeroFixatives.length && !APPLY_FIX) {
      console.log(`⚠️ Fixatives with zero stock: ${zeroFixatives.map(m => m.name).join(', ')}`);
      console.log('   To add stock, run: node fixZeroStockBlends.js --apply');
    }

    // 4. Now adjust blends to remove any zero-stock fixatives
    const products = await Product.find({ type: 'spray', isActive: true });
    console.log(`📦 Found ${products.length} active spray products.`);
    let updated = 0;
    let skipped = 0;

    for (const product of products) {
      if (!product.blendComponents || product.blendComponents.length === 0) continue;

      // Get current components
      let components = product.blendComponents.map(c => {
        const matId = c.material?._id?.toString() || c.material?.toString();
        return { matId, percentage: c.percentage };
      });

      // Identify fixative components (those with zero stock)
      const fixativeIds = zeroFixatives.map(m => m._id.toString());
      let hasZeroFixative = false;
      const newComponents = [];

      for (const comp of components) {
        if (fixativeIds.includes(comp.matId)) {
          hasZeroFixative = true;
          // Instead of removing, we could add its percentage to ethanol
          // We'll later redistribute to ethanol
          continue; // skip this component
        }
        newComponents.push(comp);
      }

      if (!hasZeroFixative) continue; // no change needed

      // Recalculate percentages: we need to keep total 100%
      // We removed fixatives, so we need to add their percentages to ethanol
      // Find ethanol component
      const ethanol = await RawMaterial.findOne({ type: 'ethanol' });
      if (!ethanol) {
        console.warn(`⚠️ No ethanol found, cannot redistribute fixative percentages for ${product.name}`);
        skipped++;
        continue;
      }
      const ethanolId = ethanol._id.toString();

      // Sum the percentages of removed fixatives
      const removedTotal = components
        .filter(c => fixativeIds.includes(c.matId))
        .reduce((sum, c) => sum + c.percentage, 0);

      if (removedTotal === 0) continue;

      // Find ethanol component in newComponents
      let ethanolComp = newComponents.find(c => c.matId === ethanolId);
      if (ethanolComp) {
        ethanolComp.percentage += removedTotal;
        // Round to 2 decimals
        ethanolComp.percentage = parseFloat(ethanolComp.percentage.toFixed(2));
      } else {
        // If ethanol was not in blend, add it
        newComponents.push({ matId: ethanolId, percentage: removedTotal });
      }

      // Ensure total is 100% (adjust the largest component if rounding)
      const total = newComponents.reduce((sum, c) => sum + c.percentage, 0);
      if (Math.abs(total - 100) > 0.01) {
        // Find the largest component and adjust
        const maxComp = newComponents.reduce((a, b) => (a.percentage > b.percentage) ? a : b);
        maxComp.percentage += (100 - total);
        maxComp.percentage = parseFloat(maxComp.percentage.toFixed(2));
      }

      // Update product blend
      product.blendComponents = newComponents.map(c => ({
        material: c.matId,
        percentage: c.percentage,
      }));

      await product.save();
      updated++;
      console.log(`✅ Updated ${product.name} – removed zero-stock fixatives`);
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Products updated: ${updated}`);
    console.log(`   ⏭️ Skipped: ${skipped}`);

    // Also check primary oils for zero stock (optional warning)
    const oilIds = materials.filter(m => m.type === 'oil' && (m.currentStockMl || 0) === 0).map(m => m._id.toString());
    if (oilIds.length) {
      const oilNames = materials.filter(m => oilIds.includes(m._id.toString())).map(m => m.name).join(', ');
      console.log(`\n⚠️ Oils with zero stock: ${oilNames}`);
      console.log('   These may be used as primary oils in roll-on or spray products.');
      console.log('   Please add purchase records for them or adjust product blends.');
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixZeroStockBlends();