
const mongoose = require('mongoose');

const Bottle = require('../models/Bottle');
const Sale = require('../models/Sale');
const InventoryLog = require('../models/InventoryLog');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');

/* ========================================
   GET BOTTLES WITH USAGE / SALES
======================================== */

// @desc    Get all bottles with perfume usage,
//          direct bottle sales, wastage and production
// @route   GET /api/inventory/bottles/with-sales
exports.getBottlesWithSales = async (req, res) => {
  try {
    const bottles = await Bottle.find();

    // 1. BOTTLES USED FOR PERFUME SALES
    const perfumeUsageAgg = await Sale.aggregate([
      { $unwind: '$items' },
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
      { $unwind: '$product' },
      { $unwind: '$product.sizes' },
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
      { $unwind: '$items' },
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

    // 5. COMBINE
    const result = bottles.map((bottle) => {
      const id = bottle._id.toString();

      const usedForPerfume =
        perfumeUsageMap[id] || 0;

      const bottleSales =
        directSaleMap[id]?.quantity || 0;

      const bottleSalesRevenue =
        directSaleMap[id]?.revenue || 0;

      const wasted = wastedMap[id] || 0;
      const produced = producedMap[id] || 0;

      // Backward compatibility:
      // sold = perfume usage + direct bottle sales
      const sold = usedForPerfume + bottleSales;

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
    console.error('Get bottles with sales error:', error);

    return res.status(500).json({
      message: error.message,
    });
  }
};

/* ========================================
   STOCK OUT BOTTLE
======================================== */

// @desc    Mark a bottle as Stock Out
//          Remaining stock becomes wastage
// @route   POST /api/inventory/bottles/:id/stock-out
exports.stockOutBottle = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      const bottle = await Bottle.findById(
        req.params.id
      ).session(session);

      if (!bottle) {
        const error = new Error('Bottle not found');
        error.statusCode = 404;
        throw error;
      }

      const remainingStock = Number(
        bottle.currentStock || 0
      );

      if (
        !Number.isInteger(remainingStock) ||
        remainingStock < 0
      ) {
        const error = new Error(
          'Invalid bottle stock value'
        );
        error.statusCode = 400;
        throw error;
      }

      const avgCost = Number(
        bottle.avgCostPerUnit || 0
      );

      const wastageAmount = Math.round(
        remainingStock * avgCost * 100
      ) / 100;

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
        const error = new Error(
          'Bottle stock changed during this operation. Please refresh and try again.'
        );
        error.statusCode = 409;
        throw error;
      }

      let expense = null;

      if (remainingStock > 0) {
        if (wastageAmount > 0.01) {
          [expense] = await Expense.create(
            [{
              type: 'regular',
              category: 'Wastage',
              amount: wastageAmount,
              date: now,
              description:
                `Stock out: Bottle ${bottle.sizeMl}ml (${bottle.type}) - ${remainingStock} pcs`,
              reference: `BOTTLE-${bottle._id}`,
              notes: `Stock out on ${now.toISOString()}`,
            }],
            { session }
          );

          await Transaction.create(
            [{
              type: 'cash_out',
              amount: wastageAmount,
              category: 'Expense',
              reference: expense._id,
              refModel: 'Expense',
              date: now,
              description:
                `Wastage from bottle stock-out: ${bottle.sizeMl}ml (${bottle.type})`,
            }],
            { session }
          );
        }

        await InventoryLog.create(
          [{
            bottle: bottle._id,
            changeQuantity: -remainingStock,
            reason: 'wastage',
            reference: expense?._id || null,
            refModel: expense ? 'Expense' : null,
            date: now,
            notes:
              `Stock out: remaining ${remainingStock} pcs sent to wastage`,
          }],
          { session }
        );
      }

      response = {
        message:
          `Bottle ${bottle.sizeMl}ml (${bottle.type}) marked as stock-out. ${remainingStock} pcs recorded as wastage.`,
        bottle: updatedBottle,
        wastageQuantity: remainingStock,
        expenseId: expense?._id || null,
      };
    });

    return res.json(response);
  } catch (error) {
    console.error('Bottle stock-out error:', error);

    return res.status(error.statusCode || 500).json({
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

/* ========================================
   PARTIAL BOTTLE WASTAGE
======================================== */

// @desc    Record bottle wastage
// @route   POST /api/inventory/bottles/:id/waste
exports.wasteBottle = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      const bottle = await Bottle.findById(
        req.params.id
      ).session(session);

      if (!bottle) {
        const error = new Error('Bottle not found');
        error.statusCode = 404;
        throw error;
      }

      const qty = Number(req.body.quantity);

      const notes =
        typeof req.body.notes === 'string'
          ? req.body.notes.trim()
          : '';

      if (!Number.isInteger(qty) || qty <= 0) {
        const error = new Error(
          'Bottle quantity must be a positive whole number'
        );
        error.statusCode = 400;
        throw error;
      }

      const currentStock = Number(
        bottle.currentStock || 0
      );

      if (currentStock < qty) {
        const error = new Error(
          `Only ${currentStock} bottle(s) in stock. Cannot waste ${qty}.`
        );
        error.statusCode = 400;
        throw error;
      }

      const wastageAmount = Math.round(
        qty * Number(bottle.avgCostPerUnit || 0) * 100
      ) / 100;

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
        const error = new Error(
          'Bottle stock changed during this operation. Please refresh and try again.'
        );
        error.statusCode = 409;
        throw error;
      }

      updatedBottle.isStockOut =
        updatedBottle.currentStock <= 0;

      await updatedBottle.save({ session });

      let expense = null;

      if (wastageAmount > 0.01) {
        [expense] = await Expense.create(
          [{
            type: 'regular',
            category: 'Wastage',
            amount: wastageAmount,
            date: now,
            description:
              `Bottle wastage: ${bottle.sizeMl}ml (${bottle.type}) - ${qty} pcs`,
            reference: `BOTTLE-${bottle._id}`,
            notes,
          }],
          { session }
        );

        await Transaction.create(
          [{
            type: 'cash_out',
            amount: wastageAmount,
            category: 'Expense',
            reference: expense._id,
            refModel: 'Expense',
            date: now,
            description:
              `Wastage: ${bottle.sizeMl}ml (${bottle.type})`,
          }],
          { session }
        );
      }

      await InventoryLog.create(
        [{
          bottle: bottle._id,
          changeQuantity: -qty,
          reason: 'wastage',
          reference: expense?._id || null,
          refModel: expense ? 'Expense' : null,
          date: now,
          notes:
            notes ||
            `Wasted ${qty} bottle(s) - ${bottle.sizeMl}ml (${bottle.type})`,
        }],
        { session }
      );

      response = {
        message:
          `Wasted ${qty} bottle(s). Remaining: ${updatedBottle.currentStock}.`,
        bottle: updatedBottle,
        wastageQuantity: qty,
        expenseId: expense?._id || null,
      };
    });

    return res.json(response);
  } catch (error) {
    console.error('Bottle waste error:', error);

    return res.status(error.statusCode || 500).json({
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};
