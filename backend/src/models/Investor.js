const mongoose = require('mongoose');

const contributionSchema = mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  type: { type: String, enum: ['investment', 'withdrawal'], required: true },
  date: { type: Date, default: Date.now },
  notes: String,
});

const investorSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    contributions: [contributionSchema],
  },
  { timestamps: true }
);

// Virtual for net contribution (investment - withdrawal)
investorSchema.virtual('netContribution').get(function () {
  return this.contributions.reduce((sum, c) => {
    return c.type === 'investment' ? sum + c.amount : sum - c.amount;
  }, 0);
});

// Ensure virtuals are included in JSON
investorSchema.set('toJSON', { virtuals: true });
investorSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Investor', investorSchema);