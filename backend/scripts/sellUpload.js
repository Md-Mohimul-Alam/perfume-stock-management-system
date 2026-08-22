const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
require('dotenv').config();

// ---------- CONFIG ----------
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001/api';
const TOKEN = process.env.JWT_TOKEN; // Get this from login response
const CSV_PATH = process.argv[2];

if (!CSV_PATH) {
  console.error('❌ Please provide CSV file path: node scripts/upload-sales.js <path/to/file.csv>');
  process.exit(1);
}

if (!TOKEN) {
  console.warn('⚠️  JWT_TOKEN not set. If the endpoint requires auth, set it in .env or as env variable.');
}

// ---------- Flexible column finder ----------
const findColumn = (obj, possibleNames) => {
  const keys = Object.keys(obj);
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = keys.find(k => {
      const normalizedKey = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedKey === normalizedName ||
             normalizedKey.includes(normalizedName) ||
             normalizedName.includes(normalizedKey);
    });
    if (found) return found;
  }
  return null;
};

// ---------- Main ----------
async function uploadSales() {
  const salesMap = new Map();
  const timestamp = Date.now();

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv({ separator: ',', mapHeaders: ({ header }) => header.trim() }))
      .on('data', (row) => {
        // Detect columns
        const skuCol = findColumn(row, ['sku', 'sku code', 'product sku']);
        const sizeCol = findColumn(row, ['size', 'sizeml', 'ml', 'size ml']);
        const priceCol = findColumn(row, ['unitprice', 'unit price', 'price', 'selling price', 'rate', 'unit price (৳)']);
        const totalCol = findColumn(row, ['total', 'total price', 'total amount', 'amount', 'total (৳)']);
        const invoiceCol = findColumn(row, ['invoice', 'invoice no', 'invoiceno', 'invoice number']);
        const qtyCol = findColumn(row, ['quantity', 'qty', 'units']);
        const channelCol = findColumn(row, ['channel', 'sales channel', 'fair', 'store']);
        const dateCol = findColumn(row, ['saledate', 'sale date', 'date', 'transaction date']);
        const paymentCol = findColumn(row, ['paymentstatus', 'payment status', 'status']);
        const notesCol = findColumn(row, ['notes', 'note', 'remarks', 'comment']);

        if (!skuCol || !sizeCol || (!priceCol && !totalCol)) {
          console.warn('⚠️  Skipping row: missing SKU, Size, or Price/Total', row);
          return;
        }

        const sku = String(row[skuCol]).trim();
        const sizeMl = parseFloat(row[sizeCol]);
        const quantity = qtyCol ? parseInt(row[qtyCol]) || 1 : 1;

        // Determine unit price – either from Price column or derived from Total
        let unitPrice = NaN;
        if (priceCol) {
          unitPrice = parseFloat(row[priceCol]);
        }
        if ((isNaN(unitPrice) || unitPrice <= 0) && totalCol) {
          const totalVal = parseFloat(row[totalCol]);
          if (!isNaN(totalVal) && quantity > 0) {
            unitPrice = totalVal / quantity;
          }
        }
        if (isNaN(unitPrice) || unitPrice <= 0) {
          console.warn('⚠️  Skipping row: invalid unit price', row);
          return;
        }

        const channel = channelCol ? String(row[channelCol]).trim() : 'Other';
        const saleDate = dateCol ? row[dateCol] : '';
        const paymentStatus = paymentCol ? String(row[paymentCol]).toLowerCase().trim() : 'paid';
        const notes = notesCol ? String(row[notesCol]).trim() : '';

        // Determine invoice number
        let invoice;
        if (invoiceCol) {
          invoice = String(row[invoiceCol]).trim();
          if (!invoice) invoice = `SALE-${timestamp}-${String(salesMap.size + 1).padStart(3, '0')}`;
        } else {
          invoice = `SALE-${timestamp}-${String(salesMap.size + 1).padStart(3, '0')}`;
        }

        // Group by invoice
        if (!salesMap.has(invoice)) {
          salesMap.set(invoice, {
            invoiceNo: invoice,
            channel: channel || 'Other',
            saleDate: saleDate || '',
            paymentStatus: paymentStatus || 'paid',
            items: [],
            notes: notes || '',
          });
        }
        const sale = salesMap.get(invoice);
        sale.items.push({ sku, sizeMl, quantity, unitPrice });
      })
      .on('end', async () => {
        const sales = Array.from(salesMap.values()).filter(s => s.items.length > 0);
        if (sales.length === 0) {
          console.log('❌ No valid rows found.');
          resolve();
          return;
        }

        console.log(`✅ Found ${sales.length} sales (${sales.reduce((sum, s) => sum + s.items.length, 0)} total items).`);

        const payload = { sales };

        try {
          const response = await axios.post(`${BACKEND_URL}/sales/bulk`, payload, {
            headers: {
              'Content-Type': 'application/json',
              ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
            },
          });
          console.log('✅ Upload successful!');
          console.log(`   Created ${response.data.created?.length || 0} sales.`);
          if (response.data.errors?.length) {
            console.log(`   Errors: ${response.data.errors.length}`);
            response.data.errors.forEach((err, i) => {
              console.log(`   ${i+1}. ${err.error} ${err.saleData ? JSON.stringify(err.saleData) : ''}`);
            });
          }
        } catch (error) {
          console.error('❌ Upload failed:', error.response?.data?.message || error.message);
          if (error.response?.data?.errors) {
            console.error('Details:', error.response.data.errors);
          }
        }
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ Error reading CSV:', err);
        reject(err);
      });
  });
}

uploadSales();