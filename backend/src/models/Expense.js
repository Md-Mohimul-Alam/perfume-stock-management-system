const mongoose = require('mongoose');

const expenseSchema = mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['regular', 'event'],
      default: 'regular',
      required: true,
    },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    description: String,
    reference: String, // invoice or event name

    // Event-specific fields
    term: { type: String }, // e.g., Fair1, Fair2, etc.
    stallRent: { type: Number, default: 0 },
    otherCosts: { type: Number, default: 0 },
    eventTotal: { type: Number, default: 0 },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Expense', expenseSchema);