// fix-stock.js
// ------------------------------------------------------------
// One-off reconciliation script:
//   Sets specific raw materials' currentStockMl to match physical count
//
// Usage:
//   node fix-stock.js                    → dry run (only shows what WOULD change)
//   node fix-stock.js --apply            → actually applies the changes
//   node fix-stock.js --apply --file=./fixes.json   → use custom fixes file
// ------------------------------------------------------------

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ----- Locate RawMaterial model -----
let RawMaterial;
const possiblePaths = [
  './models/RawMaterial',
  './src/models/RawMaterial',
  '../models/RawMaterial',
  '../src/models/RawMaterial',
];
for (const p of possiblePaths) {
  try {
    RawMaterial = require(p);
    console.log(`✅ Loaded RawMaterial from ${p}`);
    break;
  } catch (e) { /* keep trying */ }
}
if (!RawMaterial) {
  console.error('❌ Could not find RawMaterial model. Adjust the require path.');
  process.exit(1);
}

// ----- Connect -----
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

// ----- CLI flags -----
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FILE_ARG = args.find(a => a.startsWith('--file='));
const CUSTOM_FILE = FILE_ARG ? FILE_ARG.split('=')[1] : null;

// ----- Fixes to apply -----
// Edit this list OR pass a JSON file via --file=
const DEFAULT_FIXES = [
  // { sku: 'DunIco', currentStockMl: 27,  isStockOut: false, notes: 'Physical recount' },
  // { sku: 'DipTam', currentStockMl: 7.5, isStockOut: false, notes: 'Physical recount' },
  // { sku: 'CreAve', currentStockMl: 14,  isStockOut: false, notes: 'Physical recount' },
  // { sku: 'GucFla', currentStockMl: 0,   isStockOut: true,  notes: 'Physical recount – 0 left' },
];

// 👇 Put your real fixes here (uncomment and edit)
const FIXES = [
  { sku: 'DunIco', currentStockMl: 27,  isStockOut: false, notes: 'Physical recount – 27ml' },
  { sku: 'DipTam', currentStockMl: 7.5, isStockOut: false, notes: 'Physical recount – 7.5ml' },
  { sku: 'CreAve', currentStockMl: 14,  isStockOut: false, notes: 'Physical recount – 14ml' },
  { sku: 'GucFla', currentStockMl: 0,   isStockOut: true,  notes: 'Physical recount – 0ml' },
];

// ----- Load fixes (from file if given, else defaults) -----
function loadFixes() {
  if (CUSTOM_FILE) {
    const full = path.resolve(CUSTOM_FILE);
    if (!fs.existsSync(full)) {
      console.error(`❌ File not found: ${full}`);
      process.exit(1);
    }
    const raw = fs.readFileSync(full, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error('❌ Fix file must contain a JSON array.');
      process.exit(1);
    }
    console.log(`📄 Loaded ${parsed.length} fixes from ${full}`);
    return parsed;
  }
  return FIXES;
}

// ----- Validate one fix entry -----
function validateFix(fix, idx) {
  const problems = [];
  if (!fix.sku) problems.push('missing sku');
  if (fix.currentStockMl === undefined || fix.currentStockMl === null || isNaN(fix.currentStockMl)) {
    problems.push('missing/invalid currentStockMl');
  } else if (fix.currentStockMl < 0) {
    problems.push('currentStockMl must be >= 0');
  }
  return problems;
}

// ----- Pretty-print a diff line -----
function formatDelta(oldVal, newVal) {
  const delta = newVal - oldVal;
  const sign = delta > 0 ? '+' : '';
  return `${oldVal} → ${newVal} (${sign}${delta.toFixed(2)})`;
}

// ----- Main -----
(async () => {
  const fixes = loadFixes();

  if (!fixes.length) {
    console.error('❌ No fixes provided. Edit the FIXES array or pass --file=fixes.json');
    process.exit(1);
  }

  console.log(`\n${APPLY ? '🔧 APPLY MODE' : '🔍 DRY RUN'} — ${fixes.length} fix(es) queued\n`);

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const report = [];
  let appliedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < fixes.length; i++) {
    const fix = fixes[i];

    // Validate
    const problems = validateFix(fix, i);
    if (problems.length) {
      console.log(`❌ Row ${i + 1}: ${problems.join('; ')} — SKIPPED`);
      report.push({ sku: fix.sku, status: 'invalid', problems });
      errorCount++;
      continue;
    }

    // Find material
    const mat = await RawMaterial.findOne({ sku: fix.sku });
    if (!mat) {
      console.log(`❌ "${fix.sku}" — material not found`);
      report.push({ sku: fix.sku, status: 'not-found' });
      errorCount++;
      continue;
    }

    const oldStock = mat.currentStockMl || 0;
    const oldStockOut = mat.isStockOut || false;
    const newStock = fix.currentStockMl;
    const newStockOut = fix.isStockOut !== undefined ? fix.isStockOut : (newStock === 0);

    const stockChanged = Math.abs(oldStock - newStock) > 0.0001;
    const stockOutChanged = oldStockOut !== newStockOut;

    if (!stockChanged && !stockOutChanged) {
      console.log(`⏭  ${mat.name} (${mat.sku}) — no change needed`);
      report.push({ sku: mat.sku, status: 'no-change' });
      skippedCount++;
      continue;
    }

    console.log(`📝 ${mat.name} (${mat.sku})`);
    if (stockChanged) {
      console.log(`     Stock:      ${formatDelta(oldStock, newStock)} ml`);
    }
    if (stockOutChanged) {
      console.log(`     isStockOut: ${oldStockOut} → ${newStockOut}`);
    }
    if (fix.notes) console.log(`     Notes:      ${fix.notes}`);

    if (APPLY) {
      mat.currentStockMl = newStock;
      mat.isStockOut = newStockOut;
      await mat.save();
      console.log(`     ✅ Saved\n`);
      appliedCount++;
      report.push({
        sku: mat.sku,
        name: mat.name,
        status: 'applied',
        oldStock,
        newStock,
        oldStockOut,
        newStockOut,
      });
    } else {
      console.log(`     (dry run — pass --apply to save)\n`);
      report.push({
        sku: mat.sku,
        name: mat.name,
        status: 'would-apply',
        oldStock,
        newStock,
        oldStockOut,
        newStockOut,
      });
    }
  }

  // ----- Write report -----
  const outputDir = './exports';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(outputDir, `stock-fix_${timestamp}.json`);
  fs.writeFileSync(reportFile, JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    timestamp: new Date().toISOString(),
    totalFixes: fixes.length,
    appliedCount,
    skippedCount,
    errorCount,
    report,
  }, null, 2));
  console.log(`📄 Report saved: ${reportFile}`);

  // ----- Summary -----
  console.log('\n───────────── SUMMARY ─────────────');
  console.log(`Total fixes:   ${fixes.length}`);
  console.log(`Applied:       ${appliedCount}`);
  console.log(`Skipped:       ${skippedCount}`);
  console.log(`Errors:        ${errorCount}`);
  console.log(`Mode:          ${APPLY ? 'APPLY (saved)' : 'DRY RUN (nothing saved)'}`);
  console.log('───────────────────────────────────\n');

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
  process.exit(0);
})().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});