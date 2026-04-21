const mongoose = require('mongoose');

const manualAdjustmentSchema = mongoose.Schema(
  {
    reason: { type: String, required: true },
    items: [
      {
        material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
        bottle: { type: mongoose.Schema.Types.ObjectId, ref: 'Bottle' },
        adjustmentQuantity: { type: Number, required: true }, // positive = add, negative = remove
        notes: String,
      },
    ],
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ManualAdjustment', manualAdjustmentSchema);