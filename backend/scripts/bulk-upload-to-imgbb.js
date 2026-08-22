const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// ----- Try multiple paths for Transaction model -----
let Transaction;
const modelPaths = [
  path.join(__dirname, './src/models/Transaction'),   // ✅ Correct for backend/src/models
  path.join(__dirname, './models/Transaction'),       // fallback
  path.join(__dirname, './models/Transaction'),        // fallback
];
for (const p of modelPaths) {
  try {
    Transaction = require(p);
    console.log(`✅ Loaded Transaction from: ${p}`);
    break;
  } catch (e) {
    // try next
  }
}
if (!Transaction) {
  console.error('❌ Transaction model not found. Tried:', modelPaths);
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const existing = await Transaction.findOne({
      category: 'Investor Settlement',
      description: /Mami/i,
    });

    if (!existing) {
      await Transaction.create({
        type: 'cash_out',
        amount: 10600 + 246 + 127, // 10973
        category: 'Investor Settlement',
        reference: null,
        refModel: null,
        date: new Date(),
        description: 'Settlement for Mami (fixed cost)',
      });
      console.log('✅ Mami settlement recorded');
    } else {
      console.log('ℹ️ Mami settlement already exists');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

run();