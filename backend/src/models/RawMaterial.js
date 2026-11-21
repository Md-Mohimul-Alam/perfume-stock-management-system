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
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    type: {
      type: String,
      enum: ['oil', 'ethanol', 'fixative'],
      required: true,
    },
    currentStockMl: { type: Number, default: 0, min: 0 },
    avgCostPerMl: { type: Number, default: 0, min: 0 },
    purchases: [purchaseEntrySchema],
    isStockOut: { type: Boolean, default: false },
    currentCycleWastageMl: { type: Number, default: 0, min: 0 },
    lastRestockAt: { type: Date, default: null },
  },
  { timestamps: true }
);

rawMaterialSchema.methods.addPurchase = function (
  quantityMl,
  costPerMl,
  totalCost,
  supplier,
  invoiceNo
) {
  if (
    !Number.isFinite(Number(quantityMl)) ||
    Number(quantityMl) <= 0 ||
    !Number.isFinite(Number(costPerMl)) ||
    Number(costPerMl) < 0 ||
    !Number.isFinite(Number(totalCost)) ||
    Number(totalCost) < 0
  ) {
    throw new Error('Invalid purchase quantity or cost.');
  }

  this.purchases.push({
    quantityMl: Number(quantityMl),
    costPerMl: Number(costPerMl),
    totalCost: Number(totalCost),
    supplier,
    invoiceNo,
  });

  const totalQty = this.purchases.reduce(
    (sum, purchase) => sum + Number(purchase.quantityMl || 0),
    0
  );

  const totalCostSum = this.purchases.reduce(
    (sum, purchase) => sum + Number(purchase.totalCost || 0),
    0
  );

  this.avgCostPerMl = totalQty > 0 ? totalCostSum / totalQty : 0;
  this.currentStockMl = Number(this.currentStockMl || 0) + Number(quantityMl);
  this.isStockOut = false;

  // Existing project behavior: a purchase starts a new wastage cycle.
  this.currentCycleWastageMl = 0;
  this.lastRestockAt = new Date();

  return this;
};

rawMaterialSchema.methods.deductStock = function (quantityMl) {
  const quantity = Number(quantityMl);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Deduction quantity must be greater than zero.');
  }

  if (Number(this.currentStockMl || 0) < quantity) {
    throw new Error(
      `Insufficient stock for ${this.name}. Available: ${this.currentStockMl}ml`
    );
  }

  this.currentStockMl = Number(this.currentStockMl || 0) - quantity;
  this.isStockOut = this.currentStockMl <= 0;

  return this;
};

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);