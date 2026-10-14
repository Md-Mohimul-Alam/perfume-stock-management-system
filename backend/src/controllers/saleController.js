const mongoose = require('mongoose');

const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');
const Bottle = require('../models/Bottle');
const RawMaterial = require('../models/RawMaterial');

const {
  deductRawMaterial,
  deductBottle,
} = require('../services/inventoryService');

const BLEND_TOLERANCE = 0.01;
const MAX_INVOICE_RETRIES = 3;

/* ========================================
   HELPERS
======================================== */

const getId = (value) => {
  return value?._id || value || null;
};

const toNumber = (
  value,
  label
) => {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    const error =
      new Error(
        `${label} must be a valid number`
      );

    error.statusCode =
      400;

    throw error;
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

  if (
    parsed <= 0
  ) {
    const error =
      new Error(
        `${label} must be greater than 0`
      );

    error.statusCode =
      400;

    throw error;
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
    !Number.isInteger(
      parsed
    )
  ) {
    const error =
      new Error(
        `${label} must be a whole number`
      );

    error.statusCode =
      400;

    throw error;
  }

  return parsed;
};

const nonNegativeNumber = (
  value,
  label
) => {
  const parsed =
    toNumber(
      value,
      label
    );

  if (
    parsed < 0
  ) {
    const error =
      new Error(
        `${label} cannot be negative`
      );

    error.statusCode =
      400;

    throw error;
  }

  return parsed;
};

const normalizeItemType = (
  value
) => {
  /*
    Old sales do not contain itemType.
    Treat them as normal Product sales.
  */

  const itemType =
    String(
      value || 'product'
    )
      .trim()
      .toLowerCase();

  if (
    ![
      'product',
      'bottle',
    ].includes(
      itemType
    )
  ) {
    const error =
      new Error(
        'Sale item type must be product or bottle'
      );

    error.statusCode =
      400;

    throw error;
  }

  return itemType;
};

/* ========================================
   PRODUCT SIZE / BLEND
======================================== */

const getSizeVariant = (
  product,
  sizeMl
) => {
  return product.sizes?.find(
    (size) =>
      Number(
        size.sizeMl
      ) ===
      Number(
        sizeMl
      )
  );
};

const getSizeBlend = (
  product,
  sizeMl
) => {
  const sizeVariant =
    getSizeVariant(
      product,
      sizeMl
    );

  if (
    sizeVariant
      ?.blendComponents &&
    sizeVariant
      .blendComponents
      .length > 0
  ) {
    return sizeVariant
      .blendComponents;
  }

  return (
    product
      .blendComponents ||
    []
  );
};

const getRollOnOilMlPerUnit = (
  sizeVariant
) => {
  const configured =
    Number(
      sizeVariant
        ?.oilMlUsed
    );

  if (
    Number.isFinite(
      configured
    ) &&
    configured > 0
  ) {
    return configured;
  }

  return positiveNumber(
    sizeVariant
      ?.sizeMl,
    'Roll-on size'
  );
};

/* ========================================
   PRODUCT VALIDATION
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
      const error =
        new Error(
          `Product "${product.name}" has no base oil configured.`
        );

      error.statusCode =
        400;

      throw error;
    }

    return;
  }

  if (
    product.type !==
    'spray'
  ) {
    const error =
      new Error(
        `Unsupported product type "${product.type}"`
      );

    error.statusCode =
      400;

    throw error;
  }

  const components =
    getSizeBlend(
      product,
      sizeMl
    );

  if (
    !components.length
  ) {
    const error =
      new Error(
        `Product "${product.name}" ${sizeMl}ml has no blend configured.`
      );

    error.statusCode =
      400;

    throw error;
  }

  const totalPercentage =
    components.reduce(
      (
        total,
        component
      ) =>
        total +
        Number(
          component
            .percentage ||
            0
        ),
      0
    );

  if (
    Math.abs(
      totalPercentage -
        100
    ) >
    BLEND_TOLERANCE
  ) {
    const error =
      new Error(
        `Product "${product.name}" ${sizeMl}ml blend totals ${totalPercentage}% instead of 100%.`
      );

    error.statusCode =
      400;

    throw error;
  }

  for (
    const component of
    components
  ) {
    const percentage =
      Number(
        component
          .percentage ||
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
      const error =
        new Error(
          `Product "${product.name}" has a blend component without a material.`
        );

      error.statusCode =
        400;

      throw error;
    }
  }
};

/* ========================================
   GENERAL SALE VALIDATION
======================================== */

const validateChannel = (
  value
) => {
  const channel =
    String(
      value || ''
    ).trim();

  if (!channel) {
    const error =
      new Error(
        'Sales channel is required'
      );

    error.statusCode =
      400;

    throw error;
  }

  return channel;
};

const validatePaymentStatus = (
  value
) => {
  const status =
    value || 'paid';

  if (
    ![
      'paid',
      'due',
    ].includes(
      status
    )
  ) {
    const error =
      new Error(
        'Payment status must be paid or due'
      );

    error.statusCode =
      400;

    throw error;
  }

  return status;
};

const parseSaleDate = (
  value
) => {
  if (!value) {
    return new Date();
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    const error =
      new Error(
        'Invalid sale date'
      );

    error.statusCode =
      400;

    throw error;
  }

  return date;
};

/* ========================================
   ERROR RESPONSE
======================================== */

const sendError = (
  res,
  error
) => {
  console.error(
    'Sale controller error:',
    error
  );

  if (
    error?.code ===
    11000
  ) {
    return res
      .status(409)
      .json({
        message:
          'Invoice number already exists',
      });
  }

  if (
    error?.name ===
    'CastError'
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
    'Sale operation failed';

  let status =
    error?.statusCode ||
    500;

  if (
    !error
      ?.statusCode &&
    /not found/i.test(
      message
    )
  ) {
    status = 404;
  }

  if (
    !error
      ?.statusCode &&
    /insufficient|invalid|required|must|not available|no blend|no base oil|stock/i.test(
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
   INVOICE NUMBER
======================================== */

const getNextInvoiceNo =
  async (
    session
  ) => {
    const lastSale =
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

    let nextNumber =
      1;

    if (
      lastSale
        ?.invoiceNo
    ) {
      const match =
        lastSale.invoiceNo.match(
          /^INV-(\d+)$/
        );

      if (match) {
        nextNumber =
          Number(
            match[1]
          ) + 1;
      }
    }

    return `INV-${String(
      nextNumber
    ).padStart(
      4,
      '0'
    )}`;
  };

/* ========================================
   FIND PRODUCT
======================================== */

const findProductForSale =
  async ({
    productId,
    sku,
    session,
  }) => {
    let query;

    if (productId) {
      if (
        !mongoose
          .isValidObjectId(
            productId
          )
      ) {
        const error =
          new Error(
            `Invalid product ID: ${productId}`
          );

        error.statusCode =
          400;

        throw error;
      }

      query =
        Product.findById(
          productId
        );
    } else {
      const cleanSku =
        String(
          sku || ''
        ).trim();

      if (!cleanSku) {
        const error =
          new Error(
            'Product SKU is required'
          );

        error.statusCode =
          400;

        throw error;
      }

      query =
        Product.findOne({
          sku:
            cleanSku,
        });
    }

    const product =
      await query
        .populate(
          'sizes.bottle'
        )
        .session(
          session
        );

    if (!product) {
      const error =
        new Error(
          productId
            ? `Product ${productId} not found`
            : `Product SKU ${sku} not found`
        );

      error.statusCode =
        404;

      throw error;
    }

    if (
      product.isActive ===
      false
    ) {
      const error =
        new Error(
          `Product "${product.name}" is inactive`
        );

      error.statusCode =
        400;

      throw error;
    }

    return product;
  };

/* ========================================
   FIND BOTTLE
======================================== */

const findBottleForSale =
  async ({
    bottleId,
    sizeMl,
    bottleType,
    session,
  }) => {
    let bottle;

    /*
      Preferred way:
      frontend sends Bottle._id
    */

    if (bottleId) {
      if (
        !mongoose
          .isValidObjectId(
            bottleId
          )
      ) {
        const error =
          new Error(
            `Invalid bottle ID: ${bottleId}`
          );

        error.statusCode =
          400;

        throw error;
      }

      bottle =
        await Bottle.findById(
          bottleId
        ).session(
          session
        );
    } else {
      /*
        Fallback:
        find by size + type.

        Useful for CSV/import or simple
        frontend payloads.
      */

      const cleanSize =
        positiveNumber(
          sizeMl,
          'Bottle size'
        );

      const cleanType =
        String(
          bottleType || ''
        )
          .trim()
          .toLowerCase();

      if (
        ![
          'roll-on',
          'spray',
        ].includes(
          cleanType
        )
      ) {
        const error =
          new Error(
            'Bottle type must be roll-on or spray'
          );

        error.statusCode =
          400;

        throw error;
      }

      bottle =
        await Bottle.findOne(
          {
            sizeMl:
              cleanSize,

            type:
              cleanType,
          }
        ).session(
          session
        );
    }

    if (!bottle) {
      const error =
        new Error(
          'Bottle not found'
        );

      error.statusCode =
        404;

      throw error;
    }

    return bottle;
  };

/* ========================================
   PREPARE PRODUCT ITEM
======================================== */

const prepareProductSaleItem =
  async ({
    item,
    index,
    session,
    lookupBySku,
  }) => {
    const quantity =
      positiveInteger(
        item.quantity,
        `Item ${
          index + 1
        } quantity`
      );

    const sizeMl =
      positiveNumber(
        item.sizeMl,
        `Item ${
          index + 1
        } size`
      );

    const unitPrice =
      nonNegativeNumber(
        item.unitPrice,
        `Item ${
          index + 1
        } price`
      );

    const product =
      await findProductForSale(
        {
          productId:
            lookupBySku
              ? null
              : item.product,

          sku:
            lookupBySku
              ? item.sku
              : null,

          session,
        }
      );

    const sizeVariant =
      getSizeVariant(
        product,
        sizeMl
      );

    if (!sizeVariant) {
      const error =
        new Error(
          `${sizeMl}ml size is not available for "${product.name}"`
        );

      error.statusCode =
        400;

      throw error;
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
      const error =
        new Error(
          `Bottle is not configured for "${product.name}" ${sizeMl}ml`
        );

      error.statusCode =
        400;

      throw error;
    }

    const totalPrice =
      quantity *
      unitPrice;

    return {
      itemType:
        'product',

      product,

      sizeVariant,

      quantity,

      sizeMl,

      unitPrice,

      totalPrice,

      saleItem: {
        itemType:
          'product',

        product:
          product._id,

        bottle:
          null,

        sizeMl,

        quantity,

        unitPrice,

        totalPrice,
      },
    };
  };

/* ========================================
   PREPARE DIRECT BOTTLE ITEM
======================================== */

const prepareBottleSaleItem =
  async ({
    item,
    index,
    session,
  }) => {
    const quantity =
      positiveInteger(
        item.quantity,
        `Item ${
          index + 1
        } quantity`
      );

    const unitPrice =
      nonNegativeNumber(
        item.unitPrice,
        `Item ${
          index + 1
        } price`
      );

    const bottle =
      await findBottleForSale(
        {
          bottleId:
            item.bottle,

          sizeMl:
            item.sizeMl,

          bottleType:
            item.bottleType ||
            item.type,

          session,
        }
      );

    const sizeMl =
      Number(
        bottle.sizeMl
      );

    /*
      Early validation.

      Actual deduction is still atomic
      inside deductBottle().
    */

    const available =
      Number(
        bottle.currentStock ||
          0
      );

    if (
      available <
      quantity
    ) {
      const error =
        new Error(
          `Insufficient bottle stock for ${sizeMl}ml ${bottle.type}. Available: ${available}, needed: ${quantity}`
        );

      error.statusCode =
        400;

      throw error;
    }

    const totalPrice =
      quantity *
      unitPrice;

    return {
      itemType:
        'bottle',

      bottle,

      quantity,

      sizeMl,

      unitPrice,

      totalPrice,

      saleItem: {
        itemType:
          'bottle',

        product:
          null,

        bottle:
          bottle._id,

        sizeMl,

        quantity,

        unitPrice,

        totalPrice,
      },
    };
  };

/* ========================================
   PREPARE SALE ITEMS
======================================== */

const prepareSaleItems =
  async ({
    items,
    session,
    lookupBySku = false,
  }) => {
    if (
      !Array.isArray(
        items
      ) ||
      items.length ===
        0
    ) {
      const error =
        new Error(
          'At least one sale item is required'
        );

      error.statusCode =
        400;

      throw error;
    }

    const preparedItems =
      [];

    let totalAmount =
      0;

    for (
      let index = 0;
      index <
      items.length;
      index += 1
    ) {
      const item =
        items[index];

      const itemType =
        normalizeItemType(
          item.itemType
        );

      let preparedItem;

      if (
        itemType ===
        'bottle'
      ) {
        preparedItem =
          await prepareBottleSaleItem(
            {
              item,
              index,
              session,
            }
          );
      } else {
        preparedItem =
          await prepareProductSaleItem(
            {
              item,
              index,
              session,
              lookupBySku,
            }
          );
      }

      totalAmount +=
        preparedItem.totalPrice;

      preparedItems.push(
        preparedItem
      );
    }

    return {
      preparedItems,

      totalAmount,
    };
  };

/* ========================================
   DEDUCT PRODUCT INVENTORY
======================================== */

const deductProductInventory =
  async ({
    item,
    sale,
    session,
  }) => {
    const {
      product,
      sizeVariant,
      quantity,
      sizeMl,
    } = item;

    /*
      Roll-on product:
      deduct perfume oil.
    */

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

    /*
      Spray product:
      deduct every blend component.
    */

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
            component
              .percentage ||
              0
          );

        if (
          percentage <=
          0
        ) {
          continue;
        }

        const materialId =
          getId(
            component.material
          );

        const mlUsed =
          sizeMl *
          (
            percentage /
            100
          ) *
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

    /*
      Normal perfume sale also
      consumes one bottle per unit.
    */

    await deductBottle(
      getId(
        sizeVariant.bottle
      ),

      quantity,

      'sale',

      sale,

      session
    );
  };

/* ========================================
   DEDUCT DIRECT BOTTLE INVENTORY
======================================== */

const deductDirectBottleInventory =
  async ({
    item,
    sale,
    session,
  }) => {
    /*
      IMPORTANT:

      Direct bottle sale deducts ONLY
      bottle stock.

      It does NOT deduct perfume oil,
      ethanol, fixative or any other
      raw material.
    */

    await deductBottle(
      getId(
        item.bottle
      ),

      item.quantity,

      'sale',

      sale,

      session
    );
  };

/* ========================================
   DEDUCT INVENTORY FOR SALE
======================================== */

const deductInventoryForSale =
  async ({
    preparedItems,
    sale,
    session,
  }) => {
    for (
      const item of
      preparedItems
    ) {
      if (
        item.itemType ===
        'bottle'
      ) {
        await deductDirectBottleInventory(
          {
            item,

            sale,

            session,
          }
        );

        continue;
      }

      await deductProductInventory(
        {
          item,

          sale,

          session,
        }
      );
    }
  };

/* ========================================
   SALE CASH TRANSACTION
======================================== */

const syncSaleCashTransaction =
  async ({
    sale,
    shouldExist,
    session,
  }) => {
    /*
      Exactly one Sale cash entry
      for a paid sale.

      Due sale = no cash transaction.
    */

    await Transaction.deleteMany(
      {
        reference:
          sale._id,

        refModel:
          'Sale',

        category:
          'Sale',
      }
    ).session(
      session
    );

    if (
      !shouldExist
    ) {
      return;
    }

    await Transaction.create(
      [
        {
          type:
            'cash_in',

          amount:
            sale.totalAmount,

          category:
            'Sale',

          reference:
            sale._id,

          refModel:
            'Sale',

          date:
            sale.saleDate,

          description:
            `Sale ${sale.invoiceNo} (${sale.channel})`,
        },
      ],

      {
        session,
      }
    );
  };

/* ========================================
   CREATE SALE INTERNAL
======================================== */

const createSingleSale =
  async ({
    invoiceNo,
    channel,
    items,
    saleDate,
    paymentStatus,
    notes,
    session,
    lookupBySku = false,
  }) => {
    const cleanChannel =
      validateChannel(
        channel
      );

    const cleanPaymentStatus =
      validatePaymentStatus(
        paymentStatus
      );

    const cleanSaleDate =
      parseSaleDate(
        saleDate
      );

    const {
      preparedItems,
      totalAmount,
    } =
      await prepareSaleItems(
        {
          items,

          session,

          lookupBySku,
        }
      );

    /*
      Sale and stock changes happen
      inside one MongoDB transaction.

      If any material or bottle is
      insufficient, everything rolls back.
    */

    const [sale] =
      await Sale.create(
        [
          {
            invoiceNo,

            channel:
              cleanChannel,

            items:
              preparedItems.map(
                (
                  item
                ) =>
                  item.saleItem
              ),

            totalAmount,

            saleDate:
              cleanSaleDate,

            paymentStatus:
              cleanPaymentStatus,

            notes:
              String(
                notes ||
                  ''
              ).trim(),
          },
        ],

        {
          session,
        }
      );

    await deductInventoryForSale(
      {
        preparedItems,

        sale,

        session,
      }
    );

    await syncSaleCashTransaction(
      {
        sale,

        shouldExist:
          cleanPaymentStatus ===
          'paid',

        session,
      }
    );

    return sale;
  };

/* ========================================
   CREATE SALE
======================================== */

exports.createSale =
  async (
    req,
    res
  ) => {
    for (
      let attempt = 1;
      attempt <=
      MAX_INVOICE_RETRIES;
      attempt += 1
    ) {
      const session =
        await mongoose.startSession();

      try {
        session.startTransaction();

        const invoiceNo =
          await getNextInvoiceNo(
            session
          );

        const sale =
          await createSingleSale(
            {
              invoiceNo,

              channel:
                req.body
                  ?.channel,

              items:
                req.body
                  ?.items,

              saleDate:
                req.body
                  ?.saleDate,

              paymentStatus:
                req.body
                  ?.paymentStatus,

              notes:
                req.body
                  ?.notes,

              session,
            }
          );

        await session.commitTransaction();

        const populated =
          await Sale.findById(
            sale._id
          )
            .populate(
              'items.product',
              'name sku type description'
            )
            .populate(
              'items.bottle',
              'sizeMl type currentStock avgCostPerUnit'
            );

        return res
          .status(201)
          .json(
            populated ||
              sale
          );
      } catch (error) {
        await session.abortTransaction();

        if (
          error?.code ===
            11000 &&
          attempt <
            MAX_INVOICE_RETRIES
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
          'Could not generate invoice number. Please try again.',
      });
  };

/* ========================================
   GET SALES
======================================== */

exports.getSales =
  async (
    req,
    res
  ) => {
    try {
      const {
        channel,
        startDate,
        endDate,
        paymentStatus,
      } = req.query;

      const filter = {};

      if (channel) {
        filter.channel =
          channel;
      }

      if (
        paymentStatus
      ) {
        filter.paymentStatus =
          validatePaymentStatus(
            paymentStatus
          );
      }

      if (
        startDate ||
        endDate
      ) {
        filter.saleDate =
          {};

        if (
          startDate
        ) {
          const start =
            new Date(
              startDate
            );

          if (
            Number.isNaN(
              start.getTime()
            )
          ) {
            const error =
              new Error(
                'Invalid start date'
              );

            error.statusCode =
              400;

            throw error;
          }

          filter
            .saleDate
            .$gte =
            start;
        }

        if (
          endDate
        ) {
          const end =
            new Date(
              endDate
            );

          if (
            Number.isNaN(
              end.getTime()
            )
          ) {
            const error =
              new Error(
                'Invalid end date'
              );

            error.statusCode =
              400;

            throw error;
          }

          filter
            .saleDate
            .$lte =
            end;
        }
      }

      const sales =
        await Sale.find(
          filter
        )
          .populate(
            'items.product',
            'name sku type description'
          )
          .populate(
            'items.bottle',
            'sizeMl type currentStock avgCostPerUnit'
          )
          .sort({
            saleDate: -1,

            createdAt: -1,
          });

      return res.json(
        sales
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* ========================================
   GET SINGLE SALE
======================================== */

exports.getSaleById =
  async (
    req,
    res
  ) => {
    try {
      if (
        !mongoose
          .isValidObjectId(
            req.params.id
          )
      ) {
        return res
          .status(400)
          .json({
            message:
              'Invalid sale ID',
          });
      }

      const sale =
        await Sale.findById(
          req.params.id
        )
          .populate(
            'items.product',
            'name sku type description'
          )
          .populate(
            'items.bottle',
            'sizeMl type currentStock avgCostPerUnit'
          );

      if (!sale) {
        return res
          .status(404)
          .json({
            message:
              'Sale not found',
          });
      }

      return res.json(
        sale
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* ========================================
   UPDATE PAYMENT
======================================== */

exports.updatePayment =
  async (
    req,
    res
  ) => {
    const session =
      await mongoose.startSession();

    try {
      session.startTransaction();

      const paymentStatus =
        validatePaymentStatus(
          req.body
            ?.paymentStatus
        );

      const sale =
        await Sale.findById(
          req.params.id
        ).session(
          session
        );

      if (!sale) {
        const error =
          new Error(
            'Sale not found'
          );

        error.statusCode =
          404;

        throw error;
      }

      sale.paymentStatus =
        paymentStatus;

      await sale.save({
        session,
      });

      /*
        paid:
        exactly one cash-in.

        due:
        no cash-in yet.
      */

      await syncSaleCashTransaction(
        {
          sale,

          shouldExist:
            paymentStatus ===
            'paid',

          session,
        }
      );

      await session.commitTransaction();

      return res.json(
        sale
      );
    } catch (error) {
      await session.abortTransaction();

      return sendError(
        res,
        error
      );
    } finally {
      session.endSession();
    }
  };

/* ========================================
   BULK CREATE SALES
======================================== */

exports.bulkCreateSales =
  async (
    req,
    res
  ) => {
    try {
      const sales =
        req.body?.sales;

      if (
        !Array.isArray(
          sales
        ) ||
        sales.length ===
          0
      ) {
        return res
          .status(400)
          .json({
            message:
              'No sales provided',
          });
      }

      const created =
        [];

      const errors =
        [];

      for (
        const saleData of
        sales
      ) {
        const session =
          await mongoose.startSession();

        try {
          session.startTransaction();

          const invoiceNo =
            String(
              saleData
                ?.invoiceNo ||
                ''
            ).trim();

          if (!invoiceNo) {
            const error =
              new Error(
                'Invoice number is required'
              );

            error.statusCode =
              400;

            throw error;
          }

          const existing =
            await Sale.findOne(
              {
                invoiceNo,
              }
            )
              .session(
                session
              )
              .lean();

          if (
            existing
          ) {
            const error =
              new Error(
                `Invoice ${invoiceNo} already exists`
              );

            error.statusCode =
              409;

            throw error;
          }

          const sale =
            await createSingleSale(
              {
                invoiceNo,

                channel:
                  saleData.channel,

                items:
                  saleData.items,

                saleDate:
                  saleData.saleDate,

                paymentStatus:
                  saleData.paymentStatus ||
                  'paid',

                notes:
                  saleData.notes,

                session,

                /*
                  Product bulk import
                  can continue using SKU.

                  Bottle entries can send:
                  itemType: "bottle",
                  sizeMl,
                  bottleType.
                */
                lookupBySku:
                  true,
              }
            );

          await session.commitTransaction();

          created.push(
            sale
          );
        } catch (error) {
          await session.abortTransaction();

          errors.push({
            invoiceNo:
              saleData
                ?.invoiceNo ||
              null,

            error:
              error.message,
          });
        } finally {
          session.endSession();
        }
      }

      return res
        .status(
          created.length
            ? 201
            : 400
        )
        .json({
          message:
            `Created ${created.length} sales, ${errors.length} errors`,

          created,

          errors,
        });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* ========================================
   RESTORE MATERIAL
======================================== */

const restoreMaterial =
  async ({
    materialId,
    quantity,
    session,
  }) => {
    const result =
      await RawMaterial.updateOne(
        {
          _id:
            materialId,
        },

        {
          $inc: {
            currentStockMl:
              quantity,
          },
        },

        {
          session,
        }
      );

    if (
      result.matchedCount ===
      0
    ) {
      const error =
        new Error(
          `Material ${materialId} not found while reversing sale`
        );

      error.statusCode =
        404;

      throw error;
    }
  };

/* ========================================
   RESTORE BOTTLE
======================================== */

const restoreBottle =
  async ({
    bottleId,
    quantity,
    session,
  }) => {
    const result =
      await Bottle.updateOne(
        {
          _id:
            bottleId,
        },

        {
          $inc: {
            currentStock:
              quantity,
          },

          $set: {
            isStockOut:
              false,
          },
        },

        {
          session,
        }
      );

    if (
      result.matchedCount ===
      0
    ) {
      const error =
        new Error(
          `Bottle ${bottleId} not found while reversing sale`
        );

      error.statusCode =
        404;

      throw error;
    }
  };

/* ========================================
   REVERSAL LOG
======================================== */

const createReversalLog =
  async ({
    material,
    bottle,
    quantity,
    invoiceNo,
    session,
  }) => {
    await InventoryLog.create(
      [
        {
          material:
            material ||
            undefined,

          bottle:
            bottle ||
            undefined,

          changeQuantity:
            quantity,

          reason:
            'adjustment',

          reference:
            null,

          notes:
            `Reversal of deleted sale ${invoiceNo}`,
        },
      ],

      {
        session,
      }
    );
  };

/* ========================================
   REVERSE USING EXACT INVENTORY LOGS
======================================== */

const reverseUsingInventoryLogs =
  async ({
    sale,
    logs,
    session,
  }) => {
    /*
      This works for BOTH:

      1. normal perfume sale
      2. direct bottle sale

      because every inventory deduction is
      linked to the Sale through InventoryLog.
    */

    for (
      const log of
      logs
    ) {
      const change =
        Number(
          log.changeQuantity
        );

      if (
        !Number.isFinite(
          change
        ) ||
        change >= 0
      ) {
        continue;
      }

      const quantity =
        Math.abs(
          change
        );

      if (
        log.material
      ) {
        await restoreMaterial(
          {
            materialId:
              log.material,

            quantity,

            session,
          }
        );

        await createReversalLog(
          {
            material:
              log.material,

            quantity,

            invoiceNo:
              sale.invoiceNo,

            session,
          }
        );
      }

      if (
        log.bottle
      ) {
        await restoreBottle(
          {
            bottleId:
              log.bottle,

            quantity,

            session,
          }
        );

        await createReversalLog(
          {
            bottle:
              log.bottle,

            quantity,

            invoiceNo:
              sale.invoiceNo,

            session,
          }
        );
      }
    }
  };

/* ========================================
   REVERSE LEGACY DIRECT BOTTLE ITEM
======================================== */

const reverseLegacyBottleItem =
  async ({
    sale,
    item,
    session,
  }) => {
    const bottleId =
      getId(
        item.bottle
      );

    if (
      !bottleId
    ) {
      const error =
        new Error(
          `Bottle reference missing while reversing ${sale.invoiceNo}`
        );

      error.statusCode =
        400;

      throw error;
    }

    const quantity =
      positiveInteger(
        item.quantity,
        'Bottle sale quantity'
      );

    await restoreBottle(
      {
        bottleId,

        quantity,

        session,
      }
    );

    await createReversalLog(
      {
        bottle:
          bottleId,

        quantity,

        invoiceNo:
          sale.invoiceNo,

        session,
      }
    );
  };

/* ========================================
   LEGACY PRODUCT SALE REVERSAL
======================================== */

const reverseLegacyProductItem =
  async ({
    sale,
    item,
    session,
  }) => {
    const productId =
      getId(
        item.product
      );

    if (!productId) {
      return;
    }

    const product =
      await Product.findById(
        productId
      ).session(
        session
      );

    if (!product) {
      const error =
        new Error(
          `Product ${productId} not found while reversing ${sale.invoiceNo}`
        );

      error.statusCode =
        404;

      throw error;
    }

    const sizeVariant =
      getSizeVariant(
        product,
        item.sizeMl
      );

    if (
      !sizeVariant
    ) {
      const error =
        new Error(
          `${item.sizeMl}ml size no longer exists for ${product.name}`
        );

      error.statusCode =
        400;

      throw error;
    }

    const quantity =
      positiveInteger(
        item.quantity,
        'Sale quantity'
      );

    /*
      Restore bottle used by product.
    */

    const bottleId =
      getId(
        sizeVariant.bottle
      );

    if (
      bottleId
    ) {
      await restoreBottle(
        {
          bottleId,

          quantity,

          session,
        }
      );

      await createReversalLog(
        {
          bottle:
            bottleId,

          quantity,

          invoiceNo:
            sale.invoiceNo,

          session,
        }
      );
    }

    /*
      Restore roll-on perfume oil.
    */

    if (
      product.type ===
      'roll-on'
    ) {
      const materialId =
        getId(
          product.baseOil
        );

      if (
        materialId
      ) {
        const oilMl =
          getRollOnOilMlPerUnit(
            sizeVariant
          ) *
          quantity;

        await restoreMaterial(
          {
            materialId,

            quantity:
              oilMl,

            session,
          }
        );

        await createReversalLog(
          {
            material:
              materialId,

            quantity:
              oilMl,

            invoiceNo:
              sale.invoiceNo,

            session,
          }
        );
      }

      return;
    }

    /*
      Restore spray materials.
    */

    const components =
      getSizeBlend(
        product,
        item.sizeMl
      );

    for (
      const component of
      components
    ) {
      const percentage =
        Number(
          component
            .percentage ||
            0
        );

      const materialId =
        getId(
          component.material
        );

      if (
        percentage <= 0 ||
        !materialId
      ) {
        continue;
      }

      const mlUsed =
        Number(
          item.sizeMl
        ) *
        (
          percentage /
          100
        ) *
        quantity;

      if (
        mlUsed <= 0
      ) {
        continue;
      }

      await restoreMaterial(
        {
          materialId,

          quantity:
            mlUsed,

          session,
        }
      );

      await createReversalLog(
        {
          material:
            materialId,

          quantity:
            mlUsed,

          invoiceNo:
            sale.invoiceNo,

          session,
        }
      );
    }
  };

/* ========================================
   LEGACY SALE REVERSAL
======================================== */

const reverseLegacySale =
  async ({
    sale,
    session,
  }) => {
    for (
      const item of
      sale.items
    ) {
      const itemType =
        normalizeItemType(
          item.itemType
        );

      if (
        itemType ===
        'bottle'
      ) {
        await reverseLegacyBottleItem(
          {
            sale,

            item,

            session,
          }
        );

        continue;
      }

      await reverseLegacyProductItem(
        {
          sale,

          item,

          session,
        }
      );
    }
  };

/* ========================================
   DELETE SALE
======================================== */

exports.deleteSale =
  async (
    req,
    res
  ) => {
    const session =
      await mongoose.startSession();

    try {
      session.startTransaction();

      const sale =
        await Sale.findById(
          req.params.id
        ).session(
          session
        );

      if (!sale) {
        const error =
          new Error(
            'Sale not found'
          );

        error.statusCode =
          404;

        throw error;
      }

      /*
        Find exact deductions.

        This is the safest reversal because
        it restores exactly what this sale
        deducted at sale time.
      */

      const saleLogs =
        await InventoryLog.find(
          {
            reference:
              sale._id,

            refModel:
              'Sale',

            reason:
              'sale',
          }
        ).session(
          session
        );

      if (
        saleLogs.length >
        0
      ) {
        await reverseUsingInventoryLogs(
          {
            sale,

            logs:
              saleLogs,

            session,
          }
        );
      } else {
        /*
          Fallback for old historical sales.
        */

        await reverseLegacySale(
          {
            sale,

            session,
          }
        );
      }

      /*
        Remove original sale deductions.
      */

      await InventoryLog.deleteMany(
        {
          reference:
            sale._id,

          refModel:
            'Sale',

          reason:
            'sale',
        }
      ).session(
        session
      );

      /*
        Remove sale cash transaction.
      */

      await Transaction.deleteMany(
        {
          reference:
            sale._id,

          refModel:
            'Sale',
        }
      ).session(
        session
      );

      /*
        Do NOT reset linked order.
        Existing requested behaviour is kept.
      */

      await sale.deleteOne(
        {
          session,
        }
      );

      await session.commitTransaction();

      return res.json({
        message:
          'Sale deleted and stock reversed successfully',
      });
    } catch (error) {
      await session.abortTransaction();

      return sendError(
        res,
        error
      );
    } finally {
      session.endSession();
    }
  };