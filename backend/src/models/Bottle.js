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
    sizeMl: { type: Number, required: true },
    type: { type: String, enum: ['roll-on', 'spray'], required: true },
    currentStock: { type: Number, default: 0, min: 0 },
    avgCostPerUnit: { type: Number, default: 0, min: 0 },
    totalPurchased: { type: Number, default: 0 }, // total quantity ever purchased/added
    purchases: [bottlePurchaseSchema],

    // ✅ NEW: stock-out flag
    isStockOut: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ✅ addPurchase updates stock, avg cost, totalPurchased, and clears stock-out
bottleSchema.methods.addPurchase = function (quantity, costPerUnit, totalCost, supplier, invoiceNo) {
  this.purchases.push({ quantity, costPerUnit, totalCost, supplier, invoiceNo });

  const totalQty = this.purchases.reduce((sum, p) => sum + p.quantity, 0);
  const totalCostSum = this.purchases.reduce((sum, p) => sum + p.totalCost, 0);
  this.avgCostPerUnit = totalQty > 0 ? totalCostSum / totalQty : 0;
  this.currentStock += quantity;
  this.totalPurchased = totalQty;

  // ✅ Reset stock-out when stock is replenished
  if (quantity > 0) this.isStockOut = false;

  return this;
};

// ✅ deductStock – reduces currentStock (used in sales/production)
bottleSchema.methods.deductStock = function (quantity) {
  if (this.currentStock < quantity) {
    throw new Error(`Insufficient bottle stock for ${this.sizeMl}ml. Available: ${this.currentStock}`);
  }
  this.currentStock -= quantity;
  return this;
};

module.exports = mongoose.model('Bottle', bottleSchema);