const mongoose = require('mongoose');

const bottlePurchaseSchema = mongoose.Schema({
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },

  costPerUnit: {
    type: Number,
    required: true,
    min: 0,
  },

  totalCost: {
    type: Number,
    required: true,
    min: 0,
  },

  purchaseDate: {
    type: Date,
    default: Date.now,
  },

  supplier: String,

  invoiceNo: String,
});

const bottleSchema = mongoose.Schema(
  {
    sizeMl: {
      type: Number,
      required: true,
      min: 0.1,
    },

    type: {
      type: String,
      enum: ['roll-on', 'spray'],
      required: true,
    },

    currentStock: {
      type: Number,
      default: 0,
      min: 0,
    },

    avgCostPerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Customer selling price for empty bottle
    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Multiple images for this exact bottle size/type
    images: {
      type: [String],
      default: [],
    },

    totalPurchased: {
      type: Number,
      default: 0,
      min: 0,
    },

    purchases: [
      bottlePurchaseSchema,
    ],

    isStockOut: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
    },

    toObject: {
      virtuals: true,
    },
  }
);

/* ========================================
   ADD PURCHASE
======================================== */

bottleSchema.methods.addPurchase = function (
  quantity,
  costPerUnit,
  totalCost,
  supplier,
  invoiceNo
) {
  this.purchases.push({
    quantity,
    costPerUnit,
    totalCost,
    supplier,
    invoiceNo,
  });

  const totalQty =
    this.purchases.reduce(
      (sum, purchase) =>
        sum +
        Number(
          purchase.quantity || 0
        ),
      0
    );

  const totalCostSum =
    this.purchases.reduce(
      (sum, purchase) =>
        sum +
        Number(
          purchase.totalCost || 0
        ),
      0
    );

  this.avgCostPerUnit =
    totalQty > 0
      ? totalCostSum / totalQty
      : 0;

  this.currentStock +=
    Number(quantity);

  this.totalPurchased =
    totalQty;

  if (
    Number(quantity) > 0
  ) {
    this.isStockOut =
      false;
  }

  return this;
};

/* ========================================
   DEDUCT STOCK
======================================== */

bottleSchema.methods.deductStock = function (
  quantity
) {
  const qty =
    Number(quantity);

  if (
    !Number.isInteger(qty) ||
    qty <= 0
  ) {
    throw new Error(
      'Bottle quantity must be a positive whole number'
    );
  }

  if (
    this.currentStock <
    qty
  ) {
    throw new Error(
      `Insufficient bottle stock for ${this.sizeMl}ml ${this.type}. Available: ${this.currentStock}`
    );
  }

  this.currentStock -=
    qty;

  if (
    this.currentStock <=
    0
  ) {
    this.currentStock =
      0;

    this.isStockOut =
      true;
  }

  return this;
};

module.exports =
  mongoose.model(
    'Bottle',
    bottleSchema
  );