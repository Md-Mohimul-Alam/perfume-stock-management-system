const mongoose = require('mongoose');

const Production = require('../models/Production');
const Product = require('../models/Product');

const {
  deductRawMaterial,
  deductBottle,
} = require('../services/inventoryService');

const {
  generateInvoiceNo,
} = require('../utils/generateInvoice');

const BLEND_TOLERANCE = 0.01;
const MAX_BATCH_RETRIES = 3;

/* ========================================
   HELPERS
======================================== */

const createError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getId = (value) => {
  return value?._id || value || null;
};

const toNumber = (
  value,
  label
) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
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
  const parsed = toNumber(
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
  const parsed = positiveNumber(
    value,
    label
  );

  if (!Number.isInteger(parsed)) {
    throw createError(
      `${label} must be a whole number`
    );
  }

  return parsed;
};

/* ========================================
   DATE
======================================== */

const parseProductionDate = (
  value
) => {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createError(
      'Invalid production date'
    );
  }

  return date;
};

/* ========================================
   SIZE / BLEND HELPERS
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
  const sizeVariant =
    getSizeVariant(
      product,
      sizeMl
    );

  if (
    sizeVariant?.blendComponents &&
    sizeVariant.blendComponents.length > 0
  ) {
    return sizeVariant.blendComponents;
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
    Number.isFinite(
      configured
    ) &&
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
   PRODUCT VALIDATION
======================================== */

const assertProductHasBlend = (
  product,
  sizeMl
) => {
  /*
    Roll-on
  */

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
        `Product "${product.name}" (SKU: ${product.sku}) has no base oil configured.`
      );
    }

    return;
  }

  /*
    Spray
  */

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

  if (
    components.length === 0
  ) {
    throw createError(
      `Product "${product.name}" (SKU: ${product.sku}, ${sizeMl}ml) has no blend configured.`
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
      `Product "${product.name}" (SKU: ${product.sku}, ${sizeMl}ml) blend totals ${totalPercentage}% instead of 100%.`
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

    /*
      0% entries do not consume stock.
    */

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
        `Product "${product.name}" has a blend component without a material.`
      );
    }
  }
};

/* ========================================
   ERROR RESPONSE
======================================== */

const sendError = (
  res,
  error
) => {
  console.error(
    'Production controller error:',
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
          'Production batch number already exists',
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
    'Production operation failed';

  let status =
    error?.statusCode ||
    500;

  if (
    !error?.statusCode &&
    /not found/i.test(
      message
    )
  ) {
    status = 404;
  }

  if (
    !error?.statusCode &&
    /insufficient|invalid|required|must|not available|no blend|no base oil/i.test(
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
   PREPARE PRODUCTION ITEMS
======================================== */

const prepareProductionItems =
  async ({
    items,
    session,
  }) => {
    if (
      !Array.isArray(
        items
      ) ||
      items.length === 0
    ) {
      throw createError(
        'At least one production item is required'
      );
    }

    const preparedItems =
      [];

    const seen =
      new Set();

    for (
      let index = 0;
      index < items.length;
      index += 1
    ) {
      const item =
        items[index];

      const productId =
        item?.product;

      if (
        !mongoose.isValidObjectId(
          productId
        )
      ) {
        throw createError(
          `Invalid product ID at item ${index + 1}`
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
        Prevent accidental duplicate
        product + size lines.
      */

      const key =
        `${String(
          productId
        )}:${sizeMl}`;

      if (
        seen.has(key)
      ) {
        throw createError(
          `Duplicate production item at row ${index + 1}`
        );
      }

      seen.add(key);

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
          `Product ${productId} not found`,
          404
        );
      }

      if (
        product.isActive ===
        false
      ) {
        throw createError(
          `Product "${product.name}" is inactive`
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
        Make sure raw material
        configuration is valid.
      */

      assertProductHasBlend(
        product,
        sizeMl
      );

      /*
        Make sure bottle exists.
      */

      const bottleId =
        getId(
          sizeVariant.bottle
        );

      if (!bottleId) {
        throw createError(
          `Bottle is not configured for "${product.name}" ${sizeMl}ml`
        );
      }

      preparedItems.push({
        productionItem: {
          product:
            product._id,

          sizeMl,

          quantity,
        },

        product,

        sizeVariant,

        sizeMl,

        quantity,
      });
    }

    return preparedItems;
  };

/* ========================================
   DEDUCT PRODUCTION INVENTORY
======================================== */

const deductProductionInventory =
  async ({
    preparedItems,
    production,
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

        const totalOil =
          oilPerUnit *
          quantity;

        await deductRawMaterial(
          getId(
            product.baseOil
          ),
          totalOil,
          'production',
          production,
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
            (percentage / 100) *
            quantity;

          if (
            mlUsed <= 0
          ) {
            continue;
          }

          await deductRawMaterial(
            materialId,
            mlUsed,
            'production',
            production,
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
        'production',
        production,
        session
      );
    }
  };

/* ========================================
   CREATE PRODUCTION INTERNAL
======================================== */

const createProductionInternal =
  async ({
    batchNo,
    items,
    productionDate,
    notes,
    session,
  }) => {
    const preparedItems =
      await prepareProductionItems({
        items,
        session,
      });

    const cleanDate =
      parseProductionDate(
        productionDate
      );

    /*
      Create production record FIRST
      inside the transaction.

      Inventory logs can now immediately
      reference the exact production ID.
    */

    const [production] =
      await Production.create(
        [
          {
            batchNo,

            items:
              preparedItems.map(
                (item) =>
                  item.productionItem
              ),

            productionDate:
              cleanDate,

            notes:
              String(
                notes || ''
              ).trim(),

            status:
              'completed',
          },
        ],
        {
          session,
        }
      );

    /*
      Deduct all raw materials + bottles.

      If any deduction fails,
      MongoDB rolls back:
      - production document
      - previous deductions
      - inventory logs
    */

    await deductProductionInventory(
      {
        preparedItems,

        production,

        session,
      }
    );

    return production;
  };

/* ========================================
   CREATE PRODUCTION
======================================== */

exports.createProduction =
  async (req, res) => {
    /*
      generateInvoiceNo already uses
      timestamp + random value.

      Retry a few times in the extremely
      unlikely case of a duplicate batch.
    */

    for (
      let attempt = 1;
      attempt <=
      MAX_BATCH_RETRIES;
      attempt += 1
    ) {
      const session =
        await mongoose.startSession();

      try {
        session.startTransaction();

        const batchNo =
          generateInvoiceNo(
            'BATCH'
          );

        const production =
          await createProductionInternal(
            {
              batchNo,

              items:
                req.body?.items,

              productionDate:
                req.body
                  ?.productionDate,

              notes:
                req.body?.notes,

              session,
            }
          );

        await session.commitTransaction();

        /*
          Populate product names for
          frontend convenience.
        */

        const populated =
          await Production.findById(
            production._id
          ).populate(
            'items.product',
            'name sku type'
          );

        return res
          .status(201)
          .json(
            populated ||
              production
          );
      } catch (error) {
        await session.abortTransaction();

        /*
          Duplicate batch number:
          generate another and retry.
        */

        if (
          error?.code ===
            11000 &&
          attempt <
            MAX_BATCH_RETRIES
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
          'Could not generate a unique production batch number. Please try again.',
      });
  };

/* ========================================
   GET ALL PRODUCTION BATCHES
======================================== */

exports.getProductions =
  async (req, res) => {
    try {
      const productions =
        await Production.find()
          .populate(
            'items.product',
            'name sku type'
          )
          .sort({
            productionDate:
              -1,

            createdAt:
              -1,
          });

      return res.json(
        productions
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };

/* ========================================
   GET SINGLE PRODUCTION BATCH
======================================== */

exports.getProductionById =
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              'Invalid production batch ID',
          });
      }

      const production =
        await Production.findById(
          req.params.id
        ).populate(
          'items.product',
          'name sku type'
        );

      if (!production) {
        return res
          .status(404)
          .json({
            message:
              'Production batch not found',
          });
      }

      return res.json(
        production
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  };