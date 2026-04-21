const mongoose = require('mongoose');

const expenseSchema = mongoose.Schema(
  {
    category: { type: String, required: true }, // e.g., Rent, Delivery, Printing, Event, Wastage
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    description: String,
    reference: String, // optional invoice/event name
  },
  { timestamps: true }
);

module.exports = mongoose.model('Expense', expenseSchema);