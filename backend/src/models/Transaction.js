
const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['cash_in', 'cash_out'],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Transaction amount must be greater than zero'],
    },

    category: {
      type: String,
      required: true,
      // Sale, Purchase, Expense, Investment, Withdrawal
    },

    reference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'refModel',
    },

    refModel: {
      type: String,
      enum: ['Sale', 'Purchase', 'Expense', 'Investor'],
    },

    // Unique investor contribution subdocument ID
    contributionId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);
