const mongoose = require('mongoose');

const purchaseItemSchema = mongoose.Schema({
  itemType: { type: String, enum: ['RawMaterial', 'Bottle'], required: true },
  item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'items.itemType' },
  quantity: { type: Number, required: true }, // ml for material, pcs for bottle
  costPerUnit: { type: Number, required: true },
  totalCost: { type: Number, required: true },
});

const purchaseSchema = mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    supplier: String,
    items: [purchaseItemSchema],
    totalAmount: { type: Number, required: true },
    purchaseDate: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Purchase', purchaseSchema);