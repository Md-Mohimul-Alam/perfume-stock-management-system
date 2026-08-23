const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// ----- Helper: load model -----
function loadModel(modelName) {
  const paths = [
    path.join(__dirname, 'src/models', modelName),
    path.join(__dirname, 'models', modelName),
    path.join(__dirname, '../src/models', modelName),
  ];
  for (const p of paths) {
    try {
      return require(p);
    } catch (e) {}
  }
  throw new Error(`Cannot find model "${modelName}"`);
}

// ----- Load models -----
let Sale;
try {
  Sale = loadModel('Sale');
  console.log('✅ Loaded Sale model');
} catch (err) {
  console.error('❌ Failed to load model:', err.message);
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

function maskUri(uri) {
  try {
    const url = new URL(uri);
    if (url.password) url.password = '****';
    return url.toString();
  } catch { return uri; }
}
console.log(`🔗 Connecting to: ${maskUri(MONGO_URI)}`);

// ----- Main -----
async function reindexInvoices() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // 1. Fetch all sales, sorted by saleDate (oldest first)
    const sales = await Sale.find({}).sort({ saleDate: 1 }).lean();
    if (!sales.length) {
      console.log('ℹ️ No sales found.');
      await mongoose.disconnect();
      return;
    }

    console.log(`📋 Found ${sales.length} sales.`);

    // 2. Preview the first 5 before renumbering
    console.log('🔍 Preview (first 5 by date):');
    sales.slice(0, 5).forEach((s, i) => {
      console.log(`   ${i+1}. ${s.invoiceNo} (${s.saleDate.toISOString().slice(0,10)})`);
    });
    if (sales.length > 5) console.log(`   ... and ${sales.length - 5} more.`);

    // 3. Confirm with user
    console.log(`\n⚠️ This will renumber ALL ${sales.length} invoices sequentially.`);
    console.log('   To confirm, type: yes');
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise((resolve) => {
      readline.question('   Confirm? ', resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled.');
      await mongoose.disconnect();
      return;
    }

    // 4. Perform renumbering (without transaction to avoid performance hit)
    let updated = 0;
    for (let i = 0; i < sales.length; i++) {
      const newInvoice = `INV-${String(i + 1).padStart(4, '0')}`;
      const result = await Sale.updateOne(
        { _id: sales[i]._id },
        { $set: { invoiceNo: newInvoice } }
      );
      if (result.modifiedCount > 0) updated++;
      if ((i + 1) % 100 === 0) console.log(`   Progress: ${i + 1}/${sales.length}`);
    }

    console.log(`✅ Successfully updated ${updated} sales.`);
    console.log(`📌 Last invoice number is now INV-${String(sales.length).padStart(4, '0')}`);
    console.log('🎉 Reindex complete. Next new sale will use INV-', String(sales.length + 1).padStart(4, '0'));

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

reindexInvoices();