
const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');

const {
  calculateProfit,
  distributeProfit,
} = require('../services/profitService');

/* ========================================
   HELPERS
======================================== */

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const parseDate = (value, label, endOfDay = false) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const error = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
};

const getDateFilter = (startDate, endDate, field) => {
  const start = parseDate(startDate, 'start date');
  const end = parseDate(endDate, 'end date', true);

  if (start && end && start > end) {
    const error = new Error(
      'Start date cannot be later than end date'
    );
    error.statusCode = 400;
    throw error;
  }

  if (!start && !end) {
    return {};
  }

  const filter = {};

  if (start) {
    filter.$gte = start;
  }

  if (end) {
    filter.$lte = end;
  }

  return {
    [field]: filter,
  };
};

const sendError = (res, error) => {
  console.error('Report controller error:', error);

  return res.status(error.statusCode || 500).json({
    message: error.message || 'Could not generate report',
  });
};

/*
  Calculate actual cash from the Transaction ledger.

  Credit purchases only contribute their recorded payment
  transactions, not their full invoice value.

  Wastage is an inventory write-off, not a cash payment.
  Exclude old wastage-linked cash_out transactions as well.
*/
const getCashPosition = async () => {
  const wastageExpenses = await Expense.find({
    category: 'Wastage',
  }).select('_id');

  const wastageExpenseIds = wastageExpenses.map(
    (expense) => expense._id
  );

  const [result] = await Transaction.aggregate([
    {
      $match: {
        $or: [
          { refModel: { $ne: 'Expense' } },
          { reference: { $nin: wastageExpenseIds } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        totalCashIn: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'cash_in'] },
              '$amount',
              0,
            ],
          },
        },
        totalCashOut: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'cash_out'] },
              '$amount',
              0,
            ],
          },
        },
        cashInCount: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'cash_in'] },
              1,
              0,
            ],
          },
        },
        cashOutCount: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'cash_out'] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const totalCashIn = roundMoney(
    toNumber(result?.totalCashIn)
  );

  const totalCashOut = roundMoney(
    toNumber(result?.totalCashOut)
  );

  return {
    totalCashIn,
    totalCashOut,
    cashInCount: toNumber(result?.cashInCount),
    cashOutCount: toNumber(result?.cashOutCount),
    availableCash: roundMoney(totalCashIn - totalCashOut),
  };
};

/* ========================================
   CURRENT INVENTORY SUMMARY
======================================== */

// @desc Get current inventory summary
// @route GET /api/reports/stock
exports.getStockReport = async (req, res) => {
  try {
    const [materials, bottles] = await Promise.all([
      RawMaterial.find().select(
        'name sku type currentStockMl avgCostPerMl'
      ),
      Bottle.find().select(
        'sizeMl type currentStock avgCostPerUnit'
      ),
    ]);

    const totalMaterialValue = roundMoney(
      materials.reduce(
        (sum, material) =>
          sum +
          toNumber(material.currentStockMl) *
            toNumber(material.avgCostPerMl),
        0
      )
    );

    const totalBottleValue = roundMoney(
      bottles.reduce(
        (sum, bottle) =>
          sum +
          toNumber(bottle.currentStock) *
            toNumber(bottle.avgCostPerUnit),
        0
      )
    );

    return res.json({
      materials,
      bottles,
      summary: {
        totalMaterialValue,
        totalBottleValue,
        totalInventoryValue: roundMoney(
          totalMaterialValue + totalBottleValue
        ),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/* ========================================
   SALES REPORT
======================================== */

// @desc Get paid sales report by period
// @route GET /api/reports/sales
exports.getSalesReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      channel,
    } = req.query;

    const filter = {
      paymentStatus: 'paid',
      ...getDateFilter(startDate, endDate, 'saleDate'),
    };

    if (channel) {
      filter.channel = channel;
    }

    const sales = await Sale.find(filter)
      .populate('items.product', 'name sku')
      .populate('items.bottle', 'sizeMl type')
      .sort({
        saleDate: -1,
        createdAt: -1,
      });

    const totalRevenue = roundMoney(
      sales.reduce(
        (sum, sale) =>
          sum + toNumber(sale.totalAmount),
        0
      )
    );

    const totalUnits = sales.reduce(
      (sum, sale) =>
        sum +
        (sale.items || []).reduce(
          (itemSum, item) =>
            itemSum + toNumber(item.quantity),
          0
        ),
      0
    );

    const byChannel = {};

    sales.forEach((sale) => {
      const saleChannel = sale.channel || 'Unknown';

      if (!byChannel[saleChannel]) {
        byChannel[saleChannel] = {
          revenue: 0,
          units: 0,
          salesCount: 0,
        };
      }

      byChannel[saleChannel].revenue += toNumber(
        sale.totalAmount
      );

      byChannel[saleChannel].units += (
        sale.items || []
      ).reduce(
        (sum, item) =>
          sum + toNumber(item.quantity),
        0
      );

      byChannel[saleChannel].salesCount += 1;
    });

    Object.keys(byChannel).forEach((key) => {
      byChannel[key].revenue = roundMoney(
        byChannel[key].revenue
      );
    });

    return res.json({
      totalRevenue,
      totalUnits,
      totalSales: sales.length,
      byChannel,
      sales: sales.slice(0, 100),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/* ========================================
   PROFIT & LOSS REPORT
======================================== */

// @desc Get profit and loss statement
// @route GET /api/reports/profit
exports.getProfitReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
    } = req.query;

    const start = parseDate(startDate, 'start date');
    const end = parseDate(endDate, 'end date', true);

    if (start && end && start > end) {
      const error = new Error(
        'Start date cannot be later than end date'
      );
      error.statusCode = 400;
      throw error;
    }

    const profitData = await calculateProfit(
      start || new Date(0),
      end || new Date()
    );

    return res.json(profitData);
  } catch (error) {
    return sendError(res, error);
  }
};

/* ========================================
   INVESTOR PROFIT DISTRIBUTION
======================================== */

// @desc Get investor profit distribution
// @route GET /api/reports/investor-profit
exports.getInvestorProfitReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
    } = req.query;

    const start = parseDate(startDate, 'start date');
    const end = parseDate(endDate, 'end date', true);

    if (start && end && start > end) {
      const error = new Error(
        'Start date cannot be later than end date'
      );
      error.statusCode = 400;
      throw error;
    }

    const { netProfit } = await calculateProfit(
      start || new Date(0),
      end || new Date()
    );

    const distribution = await distributeProfit(netProfit);

    return res.json({
      netProfit,
      distribution,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/* ========================================
   AVAILABLE CASH
======================================== */

// @desc Get actual available cash from cash transactions
// @route GET /api/reports/available-cash
exports.getAvailableCash = async (req, res) => {
  try {
    const cashPosition = await getCashPosition();

    return res.json({
      availableCash: cashPosition.availableCash,
      totalCashIn: cashPosition.totalCashIn,
      totalCashOut: cashPosition.totalCashOut,
      cashInCount: cashPosition.cashInCount,
      cashOutCount: cashPosition.cashOutCount,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
