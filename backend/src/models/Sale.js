const mongoose = require('mongoose');

const saleItemSchema = mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  sizeMl: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
});

const saleSchema = mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    channel: {
      type: String,
      enum: ['Fair1', 'Fair2', 'Fair3', 'Fair4', 'Fair5', 'August', 'September', 'October', 'November', 'December', 'Online', 'Other'],
      required: true,
    },
    items: [saleItemSchema],
    totalAmount: { type: Number, required: true },
    paymentStatus: { type: String, enum: ['paid', 'due'], default: 'paid' },
    saleDate: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sale', saleSchema);