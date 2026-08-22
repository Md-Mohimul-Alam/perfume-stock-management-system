const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ----- Helper: load model with fallback paths -----
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

// ----- Load RawMaterial model -----
let RawMaterial;
try {
  RawMaterial = loadModel('RawMaterial');
  console.log('✅ Loaded RawMaterial model');
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

// ----- Main export function -----
async function exportRawMaterials() {
  try {
    // Connection options to avoid long hangs
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Fail after 5 seconds if cannot connect
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Fetch all raw materials
    const materials = await RawMaterial.find({}).lean();
    console.log(`📦 Found ${materials.length} raw materials`);

    if (materials.length === 0) {
      console.log('⚠️ No raw materials found. Export skipped.');
      await mongoose.disconnect();
      return;
    }

    // Define CSV headers (summary view)
    const headers = [
      'id',
      'name',
      'sku',
      'currentStockMl',
      'avgCostPerMl',
      'purchaseCount',
      'createdAt',
      'updatedAt',
    ];

    // Build rows
    const rows = materials.map((m) => ({
      id: m._id.toString(),
      name: m.name || '',
      sku: m.sku || '',
      currentStockMl: m.currentStockMl ?? 0,
      avgCostPerMl: m.avgCostPerMl ?? 0,
      purchaseCount: (m.purchases || []).length,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : '',
      updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : '',
    }));

    // Escape CSV fields
    const escapeField = (field) => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.join(',');
    const rowLines = rows.map((row) =>
      headers.map((h) => escapeField(row[h])).join(',')
    );

    const csvContent = [headerLine, ...rowLines].join('\n');

    // Write to file with date stamp
    const date = new Date().toISOString().slice(0, 10);
    const filename = `raw-materials-export-${date}.csv`;
    const filepath = path.join(__dirname, filename);

    fs.writeFileSync(filepath, csvContent, 'utf8');
    console.log(`✅ Exported ${rows.length} materials to: ${filepath}`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    // Give a clearer suggestion for network timeouts
    if (error.message.includes('ETIMEOUT') || error.message.includes('queryTxt')) {
      console.error('🔍 This is a network timeout. Check your internet, IP whitelist, or try a VPN.');
    }
    process.exit(1);
  }
}

exportRawMaterials();