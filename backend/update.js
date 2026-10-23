
// update-purchase-supplier.js
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ---------- IMPORT MODEL ----------
const Purchase = require('./src/models/Purchase');

const MONGO_URI = process.env.MONGO_URI;
const SUPPLIER_NAME = 'Amanat Attar House';

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Fetch all purchase records
    const purchases = await Purchase.find({})
      .sort({ purchaseDate: 1 })
      .lean();

    console.log(`📊 Found ${purchases.length} purchase records.`);

    if (purchases.length === 0) {
      console.log('⚠️ No purchases found. Nothing to update.');
      return;
    }

    // ---------- BACKUP BEFORE UPDATE ----------
    const backupDir = path.join(__dirname, 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-');

    const backupFile = path.join(
      backupDir,
      `purchases-before-supplier-update-${timestamp}.json`
    );

    fs.writeFileSync(
      backupFile,
      JSON.stringify(purchases, null, 2),
      'utf8'
    );

    console.log(`💾 Backup saved: ${backupFile}`);

    // ---------- SHOW CURRENT SUPPLIER BREAKDOWN ----------
    const supplierCounts = {};

    for (const purchase of purchases) {
      const supplier = purchase.supplier || '(missing supplier)';
      supplierCounts[supplier] = (supplierCounts[supplier] || 0) + 1;
    }

    console.log('📋 Existing supplier breakdown:');
    console.table(
      Object.entries(supplierCounts).map(([supplier, count]) => ({
        supplier,
        count
      }))
    );

    // ---------- UPDATE ALL PURCHASES ----------
    const result = await Purchase.updateMany(
      {},
      {
        $set: {
          supplier: SUPPLIER_NAME
        }
      }
    );

    console.log(`🔎 Matched: ${result.matchedCount}`);
    console.log(`✏️ Modified: ${result.modifiedCount}`);

    // ---------- VERIFY ----------
    const remaining = await Purchase.countDocuments({
      supplier: { $ne: SUPPLIER_NAME }
    });

    const updatedCount = await Purchase.countDocuments({
      supplier: SUPPLIER_NAME
    });

    console.log('\n---------- VERIFICATION ----------');
    console.log(`✅ Purchases with target supplier: ${updatedCount}`);
    console.log(`⚠️ Purchases with another/missing supplier: ${remaining}`);

    if (remaining === 0) {
      console.log('✅ All purchase records have the correct supplier.');
    } else {
      console.warn('⚠️ Some purchase records still need checking.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

main();
