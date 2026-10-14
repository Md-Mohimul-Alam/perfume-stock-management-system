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
    const bottles =
      await Bottle.find();

    /* ======================================
       1. BOTTLES USED FOR PERFUME SALES
    ====================================== */

    const perfumeUsageAgg =
      await Sale.aggregate([
        {
          $unwind: '$items',
        },

        /*
          Existing old sales may not have
          itemType.

          They are normal product sales.
        */
        {
          $match: {
            $or: [
              {
                'items.itemType':
                  'product',
              },

              {
                'items.itemType': {
                  $exists: false,
                },
              },

              {
                'items.itemType':
                  null,
              },
            ],
          },
        },

        {
          $lookup: {
            from:
              'products',

            localField:
              'items.product',

            foreignField:
              '_id',

            as:
              'product',
          },
        },

        {
          $unwind:
            '$product',
        },

        {
          $unwind:
            '$product.sizes',
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
            _id:
              '$product.sizes.bottle',

            usedForPerfume: {
              $sum:
                '$items.quantity',
            },
          },
        },
      ]);

    const perfumeUsageMap =
      {};

    perfumeUsageAgg.forEach(
      (item) => {
        if (!item._id) {
          return;
        }

        perfumeUsageMap[
          item._id.toString()
        ] =
          Number(
            item.usedForPerfume ||
              0
          );
      }
    );

    /* ======================================
       2. DIRECT EMPTY BOTTLE SALES
    ====================================== */

    const directBottleSalesAgg =
      await Sale.aggregate([
        {
          $unwind:
            '$items',
        },

        {
          $match: {
            'items.itemType':
              'bottle',

            'items.bottle': {
              $ne: null,
            },
          },
        },

        {
          $group: {
            _id:
              '$items.bottle',

            bottleSales: {
              $sum:
                '$items.quantity',
            },

            bottleSalesRevenue: {
              $sum:
                '$items.totalPrice',
            },
          },
        },
      ]);

    const directSaleMap =
      {};

    directBottleSalesAgg.forEach(
      (item) => {
        if (!item._id) {
          return;
        }

        directSaleMap[
          item._id.toString()
        ] = {
          quantity:
            Number(
              item.bottleSales ||
                0
            ),

          revenue:
            Number(
              item.bottleSalesRevenue ||
                0
            ),
        };
      }
    );

    /* ======================================
       3. WASTAGE
    ====================================== */

    const wasteAgg =
      await InventoryLog.aggregate([
        {
          $match: {
            reason:
              'wastage',

            bottle: {
              $ne: null,
            },

            changeQuantity: {
              $lt: 0,
            },
          },
        },

        {
          $group: {
            _id:
              '$bottle',

            wasted: {
              $sum: {
                $abs:
                  '$changeQuantity',
              },
            },
          },
        },
      ]);

    const wastedMap =
      {};

    wasteAgg.forEach(
      (item) => {
        if (!item._id) {
          return;
        }

        wastedMap[
          item._id.toString()
        ] =
          Number(
            item.wasted ||
              0
          );
      }
    );

    /* ======================================
       4. PRODUCTION / STOCK ADDITIONS
    ====================================== */

    const productionAgg =
      await InventoryLog.aggregate([
        {
          $match: {
            reason:
              'production',

            bottle: {
              $ne: null,
            },

            changeQuantity: {
              $gt: 0,
            },
          },
        },

        {
          $group: {
            _id:
              '$bottle',

            produced: {
              $sum:
                '$changeQuantity',
            },
          },
        },
      ]);

    const producedMap =
      {};

    productionAgg.forEach(
      (item) => {
        if (!item._id) {
          return;
        }

        producedMap[
          item._id.toString()
        ] =
          Number(
            item.produced ||
              0
          );
      }
    );

    /* ======================================
       5. COMBINE
    ====================================== */

    const result =
      bottles.map(
        (bottle) => {
          const id =
            bottle._id.toString();

          const usedForPerfume =
            perfumeUsageMap[id] ||
            0;

          const bottleSales =
            directSaleMap[id]
              ?.quantity ||
            0;

          const bottleSalesRevenue =
            directSaleMap[id]
              ?.revenue ||
            0;

          const wasted =
            wastedMap[id] ||
            0;

          const produced =
            producedMap[id] ||
            0;

          /*
            Keep "sold" for frontend
            backward compatibility.

            sold means total bottle units
            that left inventory because
            of sales activity.

            usedForPerfume + bottleSales
          */

          const sold =
            usedForPerfume +
            bottleSales;

          return {
            ...bottle.toObject(),

            usedForPerfume,

            bottleSales,

            bottleSalesRevenue,

            sold,

            wasted,

            produced,
          };
        }
      );

    return res.json(
      result
    );
  } catch (error) {
    console.error(
      'Get bottles with sales error:',
      error
    );

    return res
      .status(500)
      .json({
        message:
          error.message,
      });
  }
};

/* ========================================
   STOCK OUT BOTTLE
======================================== */

// @desc    Mark a bottle as Stock Out
//          remaining stock becomes wastage
// @route   POST /api/inventory/bottles/:id/stock-out
exports.stockOutBottle =
  async (
    req,
    res
  ) => {
    try {
      const bottle =
        await Bottle.findById(
          req.params.id
        );

      if (!bottle) {
        return res
          .status(404)
          .json({
            message:
              'Bottle not found',
          });
      }

      const remainingStock =
        Number(
          bottle.currentStock ||
            0
        );

      const avgCost =
        Number(
          bottle.avgCostPerUnit ||
            0
        );

      if (
        remainingStock >
        0
      ) {
        const wastageAmount =
          remainingStock *
          avgCost;

        const now =
          new Date();

        const expense =
          await Expense.create({
            type:
              'regular',

            category:
              'Wastage',

            amount:
              wastageAmount,

            date:
              now,

            description:
              `Stock out: Bottle ${bottle.sizeMl}ml (${bottle.type}) - ${remainingStock} pcs`,

            reference:
              `BOTTLE-${bottle._id}`,

            notes:
              `Stock out on ${now.toISOString()}`,
          });

        await Transaction.create(
          {
            type:
              'cash_out',

            amount:
              wastageAmount,

            category:
              'Expense',

            reference:
              expense._id,

            refModel:
              'Expense',

            date:
              now,

            description:
              `Wastage from bottle stock-out: ${bottle.sizeMl}ml (${bottle.type})`,
          }
        );

        await InventoryLog.create(
          {
            bottle:
              bottle._id,

            changeQuantity:
              -remainingStock,

            reason:
              'wastage',

            date:
              now,

            notes:
              `Stock out: remaining ${remainingStock} pcs sent to wastage`,
          }
        );
      }

      bottle.currentStock =
        0;

      bottle.isStockOut =
        true;

      await bottle.save();

      return res.json({
        message:
          `Bottle ${bottle.sizeMl}ml (${bottle.type}) marked as stock-out. ${remainingStock} pcs recorded as wastage.`,

        bottle,
      });
    } catch (error) {
      console.error(
        'Bottle stock-out error:',
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   PARTIAL BOTTLE WASTAGE
======================================== */

// @desc    Record bottle wastage
// @route   POST /api/inventory/bottles/:id/waste
exports.wasteBottle =
  async (
    req,
    res
  ) => {
    try {
      const bottle =
        await Bottle.findById(
          req.params.id
        );

      if (!bottle) {
        return res
          .status(404)
          .json({
            message:
              'Bottle not found',
          });
      }

      const {
        quantity,
        notes,
      } = req.body;

      const qty =
        Number(
          quantity
        );

      if (
        !Number.isInteger(
          qty
        ) ||
        qty <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'Bottle quantity must be a positive whole number',
          });
      }

      if (
        bottle.currentStock <
        qty
      ) {
        return res
          .status(400)
          .json({
            message:
              `Only ${bottle.currentStock} bottle(s) in stock. Cannot waste ${qty}.`,
          });
      }

      const wastageAmount =
        qty *
        Number(
          bottle.avgCostPerUnit ||
            0
        );

      const now =
        new Date();

      bottle.currentStock -=
        qty;

      bottle.isStockOut =
        bottle.currentStock <=
        0;

      await bottle.save();

      await InventoryLog.create(
        {
          bottle:
            bottle._id,

          changeQuantity:
            -qty,

          reason:
            'wastage',

          date:
            now,

          notes:
            notes ||
            `Wasted ${qty} bottle(s) - ${bottle.sizeMl}ml (${bottle.type})`,
        }
      );

      if (
        wastageAmount >
        0.01
      ) {
        const expense =
          await Expense.create({
            type:
              'regular',

            category:
              'Wastage',

            amount:
              wastageAmount,

            date:
              now,

            description:
              `Bottle wastage: ${bottle.sizeMl}ml (${bottle.type}) - ${qty} pcs`,

            reference:
              `BOTTLE-${bottle._id}`,

            notes:
              notes || '',
          });

        await Transaction.create(
          {
            type:
              'cash_out',

            amount:
              wastageAmount,

            category:
              'Expense',

            reference:
              expense._id,

            refModel:
              'Expense',

            date:
              now,

            description:
              `Wastage: ${bottle.sizeMl}ml (${bottle.type})`,
          }
        );
      }

      return res.json({
        message:
          `Wasted ${qty} bottle(s). Remaining: ${bottle.currentStock}.`,

        bottle,
      });
    } catch (error) {
      console.error(
        'Bottle waste error:',
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };