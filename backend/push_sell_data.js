const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// ----- Helper: load models -----
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

let Sale, Product, RawMaterial, Bottle, Transaction, InventoryLog;
try {
  Sale = loadModel('Sale');
  Product = loadModel('Product');
  RawMaterial = loadModel('RawMaterial');
  Bottle = loadModel('Bottle');
  Transaction = loadModel('Transaction');
  InventoryLog = loadModel('InventoryLog');
  console.log('✅ Loaded all models');
} catch (err) {
  console.error('❌ Failed to load models:', err.message);
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

// ---------- First 200 rows ----------
const rows = [
  // Rows 1-10
  { invoiceNo: "INV-0551", date: "2026-08-21", channel: "Other", productName: "Ariana Grande thank you Spray", sku: "AG-Thnk_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "mohim" },
  { invoiceNo: "INV-0551", date: "2026-08-21", channel: "Other", productName: "Ariana Grande Cloud", sku: "AGC", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "due", notes: "Sydney" },
  { invoiceNo: "INV-0551", date: "2026-08-21", channel: "Other", productName: "Ariana Grande thank you", sku: "AG-Thnk", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "due", notes: "Sydney" },
  { invoiceNo: "INV-0551", date: "2026-08-21", channel: "Other", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "due", notes: "Sydney" },
  { invoiceNo: "INV-0551", date: "2026-08-21", channel: "Other", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "due", notes: "Sydney" },
  { invoiceNo: "INV-0551", date: "2026-08-21", channel: "Other", productName: "Burberry Her", sku: "BurH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "due", notes: "Sydney" },
  { invoiceNo: "INV-0550", date: "2026-08-21", channel: "Other", productName: "Baccarat rouge", sku: "BacRou", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "due", notes: "Sydney" },
  { invoiceNo: "INV-0549", date: "2026-08-21", channel: "Other", productName: "victoriya secret", sku: "VicSec", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "due", notes: "Sydney" },
  { invoiceNo: "INV-0549", date: "2026-08-20", channel: "Other", productName: "victoriya secret Spray", sku: "VicSec_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "due", notes: "" },
  { invoiceNo: "INV-0549", date: "2026-08-19", channel: "Fair7", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "multiple pucahse in one invoice" },
  { invoiceNo: "INV-0549", date: "2026-08-19", channel: "Fair7", productName: "Ariana Grande thank you", sku: "AG-Thnk", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "multiple pucahse in one invoice" },
  { invoiceNo: "INV-0549", date: "2026-08-19", channel: "Fair7", productName: "Sultan (al-haramain)", sku: "SUL", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "multiple pucahse in one invoice" },
  { invoiceNo: "INV-0549", date: "2026-08-19", channel: "Fair7", productName: "Black Orchid", sku: "BLOr", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "multiple pucahse in one invoice" },
  { invoiceNo: "INV-0549", date: "2026-08-19", channel: "Fair7", productName: "Burberry Her Spray", sku: "BurH_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 60, total: 60, paymentStatus: "paid", notes: "multiple pucahse in one invoice" },
  { invoiceNo: "INV-0548", date: "2026-08-19", channel: "Fair7", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 350, total: 350, paymentStatus: "paid", notes: "multiple pucahse in one invoice" },
  { invoiceNo: "INV-0547", date: "2026-08-19", channel: "Fair7", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0547", date: "2026-08-19", channel: "Fair7", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0547", date: "2026-08-19", channel: "Fair7", productName: "Armanis.w.y Spray", sku: "ArmWy_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 650, total: 650, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0547", date: "2026-08-19", channel: "Fair7", productName: "le male elixir Spray", sku: "LeME__SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 770, total: 770, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0546", date: "2026-08-18", channel: "Fair7", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0546", date: "2026-08-18", channel: "Fair7", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0545", date: "2026-08-18", channel: "Fair7", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0545", date: "2026-08-18", channel: "Fair7", productName: "Diptyque tam dao", sku: "DipTam", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0544", date: "2026-08-18", channel: "Fair7", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0543", date: "2026-08-18", channel: "Fair7", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0542", date: "2026-08-18", channel: "Fair7", productName: "Valentino", sku: "Valen", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 220, total: 220, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0541", date: "2026-08-18", channel: "Fair7", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0540", date: "2026-08-18", channel: "Fair7", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 280, total: 280, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0540", date: "2026-08-18", channel: "Fair7", productName: "Nautica voyage", sku: "NV", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 280, total: 280, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0539", date: "2026-08-18", channel: "Fair7", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 280, total: 280, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0539", date: "2026-08-17", channel: "Fair7", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0539", date: "2026-08-17", channel: "Fair7", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0538", date: "2026-08-17", channel: "Fair7", productName: "White Oud", sku: "WO", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0537", date: "2026-08-17", channel: "Fair7", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0536", date: "2026-08-17", channel: "Fair7", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0535", date: "2026-08-17", channel: "Fair7", productName: "Valentino", sku: "Valen", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 220, total: 220, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0533", date: "2026-08-16", channel: "Fair7", productName: "Ariana Grande thank you", sku: "AG-Thnk", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 210, total: 210, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0532", date: "2026-08-16", channel: "Fair7", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0531", date: "2026-08-16", channel: "Fair7", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0531", date: "2026-08-16", channel: "Fair7", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0530", date: "2026-08-16", channel: "Fair7", productName: "Fogg Spray", sku: "Fgg_SP", type: "spray", sizeMl: 6, quantity: 6, unitPrice: 250, total: 1500, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0529", date: "2026-08-16", channel: "Fair7", productName: "Fogg Spray", sku: "Fgg_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0528", date: "2026-08-11", channel: "Other", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 2, unitPrice: 170, total: 340, paymentStatus: "due", notes: "Azgor" },
  { invoiceNo: "INV-0527", date: "2026-08-10", channel: "Other", productName: "Nautica voyage Spray", sku: "NV_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "Atik" },
  { invoiceNo: "INV-0527", date: "2026-08-10", channel: "Other", productName: "SRK Spray", sku: "SR_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 350, total: 350, paymentStatus: "paid", notes: "Atik" },
  { invoiceNo: "INV-0526", date: "2026-08-10", channel: "Other", productName: "Armanis.w.y Spray", sku: "ArmWy_SP", type: "spray", sizeMl: 50, quantity: 1, unitPrice: 1350, total: 1350, paymentStatus: "paid", notes: "Anabil" },
  { invoiceNo: "INV-0525", date: "2026-08-08", channel: "Other", productName: "Black Orchid", sku: "BLOr", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "Rafin" },
  { invoiceNo: "INV-0524", date: "2026-08-07", channel: "Fair6", productName: "Burberry Her", sku: "BurH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0523", date: "2026-08-07", channel: "Other", productName: "Creed Aventus Spray", sku: "CreAve_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "Sajjad" },
  { invoiceNo: "INV-0522", date: "2026-08-07", channel: "Other", productName: "Nautica voyage Spray", sku: "NV_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "Sajjad" },
  { invoiceNo: "INV-0521", date: "2026-07-28", channel: "Other", productName: "Fantasy Spray", sku: "Fant_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "Anika" },
  { invoiceNo: "INV-0520", date: "2026-07-12", channel: "Other", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "Hridoy" },
  { invoiceNo: "INV-0519", date: "2026-07-12", channel: "Other", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "Hridoy frnd" },
  { invoiceNo: "INV-0518", date: "2026-07-11", channel: "Other", productName: "Ameer Al oud", sku: "AmeOud", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "owne" },
  { invoiceNo: "INV-0517", date: "2026-07-11", channel: "Other", productName: "White Oud", sku: "WO", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "paid", notes: "Mohim" },
  { invoiceNo: "INV-0516", date: "2026-07-09", channel: "Other", productName: "Burberry Her Spray", sku: "BurH_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "Nafees" },
  { invoiceNo: "INV-0515", date: "2026-07-09", channel: "Other", productName: "Luxe Special Spray", sku: "LUXE1_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "paid", notes: "Nafees" },
  { invoiceNo: "INV-0514", date: "2026-07-09", channel: "Other", productName: "LOST Cherry Spray", sku: "LostChe_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "Nafees" },
  { invoiceNo: "INV-0513", date: "2026-07-07", channel: "Other", productName: "Luxe Special Spray", sku: "LUXE1_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0512", date: "2026-07-07", channel: "Other", productName: "Luxe Special Spray", sku: "LUXE1_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0511", date: "2026-07-07", channel: "Other", productName: "Burberry Her Spray", sku: "BurH_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 260, total: 260, paymentStatus: "paid", notes: "ony" },
  { invoiceNo: "INV-0510", date: "2026-07-06", channel: "Other", productName: "Nautica voyage", sku: "NV", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "Nafees" },
  { invoiceNo: "INV-0509", date: "2026-07-06", channel: "Other", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "Nafees" },
  { invoiceNo: "INV-0508", date: "2026-06-27", channel: "December", productName: "Nautica voyage Spray", sku: "NV_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0507", date: "2026-06-27", channel: "December", productName: "Armanis.w.y Spray", sku: "ArmWy_SP", type: "spray", sizeMl: 30, quantity: 1, unitPrice: 1000, total: 1000, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0506", date: "2026-06-27", channel: "December", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0505", date: "2026-06-27", channel: "December", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 15, quantity: 1, unitPrice: 750, total: 750, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0504", date: "2026-06-27", channel: "December", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0503", date: "2026-06-27", channel: "December", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0502", date: "2026-06-27", channel: "December", productName: "Burberry Her", sku: "BurH", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0501", date: "2026-06-27", channel: "December", productName: "Creed Aventus", sku: "CreAve", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0500", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0499", date: "2026-06-27", channel: "December", productName: "SRK Spray", sku: "SR_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 950, total: 950, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0498", date: "2026-06-27", channel: "December", productName: "Creed absolute Spray", sku: "CreAbs_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 850, total: 850, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0497", date: "2026-06-27", channel: "December", productName: "Creed absolute Spray", sku: "CreAbs_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 850, total: 850, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0496", date: "2026-06-27", channel: "December", productName: "Davidoff Cool Water Spray", sku: "DavCoo_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 750, total: 750, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0495", date: "2026-06-27", channel: "December", productName: "Davidoff Cool Water Spray", sku: "DavCoo_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0494", date: "2026-06-27", channel: "December", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0493", date: "2026-06-27", channel: "December", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0492", date: "2026-06-27", channel: "December", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0491", date: "2026-06-27", channel: "December", productName: "White Oud", sku: "WO", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0490", date: "2026-06-27", channel: "December", productName: "Paris Hilton", sku: "ParHil", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 220, total: 220, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0489", date: "2026-06-27", channel: "December", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 220, total: 220, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0488", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0487", date: "2026-06-27", channel: "December", productName: "Ahsas al Arabia", sku: "AhsAra", type: "roll-on", sizeMl: 15, quantity: 1, unitPrice: 360, total: 360, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0486", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0485", date: "2026-06-27", channel: "December", productName: "CK-1 Spray", sku: "CK1_SP", type: "spray", sizeMl: 30, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0484", date: "2026-06-27", channel: "December", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 30, quantity: 1, unitPrice: 350, total: 350, paymentStatus: "due", notes: "" },
  { invoiceNo: "INV-0483", date: "2026-06-27", channel: "December", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0482", date: "2026-06-27", channel: "December", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0481", date: "2026-06-27", channel: "December", productName: "Chocolate", sku: "CoCo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0480", date: "2026-06-27", channel: "December", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0479", date: "2026-06-27", channel: "December", productName: "Ahsas al Arabia", sku: "AhsAra", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0478", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0477", date: "2026-06-27", channel: "December", productName: "Hawas For Him", sku: "HFH", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0476", date: "2026-06-27", channel: "December", productName: "Hawas For Him", sku: "HFH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0475", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0474", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0473", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0472", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0471", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0470", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0469", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0468", date: "2026-06-27", channel: "December", productName: "Hawas For Him Spray", sku: "HFH_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0467", date: "2026-06-27", channel: "December", productName: "Armanis.w.y Spray", sku: "ArmWy_SP", type: "spray", sizeMl: 50, quantity: 1, unitPrice: 1120, total: 1120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0466", date: "2026-06-27", channel: "December", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0465", date: "2026-06-27", channel: "December", productName: "Hawas For Him", sku: "HFH", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0464", date: "2026-06-27", channel: "December", productName: "Gucci Flora Spray", sku: "GucFla_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0463", date: "2026-06-27", channel: "December", productName: "Good Girl Spray", sku: "GooGir_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 280, total: 280, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0462", date: "2026-06-27", channel: "December", productName: "LOST Cherry Spray", sku: "LostChe_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 280, total: 280, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0461", date: "2026-06-27", channel: "December", productName: "Hawas For Him", sku: "HFH", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 310, total: 310, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0460", date: "2026-06-27", channel: "December", productName: "SRK Spray", sku: "SR_SP", type: "spray", sizeMl: 50, quantity: 1, unitPrice: 1500, total: 1500, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0459", date: "2026-06-27", channel: "December", productName: "Armanis.w.y Spray", sku: "ArmWy_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 230, total: 230, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0458", date: "2026-06-27", channel: "December", productName: "Versace EROS Spray", sku: "VerEros_SP", type: "spray", sizeMl: 100, quantity: 1, unitPrice: 1500, total: 1500, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0457", date: "2026-06-27", channel: "December", productName: "Diptyque tam dao Spray", sku: "DipTam_SP", type: "spray", sizeMl: 30, quantity: 1, unitPrice: 320, total: 320, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0456", date: "2026-06-27", channel: "December", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 30, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0455", date: "2026-06-27", channel: "December", productName: "Armanis.w.y Spray", sku: "ArmWy_SP", type: "spray", sizeMl: 30, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0454", date: "2026-06-27", channel: "December", productName: "LOST Cherry Spray", sku: "LostChe_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 60, total: 60, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0453", date: "2026-06-27", channel: "December", productName: "Luxe Special Spray", sku: "LUXE1_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 130, total: 130, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0452", date: "2026-06-27", channel: "December", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0451", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0450", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0449", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0448", date: "2026-06-27", channel: "December", productName: "Hawas For Him", sku: "HFH", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0447", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0446", date: "2026-06-27", channel: "December", productName: "CK-1", sku: "CK1", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 230, total: 230, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0445", date: "2026-06-27", channel: "December", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0444", date: "2026-06-27", channel: "December", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 15, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0443", date: "2026-06-27", channel: "December", productName: "Hawas For Him", sku: "HFH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0442", date: "2026-06-27", channel: "December", productName: "Fogg", sku: "Fgg", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0441", date: "2026-06-27", channel: "December", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0440", date: "2026-06-27", channel: "December", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0439", date: "2026-06-27", channel: "December", productName: "White Oud", sku: "WO", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0438", date: "2026-06-27", channel: "December", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0437", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0436", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0435", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0434", date: "2026-06-27", channel: "December", productName: "Blue de Chanel", sku: "BluCha", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0433", date: "2026-06-27", channel: "December", productName: "CK-1", sku: "CK1", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 230, total: 230, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0432", date: "2026-06-27", channel: "December", productName: "Hawas For Him", sku: "HFH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 65, total: 65, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0431", date: "2026-06-27", channel: "December", productName: "Diptyque tam dao", sku: "DipTam", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 85, total: 85, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0430", date: "2026-06-27", channel: "December", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 75, total: 75, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0429", date: "2026-06-27", channel: "December", productName: "Prada Candy Spray", sku: "PRCn_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0428", date: "2026-06-27", channel: "December", productName: "Burberry Her Spray", sku: "BurH_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0427", date: "2026-06-27", channel: "December", productName: "Good Girl Spray", sku: "GooGir_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0426", date: "2026-06-27", channel: "December", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 75, total: 75, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0425", date: "2026-06-27", channel: "December", productName: "White Oud", sku: "WO", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 70, total: 70, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0424", date: "2026-06-27", channel: "December", productName: "Hawas For Him", sku: "HFH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 70, total: 70, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0423", date: "2026-06-27", channel: "December", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 65, total: 65, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0422", date: "2026-06-27", channel: "December", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 60, total: 60, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0421", date: "2026-06-27", channel: "December", productName: "Davidoff Cool Water Spray", sku: "DavCoo_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0420", date: "2026-06-27", channel: "December", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0419", date: "2026-06-27", channel: "December", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 30, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0418", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0417", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0416", date: "2026-06-27", channel: "December", productName: "Creed Aventus", sku: "CreAve", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0415", date: "2026-06-27", channel: "December", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 30, quantity: 1, unitPrice: 400, total: 400, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0414", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 15, quantity: 1, unitPrice: 600, total: 600, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0413", date: "2026-06-27", channel: "December", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 15, quantity: 1, unitPrice: 550, total: 550, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0412", date: "2026-06-27", channel: "December", productName: "CK-1", sku: "CK1", type: "roll-on", sizeMl: 15, quantity: 1, unitPrice: 400, total: 400, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0411", date: "2026-06-27", channel: "December", productName: "Dunhill Icon Spray", sku: "DunIco_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 700, total: 700, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0410", date: "2026-06-27", channel: "December", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0409", date: "2026-06-27", channel: "December", productName: "Creed absolute Spray", sku: "CreAbs_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 850, total: 850, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0408", date: "2026-06-27", channel: "December", productName: "Creed absolute", sku: "CreAbs", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 400, total: 400, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0407", date: "2026-06-27", channel: "December", productName: "victoriya secret Spray", sku: "VicSec_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0406", date: "2026-06-27", channel: "December", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0405", date: "2026-06-27", channel: "Online", productName: "Ameer Al oud", sku: "AmeOud", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0404", date: "2026-06-27", channel: "Online", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0403", date: "2026-06-27", channel: "Online", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0402", date: "2026-06-27", channel: "Online", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0401", date: "2026-06-27", channel: "Online", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0400", date: "2026-06-27", channel: "Online", productName: "victoriya secret Spray", sku: "VicSec_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 830, total: 830, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0399", date: "2026-06-27", channel: "Online", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0398", date: "2026-06-27", channel: "Online", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0397", date: "2026-06-27", channel: "Online", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0396", date: "2026-06-27", channel: "Online", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0395", date: "2026-06-27", channel: "Online", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0394", date: "2026-06-27", channel: "November", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0393", date: "2026-06-27", channel: "November", productName: "Fogg", sku: "Fgg", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 50, total: 50, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0392", date: "2026-06-27", channel: "November", productName: "White Oud", sku: "WO", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 70, total: 70, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0391", date: "2026-06-27", channel: "November", productName: "Ahsas al Arabia", sku: "AhsAra", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 70, total: 70, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0390", date: "2026-06-27", channel: "November", productName: "Ameer Al oud", sku: "AmeOud", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 70, total: 70, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0389", date: "2026-06-27", channel: "November", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 70, total: 70, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0388", date: "2026-06-27", channel: "November", productName: "Hawas For Him", sku: "HFH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0387", date: "2026-06-27", channel: "November", productName: "Prada Candy", sku: "PRCn", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 70, total: 70, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0386", date: "2026-06-27", channel: "November", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 75, total: 75, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0385", date: "2026-06-27", channel: "November", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 55, total: 55, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0384", date: "2026-06-27", channel: "November", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 50, total: 50, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0383", date: "2026-06-27", channel: "November", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 75, total: 75, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0382", date: "2026-06-27", channel: "November", productName: "Burberry Her", sku: "BurH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 75, total: 75, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0381", date: "2026-06-27", channel: "November", productName: "Chanel chance", sku: "ChaCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 75, total: 75, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0380", date: "2026-06-27", channel: "November", productName: "Paris Hilton", sku: "ParHil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 50, total: 50, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0379", date: "2026-06-27", channel: "November", productName: "Miss Dior", sku: "MisDio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 75, total: 75, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0378", date: "2026-06-27", channel: "November", productName: "Paris Hilton", sku: "ParHil", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 260, total: 260, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0377", date: "2026-06-27", channel: "November", productName: "Blue de Chanel", sku: "BluCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0376", date: "2026-06-27", channel: "November", productName: "Blue de Chanel", sku: "BluCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0375", date: "2026-06-27", channel: "November", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 30, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0374", date: "2026-06-27", channel: "November", productName: "CK-1", sku: "CK1", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 230, total: 230, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0373", date: "2026-06-27", channel: "November", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 75, total: 75, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0372", date: "2026-06-27", channel: "November", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 75, total: 75, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0371", date: "2026-06-27", channel: "October", productName: "Davidoff Cool Water Spray", sku: "DavCoo_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0370", date: "2026-06-27", channel: "October", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0369", date: "2026-06-27", channel: "October", productName: "Diptyque tam dao", sku: "DipTam", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0368", date: "2026-06-27", channel: "October", productName: "SRK Spray", sku: "SR_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 370, total: 370, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0367", date: "2026-06-27", channel: "October", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0366", date: "2026-06-27", channel: "October", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0365", date: "2026-06-27", channel: "October", productName: "Pure Seduction", sku: "PuSD", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0364", date: "2026-06-27", channel: "October", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0363", date: "2026-06-27", channel: "October", productName: "Paris Hilton", sku: "ParHil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0362", date: "2026-06-27", channel: "October", productName: "Good Girl Spray", sku: "GooGir_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0361", date: "2026-06-27", channel: "October", productName: "Fantasy Spray", sku: "Fant_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0360", date: "2026-06-27", channel: "October", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0359", date: "2026-06-27", channel: "October", productName: "Diptyque tam dao", sku: "DipTam", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0358", date: "2026-06-27", channel: "October", productName: "Luxe Special Spray", sku: "LUXE1_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 800, total: 800, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0357", date: "2026-06-27", channel: "October", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0356", date: "2026-06-27", channel: "October", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0355", date: "2026-06-27", channel: "October", productName: "Baccarat rouge", sku: "BacRou", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0354", date: "2026-06-27", channel: "October", productName: "Ameer Al oud", sku: "AmeOud", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 230, total: 230, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0353", date: "2026-06-27", channel: "October", productName: "Red Tobaco", sku: "RedTob", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 240, total: 240, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0352", date: "2026-06-27", channel: "October", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0351", date: "2026-06-27", channel: "October", productName: "CK-1", sku: "CK1", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0350", date: "2026-06-27", channel: "October", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0349", date: "2026-06-27", channel: "October", productName: "Diptyque tam dao", sku: "DipTam", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0348", date: "2026-06-27", channel: "October", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0347", date: "2026-06-27", channel: "October", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0346", date: "2026-06-27", channel: "October", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0345", date: "2026-06-27", channel: "October", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0344", date: "2026-06-27", channel: "October", productName: "Blue de Chanel", sku: "BluCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0343", date: "2026-06-27", channel: "October", productName: "Aqua DI Gio", sku: "AquGio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0342", date: "2026-06-27", channel: "October", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0341", date: "2026-06-27", channel: "October", productName: "Red Tobaco", sku: "RedTob", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0340", date: "2026-06-27", channel: "October", productName: "Diptyque tam dao", sku: "DipTam", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0339", date: "2026-06-27", channel: "October", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0338", date: "2026-06-27", channel: "October", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0337", date: "2026-06-27", channel: "October", productName: "Creed Aventus", sku: "CreAve", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0336", date: "2026-06-27", channel: "October", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0335", date: "2026-06-27", channel: "October", productName: "LOST Cherry Spray", sku: "LostChe_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0334", date: "2026-06-27", channel: "September", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 65, total: 65, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0333", date: "2026-06-27", channel: "September", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 55, total: 55, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0332", date: "2026-06-27", channel: "September", productName: "victoriya secret Spray", sku: "VicSec_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 320, total: 320, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0331", date: "2026-06-27", channel: "September", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0330", date: "2026-06-27", channel: "September", productName: "Blue de Chanel", sku: "BluCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0329", date: "2026-06-27", channel: "September", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0328", date: "2026-06-27", channel: "September", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0327", date: "2026-06-27", channel: "September", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0326", date: "2026-06-27", channel: "September", productName: "Luxe Special Spray", sku: "LUXE1_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 350, total: 350, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0325", date: "2026-06-27", channel: "September", productName: "Paris Hilton", sku: "ParHil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 130, total: 130, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0324", date: "2026-06-27", channel: "September", productName: "Aqua DI Gio", sku: "AquGio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0323", date: "2026-06-27", channel: "September", productName: "victoriya secret", sku: "VicSec", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0322", date: "2026-06-27", channel: "September", productName: "victoriya secret", sku: "VicSec", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0321", date: "2026-06-27", channel: "September", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0320", date: "2026-06-27", channel: "September", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0319", date: "2026-06-27", channel: "September", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0318", date: "2026-06-27", channel: "September", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0317", date: "2026-06-27", channel: "September", productName: "Red Tobaco", sku: "RedTob", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0316", date: "2026-06-27", channel: "September", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0315", date: "2026-06-27", channel: "September", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0314", date: "2026-06-27", channel: "September", productName: "victoriya secret Spray", sku: "VicSec_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 310, total: 310, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0313", date: "2026-06-27", channel: "September", productName: "Good Girl Spray", sku: "GooGir_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 310, total: 310, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0312", date: "2026-06-27", channel: "September", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0311", date: "2026-06-27", channel: "September", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0310", date: "2026-06-27", channel: "September", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0309", date: "2026-06-27", channel: "September", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0308", date: "2026-06-27", channel: "September", productName: "Blue de Chanel", sku: "BluCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0307", date: "2026-06-27", channel: "September", productName: "CK-1", sku: "CK1", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0306", date: "2026-06-27", channel: "September", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0305", date: "2026-06-27", channel: "September", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0304", date: "2026-06-27", channel: "September", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0303", date: "2026-06-27", channel: "September", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0302", date: "2026-06-27", channel: "September", productName: "Creed Aventus", sku: "CreAve", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0301", date: "2026-06-27", channel: "September", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0300", date: "2026-06-27", channel: "September", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0299", date: "2026-06-27", channel: "September", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0298", date: "2026-06-27", channel: "September", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0297", date: "2026-06-27", channel: "September", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0296", date: "2026-06-27", channel: "September", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0295", date: "2026-06-27", channel: "September", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0294", date: "2026-06-27", channel: "September", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0293", date: "2026-06-27", channel: "September", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0292", date: "2026-06-27", channel: "September", productName: "Blue de Chanel", sku: "BluCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0291", date: "2026-06-27", channel: "September", productName: "CK-1", sku: "CK1", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0290", date: "2026-06-27", channel: "September", productName: "CK-1", sku: "CK1", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0289", date: "2026-06-27", channel: "September", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0288", date: "2026-06-27", channel: "September", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0287", date: "2026-06-27", channel: "September", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0286", date: "2026-06-27", channel: "September", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0285", date: "2026-06-27", channel: "September", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0284", date: "2026-06-27", channel: "September", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0283", date: "2026-06-27", channel: "September", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0282", date: "2026-06-27", channel: "September", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0281", date: "2026-06-27", channel: "September", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 230, total: 230, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0280", date: "2026-06-27", channel: "September", productName: "Davidoff Cool Water Spray", sku: "DavCoo_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 600, total: 600, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0279", date: "2026-06-27", channel: "September", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 15, quantity: 1, unitPrice: 600, total: 600, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0278", date: "2026-06-27", channel: "August", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0277", date: "2026-06-27", channel: "August", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0276", date: "2026-06-27", channel: "August", productName: "Good Girl Spray", sku: "GooGir_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 310, total: 310, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0275", date: "2026-06-27", channel: "August", productName: "Gucci Flora Spray", sku: "GucFla_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0274", date: "2026-06-27", channel: "August", productName: "SRK", sku: "SR2", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 320, total: 320, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0273", date: "2026-06-27", channel: "August", productName: "victoriya secret", sku: "VicSec", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0272", date: "2026-06-27", channel: "August", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0271", date: "2026-06-27", channel: "August", productName: "Creed Aventus", sku: "CreAve", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0270", date: "2026-06-27", channel: "August", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0269", date: "2026-06-27", channel: "August", productName: "Good Girl Spray", sku: "GooGir_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0268", date: "2026-06-27", channel: "August", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0267", date: "2026-06-27", channel: "August", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0266", date: "2026-06-27", channel: "August", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0265", date: "2026-06-27", channel: "August", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0264", date: "2026-06-27", channel: "August", productName: "Blue de Chanel", sku: "BluCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0263", date: "2026-06-27", channel: "August", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0262", date: "2026-06-27", channel: "August", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0261", date: "2026-06-27", channel: "August", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0260", date: "2026-06-27", channel: "August", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0259", date: "2026-06-27", channel: "August", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0258", date: "2026-06-27", channel: "August", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0257", date: "2026-06-27", channel: "August", productName: "Blue de Chanel Spray", sku: "BluCha_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0256", date: "2026-06-27", channel: "August", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0255", date: "2026-06-27", channel: "August", productName: "Dunhil desire Spray", sku: "DunDes_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 700, total: 700, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0254", date: "2026-06-27", channel: "August", productName: "Gucci Flora Spray", sku: "GucFla_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0253", date: "2026-06-27", channel: "August", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0252", date: "2026-06-27", channel: "August", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0251", date: "2026-06-27", channel: "August", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0250", date: "2026-06-27", channel: "August", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0249", date: "2026-06-27", channel: "Fair5", productName: "Good Girl Spray", sku: "GooGir_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0248", date: "2026-06-27", channel: "Fair5", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0247", date: "2026-06-27", channel: "Fair5", productName: "Ameer Al oud", sku: "AmeOud", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0246", date: "2026-06-27", channel: "Fair5", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0245", date: "2026-06-27", channel: "Fair5", productName: "Aqua DI Gio", sku: "AquGio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0244", date: "2026-06-27", channel: "Fair5", productName: "Aqua DI Gio", sku: "AquGio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0243", date: "2026-06-27", channel: "Fair5", productName: "Aqua DI Gio", sku: "AquGio", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0242", date: "2026-06-27", channel: "Fair5", productName: "Fantasy Spray", sku: "Fant_2_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0241", date: "2026-06-27", channel: "Fair5", productName: "Burberry Her", sku: "BurH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0240", date: "2026-06-27", channel: "Fair4", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0239", date: "2026-06-27", channel: "Fair4", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0238", date: "2026-06-27", channel: "Fair4", productName: "Pure Seduction", sku: "PuSD", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0237", date: "2026-06-27", channel: "Fair4", productName: "Chanel chance", sku: "ChaCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0236", date: "2026-06-27", channel: "Fair4", productName: "Pure Seduction", sku: "PuSD", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0235", date: "2026-06-27", channel: "Fair4", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0234", date: "2026-06-27", channel: "Fair4", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0233", date: "2026-06-27", channel: "Fair4", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0232", date: "2026-06-27", channel: "Fair4", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0231", date: "2026-06-27", channel: "Fair4", productName: "Dunhill Icon", sku: "DunIco", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0230", date: "2026-06-27", channel: "Fair4", productName: "Vampire B. Spray", sku: "VampB_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0229", date: "2026-06-27", channel: "Fair4", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0228", date: "2026-06-27", channel: "Fair4", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0227", date: "2026-06-27", channel: "Fair4", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0226", date: "2026-06-27", channel: "Fair4", productName: "kacha beli", sku: "KacBel", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 130, total: 130, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0225", date: "2026-06-27", channel: "Fair4", productName: "Burberry Her", sku: "BurH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0224", date: "2026-06-27", channel: "Fair4", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 230, total: 230, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0223", date: "2026-06-27", channel: "Fair4", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 260, total: 260, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0222", date: "2026-06-27", channel: "Fair4", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 260, total: 260, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0221", date: "2026-06-27", channel: "Fair4", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0220", date: "2026-06-27", channel: "Fair4", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0219", date: "2026-06-27", channel: "Fair4", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0218", date: "2026-06-27", channel: "Fair4", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 260, total: 260, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0217", date: "2026-06-27", channel: "Fair4", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0216", date: "2026-06-27", channel: "Fair4", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0215", date: "2026-06-27", channel: "Fair4", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 200, total: 200, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0214", date: "2026-06-27", channel: "Fair4", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0213", date: "2026-06-27", channel: "Fair4", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0212", date: "2026-06-27", channel: "Fair4", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0211", date: "2026-06-27", channel: "Fair4", productName: "Creed Aventus", sku: "CreAve", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0210", date: "2026-06-27", channel: "Fair4", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0209", date: "2026-06-27", channel: "Fair4", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0208", date: "2026-06-27", channel: "Fair4", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0207", date: "2026-06-27", channel: "Fair4", productName: "Creed Aventus", sku: "CreAve", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 240, total: 240, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0206", date: "2026-06-27", channel: "Fair4", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0205", date: "2026-06-27", channel: "Fair4", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0204", date: "2026-06-27", channel: "Fair4", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0203", date: "2026-06-27", channel: "Fair4", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0202", date: "2026-06-27", channel: "Fair4", productName: "Prada Candy", sku: "PRCn", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0201", date: "2026-06-27", channel: "Fair4", productName: "Miss Dior", sku: "MisDio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0200", date: "2026-06-27", channel: "Fair4", productName: "Chanel chance", sku: "ChaCha", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0199", date: "2026-06-27", channel: "Fair4", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0198", date: "2026-06-27", channel: "Fair4", productName: "Burberry Her", sku: "BurH", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0197", date: "2026-06-27", channel: "Fair4", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0196", date: "2026-06-27", channel: "Fair4", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0195", date: "2026-06-27", channel: "Fair4", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0194", date: "2026-06-27", channel: "Fair4", productName: "SRK Spray", sku: "SR_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 380, total: 380, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0193", date: "2026-06-27", channel: "Fair4", productName: "Burberry Her", sku: "BurH", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0192", date: "2026-06-27", channel: "Fair4", productName: "Aqua DI Gio", sku: "AquGio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0191", date: "2026-06-27", channel: "Fair4", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0190", date: "2026-06-27", channel: "Fair4", productName: "Dunhil desire Spray", sku: "DunDes_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0189", date: "2026-06-27", channel: "Fair4", productName: "victoriya secret", sku: "VicSec", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0188", date: "2026-06-27", channel: "Fair4", productName: "victoriya secret", sku: "VicSec", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 180, total: 180, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0187", date: "2026-06-27", channel: "Fair3", productName: "SRK Spray", sku: "SR_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 400, total: 400, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0186", date: "2026-06-27", channel: "Fair3", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 320, total: 320, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0185", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0184", date: "2026-06-27", channel: "Fair3", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0183", date: "2026-06-27", channel: "Fair3", productName: "Chocolate", sku: "CoCo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0182", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0181", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0180", date: "2026-06-27", channel: "Fair3", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0179", date: "2026-06-27", channel: "Fair3", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0178", date: "2026-06-27", channel: "Fair3", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0177", date: "2026-06-27", channel: "Fair3", productName: "Chanel chance", sku: "ChaCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0176", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0175", date: "2026-06-27", channel: "Fair3", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0174", date: "2026-06-27", channel: "Fair3", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0173", date: "2026-06-27", channel: "Fair3", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0172", date: "2026-06-27", channel: "Fair3", productName: "kacha beli", sku: "KacBel", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0171", date: "2026-06-27", channel: "Fair3", productName: "kacha beli", sku: "KacBel", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0170", date: "2026-06-27", channel: "Fair3", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0169", date: "2026-06-27", channel: "Fair3", productName: "kacha beli Spray", sku: "KacBel_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 280, total: 280, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0168", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0167", date: "2026-06-27", channel: "Fair3", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0166", date: "2026-06-27", channel: "Fair3", productName: "Fantasy Spray", sku: "Fant_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0165", date: "2026-06-27", channel: "Fair3", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0164", date: "2026-06-27", channel: "Fair3", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0163", date: "2026-06-27", channel: "Fair3", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0162", date: "2026-06-27", channel: "Fair3", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0161", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0160", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0159", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0158", date: "2026-06-27", channel: "Fair3", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0157", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0156", date: "2026-06-27", channel: "Fair3", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0155", date: "2026-06-27", channel: "Fair3", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 130, total: 130, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0154", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0153", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0152", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0151", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0150", date: "2026-06-27", channel: "Fair3", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0149", date: "2026-06-27", channel: "Fair3", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0148", date: "2026-06-27", channel: "Fair3", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0147", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0146", date: "2026-06-27", channel: "Fair3", productName: "Diptyque tam dao", sku: "DipTam", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0145", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0144", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0143", date: "2026-06-27", channel: "Fair3", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0142", date: "2026-06-27", channel: "Fair3", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0141", date: "2026-06-27", channel: "Fair3", productName: "Vanila Spray", sku: "Vanil_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0140", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry Spray", sku: "LostChe_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 280, total: 280, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0139", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry Spray", sku: "LostChe_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0138", date: "2026-06-27", channel: "Fair3", productName: "Good Girl Spray", sku: "GooGir_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0137", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0136", date: "2026-06-27", channel: "Fair3", productName: "Chocolate", sku: "CoCo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 130, total: 130, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0135", date: "2026-06-27", channel: "Fair3", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0134", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0133", date: "2026-06-27", channel: "Fair3", productName: "victoriya secret", sku: "VicSec", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0132", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0131", date: "2026-06-27", channel: "Fair3", productName: "Chanel chance", sku: "ChaCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0130", date: "2026-06-27", channel: "Fair3", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0129", date: "2026-06-27", channel: "Fair3", productName: "Chocolate", sku: "CoCo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0128", date: "2026-06-27", channel: "Fair3", productName: "Chanel chance", sku: "ChaCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0127", date: "2026-06-27", channel: "Fair3", productName: "Chanel chance", sku: "ChaCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0126", date: "2026-06-27", channel: "Fair3", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0125", date: "2026-06-27", channel: "Fair3", productName: "Chocolate", sku: "CoCo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0124", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0123", date: "2026-06-27", channel: "Fair3", productName: "Armanis.w.y", sku: "ArmWy", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0122", date: "2026-06-27", channel: "Fair3", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0121", date: "2026-06-27", channel: "Fair3", productName: "Blue berry Spray", sku: "BluBer_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0120", date: "2026-06-27", channel: "Fair3", productName: "Chocolate", sku: "CoCo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0119", date: "2026-06-27", channel: "Fair3", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0118", date: "2026-06-27", channel: "Fair3", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0117", date: "2026-06-27", channel: "Fair3", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0116", date: "2026-06-27", channel: "Fair3", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0115", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0114", date: "2026-06-27", channel: "Fair3", productName: "Blue berry Spray", sku: "BluBer_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0113", date: "2026-06-27", channel: "Fair3", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 130, total: 130, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0112", date: "2026-06-27", channel: "Fair3", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0111", date: "2026-06-27", channel: "Fair3", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0110", date: "2026-06-27", channel: "Fair3", productName: "Fantasy Spray", sku: "Fant_2_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0109", date: "2026-06-27", channel: "Fair3", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0108", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0107", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0106", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0105", date: "2026-06-27", channel: "Fair3", productName: "Creed Aventus", sku: "CreAve", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0104", date: "2026-06-27", channel: "Fair3", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0103", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0102", date: "2026-06-27", channel: "Fair3", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0101", date: "2026-06-27", channel: "Fair3", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0100", date: "2026-06-27", channel: "Fair3", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0099", date: "2026-06-27", channel: "Fair3", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0098", date: "2026-06-27", channel: "Fair3", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0097", date: "2026-06-27", channel: "Fair3", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0096", date: "2026-06-27", channel: "Fair3", productName: "Miss Dior", sku: "MisDio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0095", date: "2026-06-27", channel: "Fair3", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0094", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0093", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0092", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0091", date: "2026-06-27", channel: "Fair3", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0090", date: "2026-06-27", channel: "Fair3", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0089", date: "2026-06-27", channel: "Fair3", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0088", date: "2026-06-27", channel: "Fair3", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0087", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0086", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0085", date: "2026-06-27", channel: "Fair3", productName: "Good Girl Spray", sku: "GooGir_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 310, total: 310, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0084", date: "2026-06-27", channel: "Fair3", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0083", date: "2026-06-27", channel: "Fair3", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 250, total: 250, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0082", date: "2026-06-27", channel: "Fair3", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0081", date: "2026-06-27", channel: "Fair3", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0080", date: "2026-06-27", channel: "Fair3", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0079", date: "2026-06-27", channel: "Fair2", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0078", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 15, quantity: 1, unitPrice: 750, total: 750, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0077", date: "2026-06-27", channel: "Fair2", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0076", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0075", date: "2026-06-27", channel: "Fair2", productName: "Chanel chance", sku: "ChaCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0074", date: "2026-06-27", channel: "Fair2", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 270, total: 270, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0073", date: "2026-06-27", channel: "Fair2", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0072", date: "2026-06-27", channel: "Fair2", productName: "kacha beli", sku: "KacBel", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 130, total: 130, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0071", date: "2026-06-27", channel: "Fair2", productName: "Vampire B. Spray", sku: "VampB_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 850, total: 850, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0070", date: "2026-06-27", channel: "Fair2", productName: "Vampire B. Spray", sku: "VampB_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 850, total: 850, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0069", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 160, total: 160, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0068", date: "2026-06-27", channel: "Fair2", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0067", date: "2026-06-27", channel: "Fair2", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0066", date: "2026-06-27", channel: "Fair2", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0065", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0064", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0063", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0062", date: "2026-06-27", channel: "Fair2", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0061", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0060", date: "2026-06-27", channel: "Fair2", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0059", date: "2026-06-27", channel: "Fair2", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0058", date: "2026-06-27", channel: "Fair2", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 130, total: 130, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0057", date: "2026-06-27", channel: "Fair2", productName: "Vampire B. Spray", sku: "VampB_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 350, total: 350, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0056", date: "2026-06-27", channel: "Fair2", productName: "Miss Dior", sku: "MisDio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0055", date: "2026-06-27", channel: "Fair2", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0054", date: "2026-06-27", channel: "Fair2", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0053", date: "2026-06-27", channel: "Fair2", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0052", date: "2026-06-27", channel: "Fair2", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0051", date: "2026-06-27", channel: "Fair2", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0050", date: "2026-06-27", channel: "Fair2", productName: "LOST Cherry Spray", sku: "LostChe_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0049", date: "2026-06-27", channel: "Fair2", productName: "LOST Cherry", sku: "LostChe", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0048", date: "2026-06-27", channel: "Fair2", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0047", date: "2026-06-27", channel: "Fair2", productName: "Luxe Special Spray", sku: "LUXE1_SP", type: "spray", sizeMl: 15, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0046", date: "2026-06-27", channel: "Fair2", productName: "Dior Sauvage Spray", sku: "DioSau_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0045", date: "2026-06-27", channel: "Fair2", productName: "Aqua DI Gio", sku: "AquGio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0044", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0043", date: "2026-06-27", channel: "Fair2", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0042", date: "2026-06-27", channel: "Fair2", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0041", date: "2026-06-27", channel: "Fair2", productName: "Vanila", sku: "Vanil", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0040", date: "2026-06-27", channel: "Fair2", productName: "Red Tobaco", sku: "RedTob", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0039", date: "2026-06-27", channel: "Fair2", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0038", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0037", date: "2026-06-27", channel: "Fair2", productName: "Davidoff Cool Water", sku: "DavCoo", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0036", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0035", date: "2026-06-27", channel: "Fair2", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0034", date: "2026-06-27", channel: "Fair2", productName: "Gucci Flora", sku: "GucFla", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0033", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 15, quantity: 1, unitPrice: 750, total: 750, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0032", date: "2026-06-27", channel: "Fair2", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0031", date: "2026-06-27", channel: "Fair2", productName: "kacha beli", sku: "KacBel", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0030", date: "2026-06-27", channel: "Fair2", productName: "Good Girl", sku: "GooGir", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0029", date: "2026-06-27", channel: "Fair2", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0028", date: "2026-06-27", channel: "Fair2", productName: "Dior Sauvage", sku: "DioSau", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0027", date: "2026-06-27", channel: "Fair2", productName: "Aqua DI Gio", sku: "AquGio", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0026", date: "2026-06-27", channel: "Fair2", productName: "Vampire B. Spray", sku: "VampB_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 350, total: 350, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0025", date: "2026-06-27", channel: "Fair2", productName: "victoriya secret", sku: "VicSec", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0024", date: "2026-06-27", channel: "Fair1", productName: "Fantasy Spray", sku: "Fant_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0023", date: "2026-06-27", channel: "Fair1", productName: "Vanila Spray", sku: "Vanil_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 320, total: 320, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0022", date: "2026-06-27", channel: "Fair1", productName: "Creed Aventus", sku: "CreAve", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0021", date: "2026-06-27", channel: "Fair1", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0020", date: "2026-06-27", channel: "Fair1", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0019", date: "2026-06-27", channel: "Fair1", productName: "victoriya secret Spray", sku: "VicSec_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 330, total: 330, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0018", date: "2026-06-27", channel: "Fair1", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0017", date: "2026-06-27", channel: "Fair1", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0016", date: "2026-06-27", channel: "Fair1", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0015", date: "2026-06-27", channel: "Fair1", productName: "Dunhil desire", sku: "DunDes", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0014", date: "2026-06-27", channel: "Fair1", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 170, total: 170, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0013", date: "2026-06-27", channel: "Fair1", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0012", date: "2026-06-27", channel: "Fair1", productName: "Ultra male", sku: "UltMal", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0011", date: "2026-06-27", channel: "Fair1", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 110, total: 110, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0010", date: "2026-06-27", channel: "Fair1", productName: "Fantasy", sku: "Fant", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 230, total: 230, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0009", date: "2026-06-27", channel: "Fair1", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 120, total: 120, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0008", date: "2026-06-27", channel: "Fair1", productName: "Blue de Chanel", sku: "BluCha", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0007", date: "2026-06-27", channel: "Fair1", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 280, total: 280, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0006", date: "2026-06-27", channel: "Fair1", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 6, quantity: 1, unitPrice: 300, total: 300, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0005", date: "2026-06-27", channel: "Fair1", productName: "Armanis.w.y Spray", sku: "ArmWy_SP", type: "spray", sizeMl: 6, quantity: 1, unitPrice: 280, total: 280, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0004", date: "2026-06-27", channel: "Fair1", productName: "Vampire B.", sku: "VampB", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 150, total: 150, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0003", date: "2026-06-27", channel: "Fair1", productName: "Dunhill Icon", sku: "DunIco_2", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 140, total: 140, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0002", date: "2026-06-27", channel: "Fair1", productName: "Blue berry", sku: "BluBer", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
  { invoiceNo: "INV-0001", date: "2026-06-27", channel: "Fair1", productName: "Versace EROS", sku: "VerEros", type: "roll-on", sizeMl: 3.5, quantity: 1, unitPrice: 100, total: 100, paymentStatus: "paid", notes: "" },
];

// ----- Deduct functions (same as bulk upload) -----
async function deductRawMaterial(materialId, mlUsed, saleId) {
  if (!materialId || mlUsed <= 0) return;
  const material = await RawMaterial.findById(materialId);
  if (!material) {
    console.warn(`⚠️ Raw material ${materialId} not found – skipping.`);
    return;
  }
  const newStock = material.currentStockMl - mlUsed;
  if (newStock < 0) {
    console.warn(`⚠️ ${material.name} stock would go to ${newStock} – setting to 0.`);
    material.currentStockMl = 0;
  } else {
    material.currentStockMl = newStock;
  }
  await material.save();
  await InventoryLog.create({
    material: materialId,
    changeQuantity: -mlUsed,
    reason: 'sale',
    reference: saleId,
    refModel: 'Sale',
    notes: `Sale deduction of ${mlUsed}ml`,
  });
}

async function deductBottle(bottleId, quantity, saleId) {
  if (!bottleId || quantity <= 0) return;
  const bottle = await Bottle.findById(bottleId);
  if (!bottle) {
    console.warn(`⚠️ Bottle ${bottleId} not found – skipping.`);
    return;
  }
  const newStock = bottle.currentStock - quantity;
  if (newStock < 0) {
    console.warn(`⚠️ Bottle ${bottle.sizeMl}ml stock would go to ${newStock} – setting to 0.`);
    bottle.currentStock = 0;
  } else {
    bottle.currentStock = newStock;
  }
  await bottle.save();
  await InventoryLog.create({
    bottle: bottleId,
    changeQuantity: -quantity,
    reason: 'sale',
    reference: saleId,
    refModel: 'Sale',
    notes: `Sale deduction of ${quantity} bottles`,
  });
}

async function deductBottle(bottleId, quantity, saleId) {
  if (!bottleId || quantity <= 0) return;
  const bottle = await Bottle.findById(bottleId);
  if (!bottle) {
    console.warn(`⚠️ Bottle ${bottleId} not found – skipping.`);
    return;
  }
  bottle.currentStock -= quantity;
  await bottle.save();
  await InventoryLog.create({
    bottle: bottleId,
    changeQuantity: -quantity,
    reason: 'sale',
    reference: saleId,
    refModel: 'Sale',
    notes: `Sale deduction of ${quantity} bottles`,
  });
}

// ----- Main -----
async function pushSales() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Group by invoice
    const salesMap = new Map();
    for (const row of rows) {
      const { invoiceNo, date, channel, sku, sizeMl, quantity, unitPrice, paymentStatus, notes } = row;
      if (!invoiceNo || !sku) continue;
      if (!salesMap.has(invoiceNo)) {
        salesMap.set(invoiceNo, {
          invoiceNo,
          channel: channel || 'Other',
          saleDate: new Date(date),
          paymentStatus: paymentStatus || 'paid',
          notes: notes || '',
          items: [],
        });
      }
      const sale = salesMap.get(invoiceNo);
      sale.items.push({ sku, sizeMl, quantity, unitPrice });
    }

    const salesArray = Array.from(salesMap.values()).filter(s => s.items.length > 0);
    console.log(`📋 Found ${salesArray.length} invoices.`);

    // Check for duplicates
    const existing = await Sale.find({ invoiceNo: { $in: salesArray.map(s => s.invoiceNo) } }, 'invoiceNo').lean();
    const existingSet = new Set(existing.map(s => s.invoiceNo));
    const newSales = salesArray.filter(s => !existingSet.has(s.invoiceNo));
    const duplicates = salesArray.filter(s => existingSet.has(s.invoiceNo));

    if (duplicates.length) console.log(`⏭️ Skipping ${duplicates.length} existing invoices.`);
    if (!newSales.length) {
      console.log('❌ No new invoices to insert.');
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Processing ${newSales.length} new invoices.`);

    let createdCount = 0;
    for (const saleData of newSales) {
      const { invoiceNo, channel, saleDate, paymentStatus, notes, items } = saleData;
      let totalAmount = 0;
      const processedItems = [];

      for (const item of items) {
        const { sku, sizeMl, quantity, unitPrice } = item;
        const product = await Product.findOne({ sku }).populate('sizes.bottle');
        if (!product) {
          console.warn(`⚠️ SKU "${sku}" not found – skipping.`);
          continue;
        }
        const sizeVariant = product.sizes.find(s => s.sizeMl === sizeMl);
        if (!sizeVariant) {
          console.warn(`⚠️ Size ${sizeMl}ml not found for SKU "${sku}" – skipping.`);
          continue;
        }
        const itemTotal = quantity * unitPrice;
        totalAmount += itemTotal;
        processedItems.push({
          product: product._id,
          sizeMl,
          quantity,
          unitPrice,
          totalPrice: itemTotal,
          productRef: product,
          sizeVariant,
        });
      }

      if (!processedItems.length) {
        console.warn(`⚠️ No valid items for ${invoiceNo} – skipping.`);
        continue;
      }

      const sale = await Sale.create({
        invoiceNo,
        channel,
        items: processedItems.map(({ product, sizeMl, quantity, unitPrice, totalPrice }) => ({
          product,
          sizeMl,
          quantity,
          unitPrice,
          totalPrice,
        })),
        totalAmount,
        paymentStatus,
        saleDate,
        notes,
      });

      for (const item of processedItems) {
        const { productRef, sizeVariant, quantity } = item;
        await deductBottle(sizeVariant.bottle, quantity, sale._id);
        if (productRef.type === 'roll-on') {
          if (productRef.baseOil) {
            const oilMlUsed = sizeVariant.oilMlUsed || sizeVariant.sizeMl;
            await deductRawMaterial(productRef.baseOil, oilMlUsed * quantity, sale._id);
          }
        } else {
          if (productRef.blendComponents && productRef.blendComponents.length) {
            for (const comp of productRef.blendComponents) {
              if (comp.material) {
                const mlUsed = (sizeVariant.sizeMl * comp.percentage / 100) * quantity;
                await deductRawMaterial(comp.material, mlUsed, sale._id);
              }
            }
          }
        }
      }

      if (paymentStatus === 'paid') {
        await Transaction.create({
          type: 'cash_in',
          amount: totalAmount,
          category: 'Sale',
          reference: sale._id,
          refModel: 'Sale',
          description: `Sale ${invoiceNo} (${channel})`,
        });
      }

      createdCount++;
      console.log(`✅ ${invoiceNo} (${totalAmount} ৳)`);
    }

    console.log(`🎉 Successfully created ${createdCount} sales.`);
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

pushSales();