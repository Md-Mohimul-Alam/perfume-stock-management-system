const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../src/models/Product');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    const products = await Product.find({ isActive: true }).lean();
    const missing = [];

    for (const p of products) {
      if (p.type === 'roll-on') {
        if (!p.baseOil) {
          missing.push({ name: p.name, sku: p.sku, issue: 'No baseOil' });
        }
      } else if (p.type === 'spray') {
        if (!p.blendComponents || p.blendComponents.length === 0) {
          missing.push({ name: p.name, sku: p.sku, issue: 'No blendComponents' });
        } else {
          for (const comp of p.blendComponents) {
            if (!comp.material) {
              missing.push({ name: p.name, sku: p.sku, issue: 'Missing material in blend' });
              break;
            }
          }
        }
      }
    }

    console.log('\n📊 Products with missing materials:');
    if (missing.length === 0) {
      console.log('✅ All products have materials defined.');
    } else {
      console.table(missing);
      console.log(`\n🔴 ${missing.length} products need material setup.`);
    }
    await mongoose.disconnect();
  })
  .catch(console.error);