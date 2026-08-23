const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
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

// Load all models to register schemas for population
const Purchase = loadModel('Purchase');
const RawMaterial = loadModel('RawMaterial');
const Bottle = loadModel('Bottle');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

// ----- Parse command line arguments -----
const args = process.argv.slice(2);
const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'purchases-export.csv';
const format = args.includes('--json') ? 'json' : 'csv';
const all = args.includes('--all'); // if set, export all purchases; default is to export only last 6 months? No, we'll export all.

// ----- Main -----
async function exportPurchases() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Build query – sort by purchaseDate descending
    const query = Purchase.find()
      .populate('items.item', 'name sku sizeMl type')
      .sort({ purchaseDate: -1 });

    const purchases = await query.lean();

    console.log(`📦 Found ${purchases.length} purchase records.`);

    if (purchases.length === 0) {
      console.log('No purchases found.');
      await mongoose.disconnect();
      return;
    }

    // ----- Build export data (flattened – one row per item) -----
    const rows = [];
    for (const p of purchases) {
      const invoice = p.invoiceNo;
      const supplier = p.supplier || '';
      const date = p.purchaseDate ? new Date(p.purchaseDate).toISOString().slice(0,10) : '';
      const totalAmount = p.totalAmount;
      const notes = p.notes || '';

      if (p.items && p.items.length > 0) {
        for (const item of p.items) {
          const itemType = item.itemType;
          const itemObj = item.item;
          let itemName = 'Unknown';
          let itemSku = '';
          let itemSize = '';
          if (itemObj) {
            if (itemType === 'RawMaterial') {
              itemName = itemObj.name || 'Unknown';
              itemSku = itemObj.sku || '';
            } else {
              itemName = `${itemObj.sizeMl || '?'}ml Bottle (${itemObj.type || 'N/A'})`;
              itemSize = itemObj.sizeMl || '';
            }
          }
          rows.push({
            invoiceNo: invoice,
            supplier: supplier,
            purchaseDate: date,
            totalAmount: totalAmount,
            itemType: itemType,
            itemName: itemName,
            itemSku: itemSku,
            itemSize: itemSize,
            quantity: item.quantity,
            costPerUnit: item.costPerUnit,
            totalCost: item.totalCost,
            notes: notes,
          });
        }
      } else {
        // No items – still include the purchase row
        rows.push({
          invoiceNo: invoice,
          supplier: supplier,
          purchaseDate: date,
          totalAmount: totalAmount,
          itemType: '',
          itemName: '',
          itemSku: '',
          itemSize: '',
          quantity: '',
          costPerUnit: '',
          totalCost: '',
          notes: notes,
        });
      }
    }

    // ----- Write output -----
    if (format === 'json') {
      fs.writeFileSync(outputFile, JSON.stringify(rows, null, 2));
      console.log(`✅ Data written to ${outputFile} (JSON)`);
    } else {
      // CSV
      const headers = [
        'Invoice', 'Supplier', 'Date', 'Total Amount (৳)',
        'Item Type', 'Item Name', 'Item SKU', 'Size (ml)',
        'Quantity', 'Cost/Unit (৳)', 'Total Cost (৳)', 'Notes'
      ];
      const csvLines = [headers.join(',')];
      for (const row of rows) {
        const line = headers.map(h => {
          const key = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          let val = row[key] !== undefined ? row[key] : '';
          if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',');
        csvLines.push(line);
      }
      fs.writeFileSync(outputFile, csvLines.join('\n'));
      console.log(`✅ Data written to ${outputFile} (CSV)`);
    }

    // Summary
    const totalSpent = rows.reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
    console.log(`📊 Grand total spent: ৳${totalSpent.toFixed(2)}`);
    console.log(`📋 Total item rows: ${rows.length}`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportPurchases();