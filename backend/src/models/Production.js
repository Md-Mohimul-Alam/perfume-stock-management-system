const mongoose = require('mongoose');

const productionItemSchema = mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  sizeMl: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
});

const productionSchema = mongoose.Schema(
  {
    batchNo: { type: String, required: true, unique: true },
    items: [productionItemSchema],
    status: { type: String, enum: ['planned', 'in_progress', 'completed', 'cancelled'], default: 'planned' },
    productionDate: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Production', productionSchema);