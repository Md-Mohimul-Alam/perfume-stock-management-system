const mongoose = require('mongoose');

const Order = require('../models/Order');
const Product = require('../models/Product');
const Sale = require('../models/Sale');

const {
  deductRawMaterial,
  deductBottle,
} = require('../services/inventoryService');

const BLEND_TOLERANCE = 0.01;
const MAX_NUMBER_RETRIES = 3;

/* ========================================
   ERROR HELPERS
======================================== */

const createError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
};

const sendError = (
  res,
  error
) => {
  console.error(
    'Order controller error:',
    error
  );

  if (
    error?.code === 11000
  ) {
    return res
      .status(409)
      .json({
        message:
          'Order or invoice number already exists',
      });
  }

  if (
    error?.name === 'CastError'
  ) {
    return res
      .status(400)
      .json({
        message:
          'Invalid ID',
      });
  }

  const message =
    error?.message ||
    'Order operation failed';

  let status =
    error?.statusCode ||
    500;

  if (
    !error?.statusCode &&
    /not found/i.test(message)
  ) {
    status = 404;
  }

  if (
    !error?.statusCode &&
    /invalid|insufficient|required|must|not available|stock|blend/i.test(
      message
    )
  ) {
    status = 400;
  }

  return res
    .status(status)
    .json({
      message,
    });
};

/* ========================================
   NUMBER HELPERS
======================================== */

const toNumber = (
  value,
  label
) => {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    throw createError(
      `${label} must be a valid number`
    );
  }

  return parsed;
};

const positiveNumber = (
  value,
  label
) => {
  const parsed =
    toNumber(
      value,
      label
    );

  if (parsed <= 0) {
    throw createError(
      `${label} must be greater than 0`
    );
  }

  return parsed;
};

const positiveInteger = (
  value,
  label
) => {
  const parsed =
    positiveNumber(
      value,
      label
    );

  if (
    !Number.isInteger(parsed)
  ) {
    throw createError(
      `${label} must be a whole number`
    );
  }

  return parsed;
};

const roundMoney = (
  value
) => {
  return Math.round(
    (Number(value) +
      Number.EPSILON) *
      100
  ) / 100;
};

const getId = (
  value
) => {
  return value?._id ||
    value ||
    null;
};

/* ========================================
   SERVER PRICING CONFIG
======================================== */

/*
  IMPORTANT:

  Never trust:
  - unitPrice
  - subtotal
  - tax
  - shipping
  - totalAmount

  sent by the public client.

  Product prices come from MongoDB.

  Optional server-controlled values:

  ORDER_SHIPPING_FEE=0
  ORDER_TAX_RATE=0

  ORDER_TAX_RATE is percentage.
*/

const getSafeEnvNumber = (
  name,
  fallback = 0
) => {
  const value =
    Number(
      process.env[name]
    );

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    return fallback;
  }

  return value;
};

const getOrderPricingConfig =
  () => {
    return {
      shippingFee:
        getSafeEnvNumber(
          'ORDER_SHIPPING_FEE',
          0
        ),

      taxRate:
        getSafeEnvNumber(
          'ORDER_TAX_RATE',
          0
        ),
    };
  };

/* ========================================
   PRODUCT HELPERS
======================================== */

const getSizeVariant = (
  product,
  sizeMl
) => {
  return product.sizes?.find(
    (size) =>
      Number(size.sizeMl) ===
      Number(sizeMl)
  );
};

const getSizeBlend = (
  product,
  sizeMl
) => {
  const size =
    getSizeVariant(
      product,
      sizeMl
    );

  if (
    size?.blendComponents &&
    size.blendComponents.length > 0
  ) {
    return size.blendComponents;
  }

  return (
    product.blendComponents ||
    []
  );
};

const getRollOnOilMlPerUnit = (
  sizeVariant
) => {
  const configured =
    Number(
      sizeVariant?.oilMlUsed
    );

  if (
    Number.isFinite(configured) &&
    configured > 0
  ) {
    return configured;
  }

  return positiveNumber(
    sizeVariant?.sizeMl,
    'Roll-on size'
  );
};

/* ========================================
   BLEND VALIDATION
======================================== */

const assertProductHasBlend = (
  product,
  sizeMl
) => {
  if (
    product.type ===
    'roll-on'
  ) {
    if (
      !getId(
        product.baseOil
      )
    ) {
      throw createError(
        `Product "${product.name}" has no base oil configured`
      );
    }

    return;
  }

  if (
    product.type !==
    'spray'
  ) {
    throw createError(
      `Unsupported product type "${product.type}"`
    );
  }

  const components =
    getSizeBlend(
      product,
      sizeMl
    );

  if (!components.length) {
    throw createError(
      `Product "${product.name}" ${sizeMl}ml has no blend configured`
    );
  }

  const totalPercentage =
    components.reduce(
      (total, component) =>
        total +
        Number(
          component.percentage ||
          0
        ),
      0
    );

  if (
    Math.abs(
      totalPercentage - 100
    ) >
    BLEND_TOLERANCE
  ) {
    throw createError(
      `Product "${product.name}" ${sizeMl}ml blend totals ${totalPercentage}% instead of 100%`
    );
  }

  for (
    const component of
    components
  ) {
    const percentage =
      Number(
        component.percentage ||
        0
      );

    if (
      percentage <= 0
    ) {
      continue;
    }

    if (
      !getId(
        component.material
      )
    ) {
      throw createError(
        `Product "${product.name}" has a blend component without a material`
      );
    }
  }
};

/* ========================================
   CUSTOMER VALIDATION
======================================== */

const normalizeCustomer = (
  customer
) => {
  if (!customer) {
    throw createError(
      'Customer information is required'
    );
  }

  const name =
    String(
      customer.name || ''
    ).trim();

  const mobile =
    String(
      customer.mobile || ''
    ).trim();

  const address =
    String(
      customer.address || ''
    ).trim();

  const city =
    String(
      customer.city || ''
    ).trim();

  if (
    !name ||
    !mobile ||
    !address ||
    !city
  ) {
    throw createError(
      'Customer name, mobile, address and city are required'
    );
  }

  if (
    name.length > 120
  ) {
    throw createError(
      'Customer name is too long'
    );
  }

  if (
    mobile.length > 30
  ) {
    throw createError(
      'Mobile number is too long'
    );
  }

  if (
    address.length > 500
  ) {
    throw createError(
      'Address is too long'
    );
  }

  if (
    city.length > 120
  ) {
    throw createError(
      'City is too long'
    );
  }

  return {
    name,
    mobile,
    address,
    city,
  };
};

/* ========================================
   ORDER NUMBER
======================================== */

const generateOrderNo =
  async () => {
    const last =
      await Order.findOne(
        {
          orderNo:
            /^ORD-\d+$/,
        },
        {
          orderNo: 1,
        }
      )
        .sort({
          createdAt: -1,
        })
        .lean();

    let next = 1;

    if (
      last?.orderNo
    ) {
      const match =
        last.orderNo.match(
          /^ORD-(\d+)$/
        );

      if (match) {
        next =
          Number(match[1]) +
          1;
      }
    }

    return `ORD-${String(
      next
    ).padStart(4, '0')}`;
  };

/* ========================================
   SALE INVOICE NUMBER
======================================== */

const generateSaleInvoiceNo =
  async (session) => {
    const last =
      await Sale.findOne(
        {
          invoiceNo:
            /^INV-\d+$/,
        },
        {
          invoiceNo: 1,
        }
      )
        .sort({
          createdAt: -1,
        })
        .session(
          session
        )
        .lean();

    let next = 1;

    if (
      last?.invoiceNo
    ) {
      const match =
        last.invoiceNo.match(
          /^INV-(\d+)$/
        );

      if (match) {
        next =
          Number(match[1]) +
          1;
      }
    }

    return `INV-${String(
      next
    ).padStart(4, '0')}`;
  };

/* ========================================
   CREATE PUBLIC ORDER ITEMS

   SECURITY:
   Prices are fetched from Product.sizes.
======================================== */

const preparePublicOrderItems =
  async (items) => {
    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      throw createError(
        'At least one order item is required'
      );
    }

    const processedItems =
      [];

    for (
      let index = 0;
      index < items.length;
      index += 1
    ) {
      const item =
        items[index];

      if (
        !item?.product ||
        !mongoose.isValidObjectId(
          item.product
        )
      ) {
        throw createError(
          `Item ${index + 1} requires a valid product ID`
        );
      }

      const sizeMl =
        positiveNumber(
          item.sizeMl,
          `Item ${index + 1} size`
        );

      const quantity =
        positiveInteger(
          item.quantity,
          `Item ${index + 1} quantity`
        );

      /*
        Load trusted product information
        directly from database.
      */

      const product =
        await Product.findById(
          item.product
        );

      if (!product) {
        throw createError(
          `Product ${item.product} not found`,
          404
        );
      }

      if (
        product.isActive ===
        false
      ) {
        throw createError(
          `"${product.name}" is currently unavailable`
        );
      }

      /*
        This endpoint belongs to the
        client-facing store.
      */

      if (
        product.showOnClient ===
        false
      ) {
        throw createError(
          `"${product.name}" is not available for online ordering`
        );
      }

      if (
        product.isStockOut
      ) {
        throw createError(
          `"${product.name}" is currently out of stock`
        );
      }

      const sizeVariant =
        getSizeVariant(
          product,
          sizeMl
        );

      if (!sizeVariant) {
        throw createError(
          `${sizeMl}ml size is not available for "${product.name}"`
        );
      }

      /*
        DO NOT use item.unitPrice.

        This price comes directly from
        Product.sizes.sellingPrice.
      */

      const unitPrice =
        Number(
          sizeVariant.sellingPrice
        );

      if (
        !Number.isFinite(
          unitPrice
        ) ||
        unitPrice < 0
      ) {
        throw createError(
          `Invalid selling price configured for "${product.name}" ${sizeMl}ml`
        );
      }

      const totalPrice =
        roundMoney(
          unitPrice *
          quantity
        );

      processedItems.push({
        product:
          product._id,

        name:
          product.name,

        sizeMl,

        quantity,

        unitPrice,

        totalPrice,
      });
    }

    return processedItems;
  };

/* ========================================
   CREATE ORDER
======================================== */

exports.createOrder =
  async (req, res) => {
    try {
      const customer =
        normalizeCustomer(
          req.body?.customer
        );

      const processedItems =
        await preparePublicOrderItems(
          req.body?.items
        );

      /*
        Server calculates subtotal.
      */

      const subtotal =
        roundMoney(
          processedItems.reduce(
            (total, item) =>
              total +
              item.totalPrice,
            0
          )
        );

      /*
        Server-controlled pricing config.

        Client cannot decide tax/shipping.
      */

      const {
        shippingFee,
        taxRate,
      } =
        getOrderPricingConfig();

      const tax =
        roundMoney(
          subtotal *
          (taxRate / 100)
        );

      const shipping =
        roundMoney(
          shippingFee
        );

      const totalAmount =
        roundMoney(
          subtotal +
          tax +
          shipping
        );

      /*
        Retry if simultaneous requests
        generate the same ORD number.
      */

      for (
        let attempt = 1;
        attempt <=
        MAX_NUMBER_RETRIES;
        attempt += 1
      ) {
        try {
          const orderNo =
            await generateOrderNo();

          const order =
            await Order.create({
              orderNo,

              customer,

              items:
                processedItems,

              subtotal,

              tax,

              shipping,

              totalAmount,

              notes:
                String(
                  req.body
                    ?.notes ||
                    ''
                )
                  .trim()
                  .slice(
                    0,
                    1000
                  ),

              status:
                'pending',

              source:
                'client-site',
            });

          return res
            .status(201)
            .json({
              message:
                'Order placed successfully',

              orderNo:
                order.orderNo,

              order,
            });
        } catch (error) {
          if (
            error?.code ===
              11000 &&
            attempt <
              MAX_NUMBER_RETRIES
          ) {
            continue;
          }

          throw error;
        }
      }

      throw createError(
        'Could not generate a unique order number',
        409
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* ========================================
   GET ORDERS
======================================== */

exports.getOrders =
  async (req, res) => {
    try {
      const {
        status,
      } = req.query;

      const filter = {};

      if (status) {
        if (
          ![
            'pending',
            'placed',
            'cancelled',
          ].includes(
            status
          )
        ) {
          throw createError(
            'Invalid order status'
          );
        }

        filter.status =
          status;
      }

      const orders =
        await Order.find(
          filter
        )
          .populate(
            'items.product',
            'name sku type isActive showOnClient isStockOut'
          )
          .populate(
            'saleId',
            'invoiceNo totalAmount paymentStatus'
          )
          .sort({
            createdAt: -1,
          });

      return res.json(
        orders
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* ========================================
   GET SINGLE ORDER
======================================== */

exports.getOrderById =
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(
          req.params.id
        )
      ) {
        throw createError(
          'Invalid order ID'
        );
      }

      const order =
        await Order.findById(
          req.params.id
        )
          .populate(
            'items.product',
            'name sku type isActive'
          )
          .populate(
            'saleId',
            'invoiceNo totalAmount paymentStatus'
          );

      if (!order) {
        throw createError(
          'Order not found',
          404
        );
      }

      return res.json(
        order
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* ========================================
   UPDATE ORDER STATUS
======================================== */

exports.updateOrderStatus =
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(
          req.params.id
        )
      ) {
        throw createError(
          'Invalid order ID'
        );
      }

      const status =
        req.body?.status;

      if (
        ![
          'pending',
          'placed',
          'cancelled',
        ].includes(status)
      ) {
        throw createError(
          'Invalid order status'
        );
      }

      const order =
        await Order.findById(
          req.params.id
        );

      if (!order) {
        throw createError(
          'Order not found',
          404
        );
      }

      /*
        If order already created a Sale,
        keep the order marked placed.

        Otherwise Sale and inventory
        records would become inconsistent.
      */

      if (
        order.saleId &&
        status !==
          'placed'
      ) {
        throw createError(
          'This order is already connected to a sale and must remain placed'
        );
      }

      /*
        Do not manually mark an order as
        placed without creating the Sale.

        Use POST /orders/:id/place instead.
      */

      if (
        status === 'placed' &&
        !order.saleId
      ) {
        throw createError(
          'Use the Place Order action to convert this order into a sale'
        );
      }

      order.status =
        status;

      await order.save();

      return res.json({
        message:
          `Order marked as ${status}`,

        order,
      });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* ========================================
   PREPARE ORDER FOR SALE
======================================== */

const prepareOrderSaleItems =
  async ({
    order,
    session,
  }) => {
    const preparedItems =
      [];

    let totalAmount = 0;

    for (
      let index = 0;
      index <
      order.items.length;
      index += 1
    ) {
      const orderItem =
        order.items[index];

      const productId =
        getId(
          orderItem.product
        );

      /*
        Old orders may have been created
        without a product reference.

        We cannot safely deduct stock from
        those orders automatically.
      */

      if (
        !productId ||
        !mongoose.isValidObjectId(
          productId
        )
      ) {
        throw createError(
          `Order item "${orderItem.name}" does not have a valid product reference`
        );
      }

      const product =
        await Product.findById(
          productId
        )
          .populate(
            'sizes.bottle'
          )
          .session(
            session
          );

      if (!product) {
        throw createError(
          `Product "${orderItem.name}" not found`,
          404
        );
      }

      const sizeMl =
        positiveNumber(
          orderItem.sizeMl,
          `Item ${index + 1} size`
        );

      const quantity =
        positiveInteger(
          orderItem.quantity,
          `Item ${index + 1} quantity`
        );

      const sizeVariant =
        getSizeVariant(
          product,
          sizeMl
        );

      if (!sizeVariant) {
        throw createError(
          `${sizeMl}ml size is no longer available for "${product.name}"`
        );
      }

      assertProductHasBlend(
        product,
        sizeMl
      );

      const bottleId =
        getId(
          sizeVariant.bottle
        );

      if (!bottleId) {
        throw createError(
          `Bottle is not configured for "${product.name}" ${sizeMl}ml`
        );
      }

      /*
        Use the trusted price stored
        on the order.

        New orders store a price that
        was already fetched from MongoDB.
      */

      const unitPrice =
        Number(
          orderItem.unitPrice
        );

      if (
        !Number.isFinite(
          unitPrice
        ) ||
        unitPrice < 0
      ) {
        throw createError(
          `Invalid stored price for "${product.name}"`
        );
      }

      const totalPrice =
        roundMoney(
          unitPrice *
          quantity
        );

      totalAmount +=
        totalPrice;

      preparedItems.push({
        product,

        sizeVariant,

        sizeMl,

        quantity,

        saleItem: {
          product:
            product._id,

          sizeMl,

          quantity,

          unitPrice,

          totalPrice,
        },
      });
    }

    return {
      preparedItems,

      totalAmount:
        roundMoney(
          totalAmount
        ),
    };
  };

/* ========================================
   DEDUCT ORDER INVENTORY
======================================== */

const deductOrderInventory =
  async ({
    preparedItems,
    sale,
    session,
  }) => {
    for (
      const item of
      preparedItems
    ) {
      const {
        product,
        sizeVariant,
        sizeMl,
        quantity,
      } = item;

      /* --------------------------------
         ROLL-ON
      -------------------------------- */

      if (
        product.type ===
        'roll-on'
      ) {
        const oilPerUnit =
          getRollOnOilMlPerUnit(
            sizeVariant
          );

        await deductRawMaterial(
          getId(
            product.baseOil
          ),

          oilPerUnit *
            quantity,

          'sale',

          sale,

          session
        );
      }

      /* --------------------------------
         SPRAY
      -------------------------------- */

      if (
        product.type ===
        'spray'
      ) {
        const components =
          getSizeBlend(
            product,
            sizeMl
          );

        for (
          const component of
          components
        ) {
          const percentage =
            Number(
              component.percentage ||
                0
            );

          if (
            percentage <= 0
          ) {
            continue;
          }

          const materialId =
            getId(
              component.material
            );

          const mlUsed =
            sizeMl *
            (percentage /
              100) *
            quantity;

          if (
            mlUsed <= 0
          ) {
            continue;
          }

          await deductRawMaterial(
            materialId,

            mlUsed,

            'sale',

            sale,

            session
          );
        }
      }

      /* --------------------------------
         BOTTLE
      -------------------------------- */

      await deductBottle(
        getId(
          sizeVariant.bottle
        ),

        quantity,

        'sale',

        sale,

        session
      );
    }
  };

/* ========================================
   CONVERT ORDER TO SALE
======================================== */

exports.convertOrderToSale =
  async (req, res) => {
    for (
      let attempt = 1;
      attempt <=
      MAX_NUMBER_RETRIES;
      attempt += 1
    ) {
      const session =
        await mongoose.startSession();

      try {
        session.startTransaction();

        if (
          !mongoose.isValidObjectId(
            req.params.id
          )
        ) {
          throw createError(
            'Invalid order ID'
          );
        }

        const order =
          await Order.findById(
            req.params.id
          ).session(
            session
          );

        if (!order) {
          throw createError(
            'Order not found',
            404
          );
        }

        if (
          order.saleId
        ) {
          throw createError(
            'This order has already been converted to a sale'
          );
        }

        if (
          order.status ===
          'cancelled'
        ) {
          throw createError(
            'A cancelled order cannot be converted to a sale'
          );
        }

        const {
          preparedItems,
          totalAmount,
        } =
          await prepareOrderSaleItems({
            order,
            session,
          });

        const invoiceNo =
          await generateSaleInvoiceNo(
            session
          );

        /*
          Create Sale first inside
          transaction.

          Online orders remain due until
          payment is collected.
        */

        const [sale] =
          await Sale.create(
            [
              {
                invoiceNo,

                channel:
                  'Online Order',

                items:
                  preparedItems.map(
                    (item) =>
                      item.saleItem
                  ),

                totalAmount,

                saleDate:
                  new Date(),

                paymentStatus:
                  'due',

                notes:
                  `Order ${order.orderNo} – ${order.customer.name} (${order.customer.mobile})`,
              },
            ],
            {
              session,
            }
          );

        /*
          Deduct stock.

          Exact inventory logs receive
          sale._id immediately.
        */

        await deductOrderInventory(
          {
            preparedItems,

            sale,

            session,
          }
        );

        /*
          No cash transaction is created
          here because paymentStatus = due.

          saleController.updatePayment()
          creates cash_in when marked paid.
        */

        order.status =
          'placed';

        order.saleId =
          sale._id;

        await order.save({
          session,
        });

        await session.commitTransaction();

        return res.json({
          message:
            `Order ${order.orderNo} placed successfully. Sale ${invoiceNo} created.`,

          sale,

          order,
        });
      } catch (error) {
        await session.abortTransaction();

        /*
          Sequential invoice collision:
          retry entire transaction.

          All stock deductions from the
          failed attempt are rolled back.
        */

        if (
          error?.code ===
            11000 &&
          attempt <
            MAX_NUMBER_RETRIES
        ) {
          continue;
        }

        return sendError(
          res,
          error
        );
      } finally {
        session.endSession();
      }
    }

    return res
      .status(409)
      .json({
        message:
          'Could not generate a unique sale invoice. Please try again.',
      });
  };

/* ========================================
   DELETE ORDER
======================================== */

exports.deleteOrder =
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(
          req.params.id
        )
      ) {
        throw createError(
          'Invalid order ID'
        );
      }

      const order =
        await Order.findById(
          req.params.id
        );

      if (!order) {
        throw createError(
          'Order not found',
          404
        );
      }

      if (
        order.saleId
      ) {
        throw createError(
          'Cannot delete an order already converted to a sale. Delete/reverse the sale first.'
        );
      }

      await order.deleteOne();

      return res.json({
        message:
          'Order deleted successfully',
      });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };