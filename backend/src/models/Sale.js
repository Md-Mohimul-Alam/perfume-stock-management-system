const mongoose = require('mongoose');

const saleItemSchema = mongoose.Schema(
  {
    /*
      PRODUCT:
        Normal perfume / roll-on sale.

      BOTTLE:
        Empty bottle sold directly.
    */

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
  },
  {
    _id: true,
  }
);

/* ========================================
   ITEM VALIDATION
======================================== */

saleItemSchema.path(
  'product'
).validate({
  validator: function (
    value
  ) {
    const itemType =
      this.itemType ||
      'product';

    /*
      Bottle sale does not require product.
    */

    if (
      itemType ===
      'bottle'
    ) {
      return true;
    }

    /*
      Product sale requires product.
    */

    return Boolean(
      value
    );
  },

  message:
    'Product is required for a product sale',
});

saleItemSchema.path(
  'bottle'
).validate({
  validator: function (
    value
  ) {
    const itemType =
      this.itemType ||
      'product';

    /*
      Normal product sale does not need
      direct bottle reference.
    */

    if (
      itemType ===
      'product'
    ) {
      return true;
    }

    /*
      Direct bottle sale requires bottle.
    */

    return Boolean(
      value
    );
  },

  message:
    'Bottle is required for a bottle sale',
});

/* ========================================
   SALE SCHEMA
======================================== */

const saleSchema =
  mongoose.Schema(
    {
      invoiceNo: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },

      channel: {
        type: String,
        required: true,
        trim: true,
      },

      items: {
        type: [
          saleItemSchema,
        ],

        validate: {
          validator(
            items
          ) {
            return (
              Array.isArray(
                items
              ) &&
              items.length >
                0
            );
          },

          message:
            'At least one sale item is required',
        },
      },

      totalAmount: {
        type: Number,
        required: true,
        min: 0,
      },

      paymentStatus: {
        type: String,
        enum: [
          'paid',
          'due',
        ],
        default: 'paid',
      },

      saleDate: {
        type: Date,
        default:
          Date.now,
      },

      notes: {
        type: String,
        default: '',
      },
    },
    {
      timestamps:
        true,
    }
  );

module.exports =
  mongoose.model(
    'Sale',
    saleSchema
  );