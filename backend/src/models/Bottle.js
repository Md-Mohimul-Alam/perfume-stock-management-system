const mongoose = require('mongoose');

const bottlePurchaseSchema = mongoose.Schema({
  quantity: { type: Number, required: true, min: 1 },
  costPerUnit: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true, min: 0 },
  purchaseDate: { type: Date, default: Date.now },
  supplier: String,
  invoiceNo: String,
});

const bottleSchema = mongoose.Schema(
  {
    sizeMl: { type: Number, required: true }, // e.g., 3.5, 6, 15, 30, 50, 100
    type: { type: String, enum: ['roll-on', 'spray'], required: true },
    currentStock: { type: Number, default: 0, min: 0 },
    avgCostPerUnit: { type: Number, default: 0, min: 0 },
    purchases: [bottlePurchaseSchema],
  },
  { timestamps: true }
);

bottleSchema.methods.addPurchase = function (quantity, costPerUnit, totalCost, supplier, invoiceNo) {
  this.purchases.push({ quantity, costPerUnit, totalCost, supplier, invoiceNo });
  const totalQty = this.purchases.reduce((sum, p) => sum + p.quantity, 0);
  const totalCostSum = this.purchases.reduce((sum, p) => sum + p.totalCost, 0);
  this.avgCostPerUnit = totalCostSum / totalQty;
  this.currentStock += quantity;
  return this;
};

bottleSchema.methods.deductStock = function (quantity) {
  if (this.currentStock < quantity) {
    throw new Error(`Insufficient bottle stock for ${this.sizeMl}ml. Available: ${this.currentStock}`);
  }
  this.currentStock -= quantity;
  return this;
};

module.exports = mongoose.model('Bottle', bottleSchema);