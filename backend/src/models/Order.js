const mongoose = require('mongoose');

/* ========================================
   ORDER ITEM
======================================== */

const orderItemSchema = mongoose.Schema({
  itemType: {
    type: String,
    enum: [
      'product',
      'bottle',
    ],
    default: 'product',
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
  },

  bottle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bottle',
    default: null,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  sizeMl: {
    type: Number,
    required: true,
    min: 0.1,
  },

  quantity: {
    type: Number,
    required: true,
    min: 1,
  },

  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },

  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

/* ========================================
   ORDER
======================================== */

const orderSchema = mongoose.Schema(
  {
    orderNo: {
      type: String,
      required: true,
      unique: true,
    },

    customer: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      mobile: {
        type: String,
        required: true,
        trim: true,
      },

      address: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },
    },

    items: {
      type: [
        orderItemSchema,
      ],

      validate: {
        validator: (
          items
        ) =>
          Array.isArray(
            items
          ) &&
          items.length >
            0,

        message:
          'Order must contain at least one item',
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    tax: {
      type: Number,
      default: 0,
      min: 0,
    },

    shipping: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,

      enum: [
        'pending',
        'placed',
        'cancelled',
      ],

      default:
        'pending',
    },

    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      default: null,
    },

    notes: {
      type: String,
      default: '',
    },

    source: {
      type: String,
      default:
        'client-site',
    },
  },

  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model(
    'Order',
    orderSchema
  );