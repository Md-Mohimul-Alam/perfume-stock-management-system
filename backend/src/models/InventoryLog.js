const mongoose = require('mongoose');

const inventoryLogSchema = mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
    bottle: { type: mongoose.Schema.Types.ObjectId, ref: 'Bottle' },
    changeQuantity: { type: Number, required: true }, // positive for addition, negative for deduction
    reason: { type: String, enum: ['purchase', 'sale', 'production', 'adjustment', 'wastage'], required: true },
    reference: { type: mongoose.Schema.Types.ObjectId, refPath: 'refModel' },
    refModel: { type: String, enum: ['Purchase', 'Sale', 'Production', 'ManualAdjustment'] },
    date: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);