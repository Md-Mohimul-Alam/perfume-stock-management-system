const mongoose = require('mongoose');

const orderItemSchema = mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  sizeMl: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
});

const orderSchema = mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    customer: {
      name: { type: String, required: true },
      mobile: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
    },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'placed', 'cancelled'],
      default: 'pending',
    },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    notes: String,
    source: { type: String, default: 'client-site' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);