const mongoose = require('mongoose');

const inventoryLogSchema = mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RawMaterial',
      default: null,
    },
    bottle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bottle',
      default: null,
    },
    changeQuantity: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      enum: ['purchase', 'sale', 'production', 'adjustment', 'wastage'],
      required: true,
    },
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'refModel',
      default: null,
    },
    refModel: {
      type: String,
      enum: [
        'Purchase',
        'Sale',
        'Production',
        'ManualAdjustment',
        'Expense',
      ],
      default: null,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: String,
  },
  { timestamps: true }
);

inventoryLogSchema.index({ material: 1, date: -1 });
inventoryLogSchema.index({ reference: 1, refModel: 1 });

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);