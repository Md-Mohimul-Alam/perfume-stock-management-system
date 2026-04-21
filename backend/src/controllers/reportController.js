const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Purchase = require('../models/Purchase');
const Investor = require('../models/Investor');
const { calculateProfit, distributeProfit } = require('../services/profitService');

// @desc    Get current inventory summary
// @route   GET /api/reports/stock
exports.getStockReport = async (req, res) => {
  try {
    const materials = await RawMaterial.find().select('name sku type currentStockMl avgCostPerMl');
    const bottles = await Bottle.find().select('sizeMl type currentStock avgCostPerUnit');

    const totalMaterialValue = materials.reduce((sum, m) => sum + (m.currentStockMl * m.avgCostPerMl), 0);
    const totalBottleValue = bottles.reduce((sum, b) => sum + (b.currentStock * b.avgCostPerUnit), 0);

    res.json({
      materials,
      bottles,
      summary: {
        totalMaterialValue,
        totalBottleValue,
        totalInventoryValue: totalMaterialValue + totalBottleValue,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get sales report by period
// @route   GET /api/reports/sales
exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, channel } = req.query;
    const filter = { paymentStatus: 'paid' };
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }
    if (channel) filter.channel = channel;

    const sales = await Sale.find(filter).populate('items.product', 'name sku');
    const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalUnits = sales.reduce((sum, s) => sum + s.items.reduce((s2, i) => s2 + i.quantity, 0), 0);

    // Group by channel
    const byChannel = {};
    sales.forEach(s => {
      if (!byChannel[s.channel]) byChannel[s.channel] = { revenue: 0, units: 0 };
      byChannel[s.channel].revenue += s.totalAmount;
      byChannel[s.channel].units += s.items.reduce((sum, i) => sum + i.quantity, 0);
    });

    res.json({
      totalRevenue,
      totalUnits,
      byChannel,
      sales: sales.slice(0, 100), // limit for performance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get profit & loss statement
// @route   GET /api/reports/profit
exports.getProfitReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const profitData = await calculateProfit(
      startDate ? new Date(startDate) : new Date(0),
      endDate ? new Date(endDate) : new Date()
    );
    res.json(profitData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get investor profit distribution
// @route   GET /api/reports/investor-profit
exports.getInvestorProfitReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { netProfit } = await calculateProfit(
      startDate ? new Date(startDate) : new Date(0),
      endDate ? new Date(endDate) : new Date()
    );
    const distribution = await distributeProfit(netProfit);
    res.json({ netProfit, distribution });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};