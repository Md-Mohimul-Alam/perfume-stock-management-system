
const mongoose = require('mongoose');

const purchaseItemSchema = mongoose.Schema({
  itemType: {
    type: String,
    enum: ['RawMaterial', 'Bottle'],
    required: true,
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'items.itemType',
  },
  quantity: {
    type: Number,
    required: true,
  },
  costPerUnit: {
    type: Number,
    required: true,
  },
  totalCost: {
    type: Number,
    required: true,
  },
});

const purchasePaymentSchema = mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    method: {
      type: String,
      enum: ['Cash', 'Bank', 'Mobile Banking', 'Other'],
      default: 'Cash',
    },
    note: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const purchaseSchema = mongoose.Schema(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
    },
    supplier: String,
    items: [purchaseItemSchema],

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // No default: preserves legacy purchase detection
    paidAmount: {
      type: Number,
      min: 0,
    },

    // No default: preserves legacy purchase detection
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
    },

    payments: {
      type: [purchasePaymentSchema],
      default: [],
    },

    purchaseDate: {
      type: Date,
      default: Date.now,
    },

    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Purchase', purchaseSchema);
