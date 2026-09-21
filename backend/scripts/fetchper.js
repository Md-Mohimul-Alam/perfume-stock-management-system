const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ----- Load only Purchase model -----
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

const Purchase = loadModel('Purchase');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || null;

async function fetchAllPurchases() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Fetch purchases without populating (lean for plain objects)
    const purchases = await Purchase.find().lean().sort({ purchaseDate: -1 });

    console.log(`📦 Found ${purchases.length} purchase records.`);

    if (purchases.length === 0) {
      console.log('No purchases found.');
      await mongoose.disconnect();
      return;
    }

    // Prepare data
    const data = purchases.map(p => ({
      invoiceNo: p.invoiceNo,
      supplier: p.supplier || '',
      totalAmount: p.totalAmount,
      purchaseDate: p.purchaseDate,
      notes: p.notes || '',
      items: p.items.map(item => ({
        type: item.itemType,
        itemId: item.item,          // ObjectId (no population)
        quantity: item.quantity,
        costPerUnit: item.costPerUnit,
        totalCost: item.totalCost,
      })),
      itemCount: p.items.length,
    }));

    // ----- Output to console -----
    console.log('\n📋 Purchase Summary:');
    data.forEach((p, index) => {
      console.log(`\n${index+1}. Invoice: ${p.invoiceNo}`);
      console.log(`   Supplier: ${p.supplier}`);
      console.log(`   Date: ${p.purchaseDate.toISOString().slice(0,10)}`);
      console.log(`   Total Amount: ৳${p.totalAmount.toFixed(2)}`);
      console.log(`   Items (${p.itemCount}):`);
      p.items.forEach(item => {
        console.log(`     - ${item.type} (ID: ${item.itemId}) × ${item.quantity} @ ৳${item.costPerUnit} = ৳${item.totalCost}`);
      });
      if (p.notes) console.log(`   Notes: ${p.notes}`);
    });

    const totalSpent = data.reduce((sum, p) => sum + p.totalAmount, 0);
    console.log(`\n📊 Grand Total Spent: ৳${totalSpent.toFixed(2)}`);

    // ----- Optionally export to CSV (still without population) -----
    if (outputFile) {
      const headers = ['Invoice', 'Supplier', 'Date', 'Total (৳)', 'Item Type', 'Item ID', 'Quantity', 'Cost/Unit', 'Total Cost'];
      const rows = [headers.join(',')];
      for (const p of data) {
        if (p.items.length === 0) {
          rows.push([p.invoiceNo, p.supplier, p.purchaseDate.toISOString().slice(0,10), p.totalAmount, '', '', '', '', ''].join(','));
        } else {
          for (const item of p.items) {
            rows.push([
              p.invoiceNo,
              p.supplier,
              p.purchaseDate.toISOString().slice(0,10),
              p.totalAmount,
              item.type,
              item.itemId,
              item.quantity,
              item.costPerUnit,
              item.totalCost,
            ].join(','));
          }
        }
      }
      fs.writeFileSync(outputFile, rows.join('\n'));
      console.log(`✅ Data written to ${outputFile} (CSV)`);
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchAllPurchases();