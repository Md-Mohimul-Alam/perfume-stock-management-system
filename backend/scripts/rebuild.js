const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

function loadModel(name) {
  const paths = [
    path.join(__dirname, 'src/models', name),
    path.join(__dirname, 'models', name),
    path.join(__dirname, '../src/models', name),
  ];
  for (const p of paths) { try { return require(p); } catch {} }
  throw new Error(`Model ${name} not found`);
}

const Purchase = loadModel('Purchase');
const Sale = loadModel('Sale');
const Product = loadModel('Product');
const RawMaterial = loadModel('RawMaterial');
const Bottle = loadModel('Bottle');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) { console.error('❌ MONGO_URI not set'); process.exit(1); }

async function diagnose() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected');

  // 1. Total purchased per material
  const purchases = await Purchase.find().lean();
  const purchased = {};
  for (const p of purchases) {
    for (const item of p.items) {
      if (item.itemType === 'RawMaterial') {
        const id = item.item.toString();
        purchased[id] = (purchased[id] || 0) + item.quantity;
      }
    }
  }

  // 2. Total consumed per material from sales
  const sales = await Sale.find().populate('items.product');
  const consumed = {};
  const productConsumption = {}; // productId -> { materialId: ml }

  for (const sale of sales) {
    for (const item of sale.items) {
      const product = item.product;
      if (!product) continue;
      const sizeVariant = product.sizes.find(s => s.sizeMl === item.sizeMl);
      if (!sizeVariant) continue;
      const qty = item.quantity;

      // Bottle usage (we'll ignore for this diagnosis)
      // Raw material usage
      if (product.type === 'roll-on') {
        if (product.baseOil) {
          const oilMl = sizeVariant.oilMlUsed || sizeVariant.sizeMl;
          const totalMl = oilMl * qty;
          const matId = product.baseOil.toString();
          consumed[matId] = (consumed[matId] || 0) + totalMl;
          if (!productConsumption[product._id]) productConsumption[product._id] = {};
          productConsumption[product._id][matId] = (productConsumption[product._id][matId] || 0) + totalMl;
        }
      } else if (product.type === 'spray') {
        if (product.blendComponents) {
          for (const comp of product.blendComponents) {
            if (!comp.material) continue;
            const percentage = comp.percentage || 0;
            if (percentage === 0) continue;
            const mlUsed = (sizeVariant.sizeMl * (percentage / 100)) * qty;
            const matId = comp.material.toString();
            consumed[matId] = (consumed[matId] || 0) + mlUsed;
            if (!productConsumption[product._id]) productConsumption[product._id] = {};
            productConsumption[product._id][matId] = (productConsumption[product._id][matId] || 0) + mlUsed;
          }
        }
      }
    }
  }

  // 3. Fetch all materials
  const materials = await RawMaterial.find();
  const matMap = {};
  materials.forEach(m => matMap[m._id.toString()] = m);

  console.log('\n📊 Material Balance (purchased vs consumed):\n');
  let totalPurchased = 0, totalConsumed = 0;
  const negativeMats = [];
  for (const id of Object.keys(consumed)) {
    const purchasedQty = purchased[id] || 0;
    const consumedQty = consumed[id] || 0;
    const balance = purchasedQty - consumedQty;
    const mat = matMap[id];
    const name = mat ? mat.name : 'Unknown';
    totalPurchased += purchasedQty;
    totalConsumed += consumedQty;
    if (balance < 0) {
      negativeMats.push({ id, name, purchased: purchasedQty, consumed: consumedQty, balance });
    }
  }

  // Print summary
  console.log(`Total purchased oil: ${totalPurchased.toFixed(2)} ml`);
  console.log(`Total consumed oil: ${totalConsumed.toFixed(2)} ml`);
  console.log(`Net balance: ${(totalPurchased - totalConsumed).toFixed(2)} ml`);
  console.log(`\nMaterials with negative balance (${negativeMats.length}):`);
  negativeMats.forEach(m => {
    console.log(`  ${m.name}: purchased ${m.purchased.toFixed(2)} ml, consumed ${m.consumed.toFixed(2)} ml, balance ${m.balance.toFixed(2)} ml`);
  });

  // 4. Which products are causing the overconsumption?
  console.log('\n🔍 Products consuming the most of each negative material:');
  for (const neg of negativeMats) {
    console.log(`\n--- ${neg.name} (balance ${neg.balance.toFixed(2)}) ---`);
    // Find products that consume this material
    const productList = [];
    for (const prodId of Object.keys(productConsumption)) {
      const usage = productConsumption[prodId][neg.id];
      if (usage) {
        const product = await Product.findById(prodId);
        if (product) {
          productList.push({ name: product.name, usage });
        }
      }
    }
    productList.sort((a,b) => b.usage - a.usage);
    productList.slice(0, 5).forEach(p => {
      console.log(`  ${p.name}: ${p.usage.toFixed(2)} ml`);
    });
    if (productList.length === 0) console.log('  (no products found)');
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

diagnose().catch(console.error);