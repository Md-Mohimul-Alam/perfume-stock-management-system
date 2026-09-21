const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
require('dotenv').config();

// ---------- CONFIG ----------
// Try BACKEND_URL, then BASE_URL, then fallback to localhost
const BACKEND_URL = process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:5001/api';
// If BASE_URL is used (like https://example.com), ensure it ends with /api
const FINAL_URL = BACKEND_URL.endsWith('/api') ? BACKEND_URL : `${BACKEND_URL}/api`;

const TOKEN = process.env.JWT_TOKEN;
const CSV_PATH = process.argv[2];

if (!CSV_PATH) {
  console.error('❌ Please provide CSV file path: node sellUpload.js <path/to/file.csv>');
  process.exit(1);
}

if (!TOKEN) {
  console.warn('⚠️  JWT_TOKEN not set. If the endpoint requires auth, set it in .env or as env variable.');
}

console.log(`🌐 Using backend: ${FINAL_URL}`);

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

// ---------- Helper: fetch all existing invoice numbers ----------
async function fetchExistingInvoiceNumbers() {
  try {
    console.log('🔍 Fetching existing invoice numbers from database...');
    // Try dedicated endpoint first
    const response = await axios.get(`${FINAL_URL}/sales/invoices`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      timeout: 10000,
    });
    if (response.data && Array.isArray(response.data)) {
      return new Set(response.data);
    }
  } catch (error) {
    // Fallback: fetch all sales but only invoiceNo field
    console.warn('⚠️  /sales/invoices endpoint not found, falling back to fetching all sales...');
    try {
      const response = await axios.get(`${FINAL_URL}/sales?fields=invoiceNo&limit=10000`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 10000,
      });
      if (response.data && Array.isArray(response.data)) {
        const invoices = response.data.map(s => s.invoiceNo).filter(Boolean);
        return new Set(invoices);
      }
    } catch (fallbackError) {
      // Log the actual error so we know why it failed
      console.error('❌ Could not fetch existing invoices:');
      if (fallbackError.response) {
        console.error(`   Status: ${fallbackError.response.status}`);
        console.error(`   Data: ${JSON.stringify(fallbackError.response.data)}`);
      } else if (fallbackError.request) {
        console.error('   No response from server. Is the backend running?');
      } else {
        console.error(`   Error: ${fallbackError.message}`);
      }
      console.warn('⚠️  Proceeding without filtering duplicates. Duplicate invoices will be rejected by the server.');
      return new Set();
    }
  }
  return new Set();
}

// ---------- Main ----------
async function uploadSales() {
  console.log(`📄 Reading CSV: ${CSV_PATH}`);

  const existingInvoices = await fetchExistingInvoiceNumbers();
  console.log(`📋 Found ${existingInvoices.size} existing invoice numbers.`);

  const salesMap = new Map();
  const timestamp = Date.now();
  let skippedCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv({ separator: ',', mapHeaders: ({ header }) => header.trim() }))
      .on('data', (row) => {
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

        let invoice;
        if (invoiceCol) {
          invoice = String(row[invoiceCol]).trim();
          if (!invoice) invoice = `SALE-${timestamp}-${String(salesMap.size + 1).padStart(3, '0')}`;
        } else {
          invoice = `SALE-${timestamp}-${String(salesMap.size + 1).padStart(3, '0')}`;
        }

        // Skip if invoice already exists in database
        if (existingInvoices.has(invoice)) {
          skippedCount++;
          if (skippedCount <= 5) console.log(`⏭️  Skipping existing invoice: ${invoice}`);
          return;
        }

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
        if (skippedCount > 0) console.log(`⏭️  Skipped ${skippedCount} duplicate invoice(s).`);

        if (sales.length === 0) {
          console.log('❌ No new sales to upload.');
          resolve();
          return;
        }

        console.log(`✅ Found ${sales.length} new sales (${sales.reduce((sum, s) => sum + s.items.length, 0)} total items).`);

        const payload = { sales };

        try {
          const response = await axios.post(`${FINAL_URL}/sales/bulk`, payload, {
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
          // ********** IMPROVED ERROR LOGGING **********
          console.error('❌ Upload failed:');
          if (error.response) {
            // The request was made and the server responded with a status code outside 2xx
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
          } else if (error.request) {
            // The request was made but no response was received (ECONNREFUSED, timeout)
            console.error('   No response received from server.');
            console.error(`   Target URL: ${FINAL_URL}/sales/bulk`);
            console.error('   💡 Check if the backend server is running and reachable.');
          } else {
            // Something else happened
            console.error(`   Error: ${error.message}`);
          }
          console.error(`   Config URL: ${error.config?.url || 'unknown'}`);
          // ******************************************
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