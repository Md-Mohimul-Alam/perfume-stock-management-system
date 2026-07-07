const mongoose = require('mongoose');
require('dotenv').config();
const Sale = require('../src/models/Sale');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Find all sales with invoice starting with "SALE-"
    const sales = await Sale.find({ invoiceNo: /^SALE-/i }).sort({ createdAt: 1 });

    console.log(`📊 Found ${sales.length} sales with old invoice format.`);

    let updated = 0;
    for (const sale of sales) {
      const oldInvoice = sale.invoiceNo;
      // Extract number after "SALE-"
      const match = oldInvoice.match(/^SALE-(\d+)$/i);
      if (!match) {
        console.warn(`⚠️ Skipping unexpected format: ${oldInvoice}`);
        continue;
      }
      const num = parseInt(match[1], 10);
      // Pad to 4 digits (e.g., 1 → 0001, 508 → 0508)
      const newInvoice = `INV-${String(num).padStart(4, '0')}`;

      // Update only if different
      if (oldInvoice !== newInvoice) {
        sale.invoiceNo = newInvoice;
        await sale.save();
        updated++;
        console.log(`✅ ${oldInvoice} → ${newInvoice}`);
      }
    }

    console.log(`\n🎉 Migration complete. Updated ${updated} invoices.`);
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });