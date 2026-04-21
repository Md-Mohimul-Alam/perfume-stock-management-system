const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema(
  {
    type: { type: String, enum: ['cash_in', 'cash_out'], required: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true }, // Sale, Purchase, Expense, Investment, Withdrawal
    reference: { type: mongoose.Schema.Types.ObjectId, refPath: 'refModel' },
    refModel: { type: String, enum: ['Sale', 'Purchase', 'Expense', 'Investor'] },
    date: { type: Date, default: Date.now },
    description: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);