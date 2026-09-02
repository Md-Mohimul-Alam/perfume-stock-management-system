const mongoose = require('mongoose');

const purchaseEntrySchema = mongoose.Schema({
  quantityMl: { type: Number, required: true, min: 0 },
  costPerMl: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true, min: 0 },
  purchaseDate: { type: Date, default: Date.now },
  supplier: { type: String },
  invoiceNo: { type: String },
});

const rawMaterialSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    type: { type: String, enum: ['oil', 'ethanol', 'fixative'], required: true },
    currentStockMl: { type: Number, default: 0, min: 0 },
    avgCostPerMl: { type: Number, default: 0, min: 0 },
    purchases: [purchaseEntrySchema],
    isStockOut: { type: Boolean, default: false },   // ✅ NEW
  },
  { timestamps: true }
);

// Recalculate avg cost after adding a purchase
rawMaterialSchema.methods.addPurchase = function (quantityMl, costPerMl, totalCost, supplier, invoiceNo) {
  this.purchases.push({ quantityMl, costPerMl, totalCost, supplier, invoiceNo });
  const totalQty = this.purchases.reduce((sum, p) => sum + p.quantityMl, 0);
  const totalCostSum = this.purchases.reduce((sum, p) => sum + p.totalCost, 0);
  this.avgCostPerMl = totalCostSum / totalQty;
  this.currentStockMl += quantityMl;
  this.isStockOut = false;   // ✅ Reset flag when stock is replenished
  return this;
};

// Deduct stock (used by sales/production)
rawMaterialSchema.methods.deductStock = function (quantityMl) {
  if (this.currentStockMl < quantityMl) {
    throw new Error(`Insufficient stock for ${this.name}. Available: ${this.currentStockMl}ml`);
  }
  this.currentStockMl -= quantityMl;
  return this;
};

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);