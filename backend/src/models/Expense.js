const mongoose = require('mongoose');

const expenseSchema = mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['regular', 'event'],
      default: 'regular',
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    description: String,
    reference: String,

    // Used by material wastage expenses. Null for ordinary expenses.
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RawMaterial',
      default: null,
    },
    quantityMl: {
      type: Number,
      min: 0,
      default: null,
    },

    // Event-specific fields
    term: String,
    stallRent: { type: Number, default: 0, min: 0 },
    otherCosts: { type: Number, default: 0, min: 0 },
    eventTotal: { type: Number, default: 0, min: 0 },
    notes: String,
  },
  { timestamps: true }
);

expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ material: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);