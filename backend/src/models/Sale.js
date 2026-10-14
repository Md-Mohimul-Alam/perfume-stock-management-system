const mongoose = require('mongoose');

const saleItemSchema = mongoose.Schema({
  /*
    PRODUCT:
      Normal perfume / roll-on sale.

    BOTTLE:
      Empty bottle sold directly to customer.

    Existing old sales that do not have
    itemType are treated as "product"
    by the controller.
  */
  itemType: {
    type: String,
    enum: ['product', 'bottle'],
    default: 'product',
  },

  /*
    Used for perfume sales.
    Optional because direct bottle sales
    do not have a Product.
  */
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
  },

  /*
    Used for direct empty-bottle sales.

    Normal perfume sales can leave this
    empty because the Product size already
    knows which bottle it uses.
  */
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
});

/*
  Validate item according to its type.
*/
saleItemSchema.pre(
  'validate',
  function validateSaleItem(next) {
    const itemType =
      this.itemType || 'product';

    if (
      itemType === 'product' &&
      !this.product
    ) {
      return next(
        new Error(
          'Product is required for a product sale'
        )
      );
    }

    if (
      itemType === 'bottle' &&
      !this.bottle
    ) {
      return next(
        new Error(
          'Bottle is required for a bottle sale'
        )
      );
    }

    return next();
  }
);

const saleSchema = mongoose.Schema(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
    },

    channel: {
      type: String,
      required: true,
    },

    items: {
      type: [saleItemSchema],
      validate: {
        validator(items) {
          return (
            Array.isArray(items) &&
            items.length > 0
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
      enum: ['paid', 'due'],
      default: 'paid',
    },

    saleDate: {
      type: Date,
      default: Date.now,
    },

    notes: String,
  },

  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model(
    'Sale',
    saleSchema
  );