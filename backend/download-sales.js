// download-sales.js – Export all sales data to CSV/JSON
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ---------- IMPORT ALL MODELS (to register them) ----------
// This ensures Mongoose knows about the Product model before populating.
const Sale = require('./src/models/Sale');
const Product = require('./src/models/Product'); // <-- Fix: register Product model

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const format = args[0] || 'csv'; // 'csv' or 'json'
const outputDir = args[1] || './exports';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create timestamp for filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const baseFileName = `sales_${timestamp}`;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Fetch all sales with populated product data
    const sales = await Sale.find()
      .populate('items.product', 'name sku type')
      .sort({ saleDate: -1 });

    console.log(`📊 Found ${sales.length} sales records.`);

    if (sales.length === 0) {
      console.log('⚠️ No sales found. Export cancelled.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Transform data for export
    const exportData = sales.map(sale => {
      const itemsSummary = sale.items.map(item => {
        const product = item.product || {};
        return {
          productName: product.name || 'Unknown',
          productSKU: product.sku || 'Unknown',
          sizeMl: item.sizeMl,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          productType: product.type || 'N/A',
        };
      });

      return {
        invoiceNo: sale.invoiceNo,
        channel: sale.channel,
        saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString().split('T')[0] : '',
        totalAmount: sale.totalAmount,
        paymentStatus: sale.paymentStatus,
        notes: sale.notes || '',
        createdAt: sale.createdAt ? new Date(sale.createdAt).toISOString() : '',
        items: itemsSummary,
        itemCount: sale.items.length,
        totalQuantity: sale.items.reduce((sum, item) => sum + (item.quantity || 0), 0),
      };
    });

    // ----- Export as JSON -----
    const jsonFile = path.join(outputDir, `${baseFileName}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(exportData, null, 2));
    console.log(`✅ JSON exported: ${jsonFile}`);

    // ----- Export as CSV -----
    if (format === 'csv') {
      const flatData = exportData.map(row => ({
        invoiceNo: row.invoiceNo,
        channel: row.channel,
        saleDate: row.saleDate,
        totalAmount: row.totalAmount,
        paymentStatus: row.paymentStatus,
        notes: row.notes,
        createdAt: row.createdAt,
        itemCount: row.itemCount,
        totalQuantity: row.totalQuantity,
        items: JSON.stringify(row.items),
      }));

      if (flatData.length === 0) {
        console.log('⚠️ No data to export as CSV');
      } else {
        const csvHeaders = Object.keys(flatData[0]);
        const csvRows = [];
        csvRows.push(csvHeaders.join(','));

        for (const row of flatData) {
          const values = csvHeaders.map(header => {
            let val = row[header];
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
              val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          });
          csvRows.push(values.join(','));
        }

        const csvFile = path.join(outputDir, `${baseFileName}.csv`);
        fs.writeFileSync(csvFile, csvRows.join('\n'));
        console.log(`✅ CSV exported: ${csvFile}`);
      }
    }

    // ----- Summary report -----
    const summaryFile = path.join(outputDir, `${baseFileName}_summary.json`);
    const summary = {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
      totalItems: sales.reduce((sum, s) => sum + s.items.reduce((iSum, item) => iSum + (item.quantity || 0), 0), 0),
      totalPaid: sales.filter(s => s.paymentStatus === 'paid').length,
      totalDue: sales.filter(s => s.paymentStatus === 'due').length,
      channels: {},
      dateRange: {
        from: sales.length ? new Date(sales[sales.length - 1].saleDate).toISOString().split('T')[0] : '',
        to: sales.length ? new Date(sales[0].saleDate).toISOString().split('T')[0] : '',
      },
    };

    sales.forEach(s => {
      const ch = s.channel || 'Unknown';
      summary.channels[ch] = (summary.channels[ch] || 0) + 1;
    });

    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`✅ Summary exported: ${summaryFile}`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    console.log(`\n📁 All files saved in: ${outputDir}/`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });