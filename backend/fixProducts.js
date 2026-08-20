// debugUsage.js
const mongoose = require('mongoose');
require('dotenv').config();

// Load models – adjust paths as needed
const Product = require('./src/models/Product');
const Sale = require('./src/models/Sale');
const RawMaterial = require('./src/models/RawMaterial');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://mohimreza1234_db_user:0yEyB17V2u0fCQGB@cluster0.vk0e7ts.mongodb.net/LuxePerfume?retryWrites=true&w=majority&appName=Cluster0';

// Helper: parse blendComponents string into array of { name, percentage }
function parseBlendComponents(comp) {
  if (!comp) return [];
  if (Array.isArray(comp)) {
    return comp
      .filter(c => c.material && c.percentage)
      .map(c => ({ material: c.material, percentage: c.percentage }));
  }
  // If it's a string: "Ahsas al Arabia (45%); Ethanol (55%)"
  const str = String(comp);
  const parts = str.split(';').map(s => s.trim());
  const parsed = [];
  for (const part of parts) {
    const match = part.match(/^(.*?)\s*\((\d+(?:\.\d+)?)%\)\s*$/);
    if (match) {
      parsed.push({ name: match[1].trim(), percentage: parseFloat(match[2]) });
    }
  }
  return parsed;
}

async function debugUsage() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected');

    // Fetch all data
    const [products, sales, materials] = await Promise.all([
      Product.find({}).lean(),
      Sale.find({}).lean(),
      RawMaterial.find({}).lean(),
    ]);

    // Build product map
    const productMap = {};
    products.forEach(p => productMap[p._id.toString()] = p);

    // Build material name -> _id map (case-insensitive)
    const nameToId = {};
    materials.forEach(m => {
      nameToId[m.name.toLowerCase()] = m._id;
    });

    // Usage accumulator: materialId -> total ml
    const usage = {};

    // Iterate sales
    for (const sale of sales) {
      if (!sale.items) continue;
      for (const item of sale.items) {
        const prodId = item.product?._id || item.product;
        if (!prodId) continue;
        const product = productMap[prodId.toString()];
        if (!product) {
          console.warn(`⚠️ Product not found for sale item: ${prodId}`);
          continue;
        }

        const sizeMl = item.sizeMl || 0;
        const qty = item.quantity || 0;
        if (sizeMl === 0 || qty === 0) continue;

        if (product.type === 'roll-on') {
          const oilId = product.baseOil?._id || product.baseOil;
          if (oilId) {
            const used = sizeMl * qty;
            usage[oilId.toString()] = (usage[oilId.toString()] || 0) + used;
          } else {
            console.warn(`⚠️ Roll-on product ${product.name} has no baseOil`);
          }
        } else if (product.type === 'spray') {
          const comps = parseBlendComponents(product.blendComponents);
          for (const comp of comps) {
            let matId = comp.material?._id || comp.material;
            // If we have a name instead of ID, look it up
            if (!matId && comp.name) {
              const lowerName = comp.name.toLowerCase();
              matId = nameToId[lowerName];
              if (!matId) {
                console.warn(`⚠️ Material "${comp.name}" not found for product ${product.name}`);
                continue;
              }
            }
            if (!matId) continue;
            const percentage = comp.percentage || 0;
            if (percentage === 0) continue;
            const used = (sizeMl * (percentage / 100)) * qty;
            usage[matId.toString()] = (usage[matId.toString()] || 0) + used;
          }
        }
      }
    }

    // Build report
    console.log('\n📊 Usage Report (ml):');
    console.log('Material Name\t\tStock\tUsed\tAvailable');
    materials.forEach(m => {
      const used = usage[m._id.toString()] || 0;
      const stock = m.currentStockMl || 0;
      const available = stock - used;
      console.log(`${m.name.padEnd(20)}\t${stock.toFixed(1)}\t${used.toFixed(1)}\t${available.toFixed(1)}`);
    });

    // Also log total sales count
    console.log(`\n📦 Total sales: ${sales.length}`);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

debugUsage();