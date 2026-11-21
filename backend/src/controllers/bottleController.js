
const mongoose = require('mongoose');

const Bottle = require('../models/Bottle');
const Sale = require('../models/Sale');
const InventoryLog = require('../models/InventoryLog');
const Expense = require('../models/Expense');

/* ========================================
   HELPERS
======================================== */

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const validateObjectId = (value, label = 'ID') => {
  if (!mongoose.isValidObjectId(value)) {
    throw createError(`Invalid ${label}`);
  }

  return value;
};

const sendError = (res, error, operation) => {
  console.error(`${operation}:`, error);

  return res.status(error.statusCode || 500).json({
    message: error.message || 'Bottle operation failed',
  });
};

/* ========================================
   GET BOTTLES WITH USAGE / SALES
======================================== */

// @desc Get all bottles with perfume usage,
//       direct bottle sales, wastage and production
// @route GET /api/inventory/bottles/with-sales
exports.getBottlesWithSales = async (req, res) => {
  try {
    const bottles = await Bottle.find().sort({
      sizeMl: 1,
      type: 1,
    });

    // 1. BOTTLES USED FOR PERFUME SALES
    const perfumeUsageAgg = await Sale.aggregate([
      {
        $unwind: '$items',
      },
      {
        $match: {
          $or: [
            { 'items.itemType': 'product' },
            { 'items.itemType': { $exists: false } },
            { 'items.itemType': null },
          ],
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product',
        },
      },
      {
        $unwind: '$product',
      },
      {
        $unwind: '$product.sizes',
      },
      {
        $match: {
          $expr: {
            $eq: [
              '$product.sizes.sizeMl',
              '$items.sizeMl',
            ],
          },
        },
      },
      {
        $group: {
          _id: '$product.sizes.bottle',
          usedForPerfume: {
            $sum: '$items.quantity',
          },
        },
      },
    ]);

    const perfumeUsageMap = {};

    perfumeUsageAgg.forEach((item) => {
      if (!item._id) return;

      perfumeUsageMap[item._id.toString()] =
        Number(item.usedForPerfume || 0);
    });

    // 2. DIRECT EMPTY BOTTLE SALES
    const directBottleSalesAgg = await Sale.aggregate([
      {
        $unwind: '$items',
      },
      {
        $match: {
          'items.itemType': 'bottle',
          'items.bottle': { $ne: null },
        },
      },
      {
        $group: {
          _id: '$items.bottle',
          bottleSales: {
            $sum: '$items.quantity',
          },
          bottleSalesRevenue: {
            $sum: '$items.totalPrice',
          },
        },
      },
    ]);

    const directSaleMap = {};

    directBottleSalesAgg.forEach((item) => {
      if (!item._id) return;

      directSaleMap[item._id.toString()] = {
        quantity: Number(item.bottleSales || 0),
        revenue: Number(item.bottleSalesRevenue || 0),
      };
    });

    // 3. WASTAGE
    const wasteAgg = await InventoryLog.aggregate([
      {
        $match: {
          reason: 'wastage',
          bottle: { $ne: null },
          changeQuantity: { $lt: 0 },
        },
      },
      {
        $group: {
          _id: '$bottle',
          wasted: {
            $sum: {
              $abs: '$changeQuantity',
            },
          },
        },
      },
    ]);

    const wastedMap = {};

    wasteAgg.forEach((item) => {
      if (!item._id) return;

      wastedMap[item._id.toString()] =
        Number(item.wasted || 0);
    });

    // 4. PRODUCTION / STOCK ADDITIONS
    const productionAgg = await InventoryLog.aggregate([
      {
        $match: {
          reason: 'production',
          bottle: { $ne: null },
          changeQuantity: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$bottle',
          produced: {
            $sum: '$changeQuantity',
          },
        },
      },
    ]);

    const producedMap = {};

    productionAgg.forEach((item) => {
      if (!item._id) return;

      producedMap[item._id.toString()] =
        Number(item.produced || 0);
    });

    // 5. COMBINE RESULTS
    const result = bottles.map((bottle) => {
      const id = bottle._id.toString();

      const usedForPerfume =
        perfumeUsageMap[id] || 0;

      const bottleSales =
        directSaleMap[id]?.quantity || 0;

      const bottleSalesRevenue =
        directSaleMap[id]?.revenue || 0;

      const wasted =
        wastedMap[id] || 0;

      const produced =
        producedMap[id] || 0;

      const sold =
        usedForPerfume + bottleSales;

      return {
        ...bottle.toObject(),
        usedForPerfume,
        bottleSales,
        bottleSalesRevenue,
        sold,
        wasted,
        produced,
      };
    });

    return res.json(result);
  } catch (error) {
    return sendError(
      res,
      error,
      'Get bottles with sales error'
    );
  }
};

/* ========================================
   STOCK OUT BOTTLE
======================================== */

// @desc Mark a bottle as Stock Out.
//      Remaining stock becomes wastage.
// @route POST /api/inventory/bottles/:id/stock-out
exports.stockOutBottle = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      validateObjectId(req.params.id, 'bottle ID');

      const bottle = await Bottle.findById(
        req.params.id
      ).session(session);

      if (!bottle) {
        throw createError('Bottle not found', 404);
      }

      const remainingStock = Number(
        bottle.currentStock || 0
      );

      if (
        !Number.isInteger(remainingStock) ||
        remainingStock < 0
      ) {
        throw createError(
          'Invalid bottle stock value'
        );
      }

      const avgCost = Number(
        bottle.avgCostPerUnit || 0
      );

      if (!Number.isFinite(avgCost) || avgCost < 0) {
        throw createError(
          'Invalid average bottle cost'
        );
      }

      const wastageAmount = roundMoney(
        remainingStock * avgCost
      );

      const now = new Date();

      const updatedBottle =
        await Bottle.findOneAndUpdate(
          {
            _id: bottle._id,
            currentStock: remainingStock,
          },
          {
            $set: {
              currentStock: 0,
              isStockOut: true,
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          }
        );

      if (!updatedBottle) {
        throw createError(
          'Bottle stock changed during this operation. Please refresh and try again.',
          409
        );
      }

      let expense = null;

      if (remainingStock > 0) {
        /*
          Wastage is recorded as an expense because inventory
          value has been lost.

          Do NOT create a cash_out Transaction here.
          No cash is paid when existing stock is written off.
        */
        [expense] = await Expense.create(
          [
            {
              type: 'regular',
              category: 'Wastage',
              amount: wastageAmount,
              date: now,
              description:
                `Stock out: Bottle ${bottle.sizeMl}ml (${bottle.type}) - ${remainingStock} pcs`,
              reference: `BOTTLE-${bottle._id}`,
              notes: `Stock out on ${now.toISOString()}`,
            },
          ],
          { session }
        );

        await InventoryLog.create(
          [
            {
              bottle: bottle._id,
              changeQuantity: -remainingStock,
              reason: 'wastage',
              reference: expense._id,
              refModel: 'Expense',
              date: now,
              notes:
                `Stock out: remaining ${remainingStock} pcs sent to wastage`,
            },
          ],
          { session }
        );
      }

      response = {
        message:
          `Bottle ${bottle.sizeMl}ml (${bottle.type}) marked as stock-out. ${remainingStock} pcs recorded as wastage.`,
        bottle: updatedBottle,
        wastageQuantity: remainingStock,
        wastageValue: wastageAmount,
        expenseId: expense?._id || null,
      };
    });

    return res.json(response);
  } catch (error) {
    return sendError(
      res,
      error,
      'Bottle stock-out error'
    );
  } finally {
    await session.endSession();
  }
};

/* ========================================
   PARTIAL BOTTLE WASTAGE
======================================== */

// @desc Record partial bottle wastage
// @route POST /api/inventory/bottles/:id/waste
exports.wasteBottle = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      validateObjectId(req.params.id, 'bottle ID');

      const bottle = await Bottle.findById(
        req.params.id
      ).session(session);

      if (!bottle) {
        throw createError('Bottle not found', 404);
      }

      const qty = Number(req.body.quantity);

      const notes =
        typeof req.body.notes === 'string'
          ? req.body.notes.trim()
          : '';

      if (!Number.isInteger(qty) || qty <= 0) {
        throw createError(
          'Bottle quantity must be a positive whole number'
        );
      }

      const currentStock = Number(
        bottle.currentStock || 0
      );

      if (
        !Number.isInteger(currentStock) ||
        currentStock < 0
      ) {
        throw createError(
          'Invalid current bottle stock'
        );
      }

      if (currentStock < qty) {
        throw createError(
          `Only ${currentStock} bottle(s) in stock. Cannot waste ${qty}.`
        );
      }

      const avgCost = Number(
        bottle.avgCostPerUnit || 0
      );

      if (!Number.isFinite(avgCost) || avgCost < 0) {
        throw createError(
          'Invalid average bottle cost'
        );
      }

      const wastageAmount = roundMoney(
        qty * avgCost
      );

      const now = new Date();

      const updatedBottle =
        await Bottle.findOneAndUpdate(
          {
            _id: bottle._id,
            currentStock: {
              $gte: qty,
              $eq: currentStock,
            },
          },
          {
            $inc: {
              currentStock: -qty,
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          }
        );

      if (!updatedBottle) {
        throw createError(
          'Bottle stock changed during this operation. Please refresh and try again.',
          409
        );
      }

      updatedBottle.isStockOut =
        updatedBottle.currentStock <= 0;

      await updatedBottle.save({ session });

      /*
        Always create the wastage expense, including when the
        average cost is zero. This keeps inventory history linked
        to an expense record.

        No cash_out Transaction is created because this is
        a non-cash inventory write-off.
      */
      const [expense] = await Expense.create(
        [
          {
            type: 'regular',
            category: 'Wastage',
            amount: wastageAmount,
            date: now,
            description:
              `Bottle wastage: ${bottle.sizeMl}ml (${bottle.type}) - ${qty} pcs`,
            reference: `BOTTLE-${bottle._id}`,
            notes,
          },
        ],
        { session }
      );

      await InventoryLog.create(
        [
          {
            bottle: bottle._id,
            changeQuantity: -qty,
            reason: 'wastage',
            reference: expense._id,
            refModel: 'Expense',
            date: now,
            notes:
              notes ||
              `Wasted ${qty} bottle(s) - ${bottle.sizeMl}ml (${bottle.type})`,
          },
        ],
        { session }
      );

      response = {
        message:
          `Wasted ${qty} bottle(s). Remaining: ${updatedBottle.currentStock}.`,
        bottle: updatedBottle,
        wastageQuantity: qty,
        wastageValue: wastageAmount,
        expenseId: expense._id,
      };
    });

    return res.json(response);
  } catch (error) {
    return sendError(
      res,
      error,
      'Bottle waste error'
    );
  } finally {
    await session.endSession();
  }
};
