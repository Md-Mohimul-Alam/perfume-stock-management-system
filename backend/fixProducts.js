const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// ----- Try to locate the Product model -----
let Product;
try {
  Product = require('./src/models/Product');
  console.log('✅ Loaded Product model from ./src/models/Product');
} catch (e) {
  try {
    Product = require('./models/Product');
    console.log('✅ Loaded Product model from ./models/Product');
  } catch (e2) {
    console.error('❌ Cannot find Product model. Please check the path.');
    console.error('   Expected: ./src/models/Product.js or ./models/Product.js');
    process.exit(1);
  }
}

// ----- MongoDB URI (your provided URI) -----
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://mohimreza1234_db_user:0yEyB17V2u0fCQGB@cluster0.vk0e7ts.mongodb.net/LuxePerfume?retryWrites=true&w=majority&appName=Cluster0';

// ----- Helper functions -----
function generateDescription(product) {
  const name = product.name;
  const type = product.type === 'spray' ? 'spray' : 'roll‑on';
  const notes = product.notes || [];
  const notesStr = notes.length ? notes.join(' ') : 'distinctive';
  return `${name} – a ${type} fragrance with ${notesStr} notes.`;
}

function inferNotes(name) {
  const lower = name.toLowerCase();
  if (lower.includes('rose')) return ['floral', 'sweet'];
  if (lower.includes('vanilla')) return ['vanilla', 'sweet'];
  if (lower.includes('citrus') || lower.includes('lemon') || lower.includes('orange')) return ['citrus', 'fresh'];
  if (lower.includes('wood') || lower.includes('oud')) return ['woody', 'oriental'];
  if (lower.includes('aqua') || lower.includes('water')) return ['aquatic', 'fresh'];
  if (lower.includes('spice') || lower.includes('spicy')) return ['spicy', 'woody'];
  if (lower.includes('fruity') || lower.includes('berry')) return ['fruity', 'sweet'];
  if (lower.includes('floral')) return ['floral', 'fresh'];
  if (lower.includes('tobacco')) return ['tobacco', 'spicy'];
  if (lower.includes('gourmand') || lower.includes('chocolate')) return ['gourmand', 'sweet'];
  return ['premium', 'aromatic'];
}

function inferBestFor(name) {
  const lower = name.toLowerCase();
  if (lower.includes('day') || lower.includes('fresh') || lower.includes('aqua')) return ['daytime'];
  if (lower.includes('evening') || lower.includes('night') || lower.includes('seduct')) return ['evening'];
  if (lower.includes('special') || lower.includes('luxe') || lower.includes('exclusive')) return ['special'];
  return ['all'];
}

function getDefaultPrice(sizeMl, type) {
  const base = type === 'roll-on' ? 40 : 50;
  return Math.round(base * sizeMl * 0.8) || 100;
}

function toCleanArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(v => v.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[,\s;]+/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

// ----- Main migration -----
async function fixProducts() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const products = await Product.find({}).lean();
    console.log(`📦 Found ${products.length} products`);

    let updatedCount = 0;
    let duplicateRemoved = 0;

    // ---- Remove duplicates ----
    const skuMap = new Map();
    for (const p of products) {
      const key = p.sku;
      if (skuMap.has(key)) {
        const existing = skuMap.get(key);
        const score = (prod) => {
          let s = 0;
          const sizes = prod.sizes || [];
          if (sizes.some(sz => sz.sellingPrice > 0)) s += 10;
          if (prod.description && prod.description.trim()) s += 5;
          if (prod.notes && prod.notes.length) s += 3;
          if (prod.intensity) s += 2;
          if (prod.bestFor && prod.bestFor.length) s += 2;
          if (prod.isBestseller !== undefined) s += 1;
          return s;
        };
        const existingScore = score(existing);
        const currentScore = score(p);

        if (currentScore > existingScore) {
          await Product.deleteOne({ _id: existing._id });
          skuMap.set(key, p);
          duplicateRemoved++;
          console.log(`🗑️ Removed duplicate ${key} (old) – keeping ${p.name}`);
        } else {
          await Product.deleteOne({ _id: p._id });
          duplicateRemoved++;
          console.log(`🗑️ Removed duplicate ${key} (current) – keeping ${existing.name}`);
        }
      } else {
        skuMap.set(key, p);
      }
    }

    const cleanProducts = await Product.find({}).lean();
    console.log(`🧹 After duplicate cleanup: ${cleanProducts.length} products`);

    // ---- Fix each product ----
    for (const product of cleanProducts) {
      const updates = {};
      let changed = false;

      if (!product.description || product.description.trim() === '') {
        updates.description = generateDescription(product);
        changed = true;
      }

      const cleanNotes = toCleanArray(product.notes);
      if (cleanNotes.length === 0) {
        updates.notes = inferNotes(product.name);
        changed = true;
      } else if (JSON.stringify(cleanNotes) !== JSON.stringify(product.notes)) {
        updates.notes = cleanNotes;
        changed = true;
      }

      if (!product.intensity) {
        let intensity = 'medium';
        const lower = product.name.toLowerCase();
        if (lower.includes('light') || lower.includes('fresh') || lower.includes('aqua')) intensity = 'light';
        else if (lower.includes('strong') || lower.includes('intense') || lower.includes('oud') || lower.includes('tobacco')) intensity = 'strong';
        updates.intensity = intensity;
        changed = true;
      }

      const cleanBestFor = toCleanArray(product.bestFor);
      if (cleanBestFor.length === 0) {
        updates.bestFor = inferBestFor(product.name);
        changed = true;
      } else if (JSON.stringify(cleanBestFor) !== JSON.stringify(product.bestFor)) {
        updates.bestFor = cleanBestFor;
        changed = true;
      }

      if (product.isBestseller === undefined || product.isBestseller === null) {
        updates.isBestseller = false;
        changed = true;
      }

      // Fix sellingPrice for each size
      const sizes = product.sizes || [];
      if (sizes.length > 0) {
        const validPrices = sizes.filter(sz => sz.sellingPrice > 0);
        let avgPerMl = 0;
        if (validPrices.length > 0) {
          const totalCost = validPrices.reduce((sum, sz) => sum + sz.sellingPrice, 0);
          const totalMl = validPrices.reduce((sum, sz) => sum + sz.sizeMl, 0);
          avgPerMl = totalCost / totalMl;
        }

        const updatedSizes = sizes.map(sz => {
          const sizeObj = { ...sz };
          if (sizeObj.sellingPrice === undefined || sizeObj.sellingPrice === 0) {
            let newPrice;
            if (avgPerMl > 0) {
              newPrice = Math.round(avgPerMl * sizeObj.sizeMl);
            } else {
              newPrice = getDefaultPrice(sizeObj.sizeMl, product.type);
            }
            if (newPrice < 1) newPrice = 1;
            sizeObj.sellingPrice = newPrice;
          }
          return sizeObj;
        });

        const priceChanged = sizes.some((sz, idx) => sz.sellingPrice !== updatedSizes[idx].sellingPrice);
        if (priceChanged) {
          updates.sizes = updatedSizes;
          changed = true;
        }
      }

      if (changed) {
        await Product.updateOne({ _id: product._id }, { $set: updates });
        updatedCount++;
        console.log(`✅ Updated ${product.name} (${product.sku})`);
      } else {
        console.log(`⏭️ No changes needed for ${product.name}`);
      }
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`   ✅ Updated ${updatedCount} products`);
    console.log(`   🗑️ Removed ${duplicateRemoved} duplicate products`);

  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixProducts();