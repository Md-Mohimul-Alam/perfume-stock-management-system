const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const Sale = require('../src/models/Sale');
const Product = require('../src/models/Product');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

// ---------- Command-line args ----------
const args = process.argv.slice(2);
const startDate = args.find(a => a.startsWith('--start='))?.split('=')[1];
const endDate = args.find(a => a.startsWith('--end='))?.split('=')[1];
const channel = args.find(a => a.startsWith('--channel='))?.split('=')[1];
const outputFile = args.find(a => a.startsWith('--output='))?.split('=')[1] || `sales-export-${new Date().toISOString().split('T')[0]}.csv`;

console.log(`📅 Start Date: ${startDate || 'All'}`);
console.log(`📅 End Date: ${endDate || 'All'}`);
console.log(`📢 Channel: ${channel || 'All'}`);
console.log(`💾 Output file: ${outputFile}`);

// ---------- Helper to escape CSV fields ----------
function escapeCSV(value) {
  if (value == null) return '';
  const str = String(value);
  // If contains comma, newline, or double-quote, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---------- Main export ----------
async function exportSales() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Build filter
    const filter = {};
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }
    if (channel) filter.channel = channel;

    // Fetch sales with populated product data
    const sales = await Sale.find(filter)
      .populate('items.product', 'name sku type')
      .sort({ saleDate: -1 });

    console.log(`📦 Found ${sales.length} sales`);

    if (sales.length === 0) {
      console.log('⚠️ No sales match the filter. Exiting.');
      process.exit(0);
    }

    // ----- Build CSV rows -----
    const headers = [
      'Invoice No',
      'Date',
      'Channel',
      'Product Name',
      'SKU',
      'Type',
      'Size (ml)',
      'Quantity',
      'Unit Price (৳)',
      'Total (৳)',
      'Payment Status',
      'Notes'
    ];

    const rows = [headers.join(',')];

    for (const sale of sales) {
      const invoice = sale.invoiceNo || '';
      const saleDate = sale.saleDate ? new Date(sale.saleDate).toISOString().split('T')[0] : '';
      const channelVal = sale.channel || '';
      const paymentStatus = sale.paymentStatus || '';
      const notes = escapeCSV(sale.notes || '');

      if (sale.items && sale.items.length) {
        for (const item of sale.items) {
          const product = item.product || {};
          const productName = escapeCSV(product.name || '');
          const sku = escapeCSV(product.sku || '');
          const type = product.type || '';
          const size = item.sizeMl || '';
          const qty = item.quantity || 0;
          const unitPrice = item.unitPrice || 0;
          const total = (qty * unitPrice) || 0;

          const row = [
            escapeCSV(invoice),
            escapeCSV(saleDate),
            escapeCSV(channelVal),
            productName,
            sku,
            type,
            size,
            qty,
            unitPrice.toFixed(2),
            total.toFixed(2),
            escapeCSV(paymentStatus),
            notes
          ];
          rows.push(row.join(','));
        }
      } else {
        // Fallback if no items (shouldn't happen)
        const row = [
          escapeCSV(invoice),
          escapeCSV(saleDate),
          escapeCSV(channelVal),
          '',
          '',
          '',
          '',
          0,
          0,
          0,
          escapeCSV(paymentStatus),
          notes
        ];
        rows.push(row.join(','));
      }
    }

    // Write CSV to file
    const csvContent = rows.join('\n');
    const outputPath = path.resolve(__dirname, outputFile);
    fs.writeFileSync(outputPath, csvContent, 'utf8');

    console.log(`✅ CSV exported successfully to: ${outputPath}`);
    console.log(`📊 Total rows: ${rows.length - 1} (excluding header)`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportSales();