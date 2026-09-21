const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

// ---------- Helper: load model ----------
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

// ---------- Load Sale model ----------
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

// ---------- Parse arguments robustly ----------
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { oldDate: null, newDate: null, csvPath: null, dryRun: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // Handle --key=value
    if (arg.startsWith('--')) {
      const parts = arg.split('=');
      const key = parts[0];
      const value = parts[1] || '';
      if (key === '--old' && value) {
        result.oldDate = value;
      } else if (key === '--new' && value) {
        result.newDate = value;
      } else if (key === '--csv' && value) {
        result.csvPath = value;
      } else if (key === '--dryRun') {
        result.dryRun = true;
      } else if (key === '--help') {
        result.help = true;
      } else {
        // maybe it's a flag without value
        if (arg === '--dryRun') result.dryRun = true;
        if (arg === '--help') result.help = true;
      }
    } else {
      // positional? not used.
      // if the next arg is a value for previous --old/--new, we handle below
      // but we already handled with =, so we can ignore
    }
  }

  // Also handle the case where --old and --new are separate (space-separated)
  // If oldDate is not set, try to find by scanning for --old followed by value
  if (!result.oldDate || !result.newDate) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--old' && i + 1 < args.length) {
        result.oldDate = args[i + 1];
        i++;
      } else if (arg === '--new' && i + 1 < args.length) {
        result.newDate = args[i + 1];
        i++;
      } else if (arg === '--csv' && i + 1 < args.length) {
        result.csvPath = args[i + 1];
        i++;
      }
    }
  }

  return result;
}

const parsed = parseArgs();
const { oldDate, newDate, csvPath, dryRun, help } = parsed;

if (help) {
  console.log(`
Usage:
  node date.js --old="YYYY-MM-DD" --new="YYYY-MM-DD" [--dryRun]
  node date.js --csv="path/to/dates.csv" [--dryRun]

Examples:
  # Update all sales dated 2026-06-27 to 2026-08-22
  node date.js --old="2026-06-27" --new="2026-08-22"

  # Update specific invoices from a CSV (invoiceNo,newSaleDate)
  node date.js --csv="./date-updates.csv"

  # Preview changes without saving
  node date.js --old="2026-06-27" --new="2026-08-22" --dryRun
  `);
  process.exit(0);
}

if (!csvPath && (!oldDate || !newDate)) {
  console.error('❌ Please provide either --old and --new, or --csv');
  console.log('Use --help for usage.');
  process.exit(1);
}

// ---------- Main ----------
async function updateSaleDates() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    if (dryRun) console.log('🔍 DRY RUN – no changes will be saved.');

    // ---------- Mode 1: CSV mapping ----------
    if (csvPath) {
      console.log(`📄 Reading CSV: ${csvPath}`);
      const updates = [];

      await new Promise((resolve, reject) => {
        fs.createReadStream(csvPath)
          .pipe(csv())
          .on('data', (row) => {
            const invoiceKey = Object.keys(row).find(k => /invoice/i.test(k));
            const dateKey = Object.keys(row).find(k => /date|saledate/i.test(k));
            if (invoiceKey && dateKey) {
              updates.push({ invoiceNo: row[invoiceKey].trim(), newDate: row[dateKey].trim() });
            } else {
              console.warn('⚠️ Skipping row – missing invoice or date column', row);
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      if (updates.length === 0) {
        console.log('❌ No valid rows found in CSV.');
        await mongoose.disconnect();
        return;
      }

      console.log(`📋 Found ${updates.length} invoice updates.`);

      let success = 0;
      let errors = 0;

      for (const { invoiceNo, newDate } of updates) {
        if (!invoiceNo || !newDate) continue;
        const parsedDate = new Date(newDate);
        if (isNaN(parsedDate.getTime())) {
          console.warn(`⚠️ Invalid date format for invoice ${invoiceNo}: "${newDate}"`);
          errors++;
          continue;
        }

        if (dryRun) {
          console.log(`🔍 Would update ${invoiceNo} to ${newDate}`);
          success++;
        } else {
          const result = await Sale.updateOne(
            { invoiceNo },
            { $set: { saleDate: parsedDate } }
          );
          if (result.modifiedCount > 0) {
            console.log(`✅ Updated ${invoiceNo} → ${newDate}`);
            success++;
          } else if (result.matchedCount > 0) {
            console.log(`ℹ️ ${invoiceNo} already has date ${newDate} – no change`);
            success++;
          } else {
            console.warn(`⚠️ Invoice ${invoiceNo} not found`);
            errors++;
          }
        }
      }

      console.log(`\n📊 CSV update complete. Success: ${success}, Errors: ${errors}`);
    }

    // ---------- Mode 2: Bulk date replace ----------
    else {
      const oldDateObj = new Date(oldDate);
      const newDateObj = new Date(newDate);
      if (isNaN(oldDateObj.getTime()) || isNaN(newDateObj.getTime())) {
        console.error('❌ Invalid date format. Use YYYY-MM-DD.');
        await mongoose.disconnect();
        process.exit(1);
      }

      const startOfDay = new Date(oldDateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(oldDateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const count = await Sale.countDocuments({
        saleDate: { $gte: startOfDay, $lte: endOfDay }
      });

      if (count === 0) {
        console.log(`ℹ️ No sales found with date ${oldDate}`);
        await mongoose.disconnect();
        return;
      }

      console.log(`📋 Found ${count} sales with date ${oldDate}`);

      if (dryRun) {
        console.log(`🔍 Would update ${count} sales to ${newDate}`);
        const preview = await Sale.find(
          { saleDate: { $gte: startOfDay, $lte: endOfDay } },
          'invoiceNo saleDate'
        ).limit(5).lean();
        console.log('   Preview:');
        preview.forEach(s => console.log(`   • ${s.invoiceNo} (${s.saleDate.toISOString().slice(0,10)})`));
        if (count > 5) console.log(`   ... and ${count - 5} more.`);
        await mongoose.disconnect();
        return;
      }

      console.log(`\n⚠️ This will update ${count} sales from ${oldDate} to ${newDate}.`);
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
        console.log('❌ Update cancelled.');
        await mongoose.disconnect();
        return;
      }

      const result = await Sale.updateMany(
        { saleDate: { $gte: startOfDay, $lte: endOfDay } },
        { $set: { saleDate: newDateObj } }
      );

      console.log(`✅ Updated ${result.modifiedCount} sales to ${newDate}`);
      if (result.matchedCount > result.modifiedCount) {
        console.log(`ℹ️ ${result.matchedCount - result.modifiedCount} were already set to this date.`);
      }
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateSaleDates();