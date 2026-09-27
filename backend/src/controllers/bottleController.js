const Bottle = require('../models/Bottle');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');

// @desc    Get all bottles with sales + wastage + production totals
// @route   GET /api/inventory/bottles/with-sales
exports.getBottlesWithSales = async (req, res) => {
  try {
    const bottles = await Bottle.find();

    // 1) Sold quantities per bottle (from sales)
    const soldAgg = await Sale.aggregate([
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      { $unwind: "$product.sizes" },
      {
        $match: {
          $expr: { $eq: ["$product.sizes.sizeMl", "$items.sizeMl"] }
        }
      },
      {
        $lookup: {
          from: "bottles",
          localField: "product.sizes.bottle",
          foreignField: "_id",
          as: "bottle"
        }
      },
      { $unwind: "$bottle" },
      {
        $group: {
          _id: "$bottle._id",
          sold: { $sum: "$items.quantity" }
        }
      }
    ]);

    const soldMap = {};
    soldAgg.forEach(item => { soldMap[item._id.toString()] = item.sold; });

    // 2) Wasted quantities per bottle (from InventoryLog)
    const wasteAgg = await InventoryLog.aggregate([
      { $match: { reason: 'wastage', bottle: { $ne: null } } },
      {
        $group: {
          _id: "$bottle",
          wasted: { $sum: { $abs: "$changeQuantity" } }
        }
      }
    ]);
    const wastedMap = {};
    wasteAgg.forEach(item => { wastedMap[item._id.toString()] = item.wasted; });

    // 3) Production additions per bottle (from InventoryLog reason:'production')
    const prodAgg = await InventoryLog.aggregate([
      { $match: { reason: 'production', bottle: { $ne: null }, changeQuantity: { $gt: 0 } } },
      {
        $group: {
          _id: "$bottle",
          produced: { $sum: "$changeQuantity" }
        }
      }
    ]);
    const producedMap = {};
    prodAgg.forEach(item => { producedMap[item._id.toString()] = item.produced; });

    // 4) Combine
    const result = bottles.map(b => {
      const idStr = b._id.toString();
      return {
        ...b.toObject(),
        sold: soldMap[idStr] || 0,
        wasted: wastedMap[idStr] || 0,
        produced: producedMap[idStr] || 0,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark a bottle as Stock Out (remaining stock → wastage)
// @route   POST /api/inventory/bottles/:id/stock-out
exports.stockOutBottle = async (req, res) => {
  try {
    const bottle = await Bottle.findById(req.params.id);
    if (!bottle) {
      return res.status(404).json({ message: 'Bottle not found' });
    }

    const remainingStock = bottle.currentStock || 0;
    const avgCost = bottle.avgCostPerUnit || 0;

    if (remainingStock > 0) {
      const wastageAmount = remainingStock * avgCost;

      // 1) Expense record
      const expense = await Expense.create({
        type: 'regular',
        category: 'Wastage',
        amount: wastageAmount,
        date: new Date(),
        description: `Stock out: Bottle ${bottle.sizeMl}ml (${bottle.type}) – ${remainingStock} pcs`,
        reference: `BOTTLE-${bottle._id}`,
        notes: `Stock out on ${new Date().toISOString()}`,
      });

      // 2) Cash-out transaction
      await Transaction.create({
        type: 'cash_out',
        amount: wastageAmount,
        category: 'Expense',
        reference: expense._id,
        refModel: 'Expense',
        description: `Wastage from bottle stock‑out: ${bottle.sizeMl}ml (${bottle.type})`,
      });

      // 3) Inventory log (negative adjustment)
      await InventoryLog.create({
        bottle: bottle._id,
        changeQuantity: -remainingStock,
        reason: 'wastage',
        notes: `Stock out: remaining ${remainingStock} pcs sent to wastage`,
      });
    }

    bottle.currentStock = 0;
    bottle.isStockOut = true;
    await bottle.save();

    res.json({
      message: `Bottle ${bottle.sizeMl}ml (${bottle.type}) marked as stock‑out. ${remainingStock} pcs recorded as wastage.`,
      bottle,
    });
  } catch (error) {
    console.error('Bottle stock‑out error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Record bottle wastage (partial – not full stock-out)
// @route   POST /api/inventory/bottles/:id/waste
exports.wasteBottle = async (req, res) => {
  try {
    const bottle = await Bottle.findById(req.params.id);
    if (!bottle) {
      return res.status(404).json({ message: 'Bottle not found' });
    }

    const { quantity, notes } = req.body;
    const qty = parseFloat(quantity);

    if (!qty || qty <= 0) {
      return res.status(400).json({ message: 'Quantity must be positive' });
    }
    if (bottle.currentStock < qty) {
      return res.status(400).json({
        message: `Only ${bottle.currentStock} in stock. Cannot waste ${qty}.`,
      });
    }

    const wastageAmount = qty * (bottle.avgCostPerUnit || 0);

    // 1) Decrement stock
    bottle.currentStock -= qty;
    if (bottle.currentStock === 0) bottle.isStockOut = true;
    await bottle.save();

    // 2) Inventory log
    await InventoryLog.create({
      bottle: bottle._id,
      changeQuantity: -qty,
      reason: 'wastage',
      notes: notes || `Wasted ${qty} bottle(s) – ${bottle.sizeMl}ml (${bottle.type})`,
    });

    // 3) Expense + transaction if cost > 0
    if (wastageAmount > 0.01) {
      const expense = await Expense.create({
        type: 'regular',
        category: 'Wastage',
        amount: wastageAmount,
        date: new Date(),
        description: `Bottle wastage: ${bottle.sizeMl}ml (${bottle.type}) – ${qty} pcs`,
        reference: `BOTTLE-${bottle._id}`,
        notes: notes || '',
      });

      await Transaction.create({
        type: 'cash_out',
        amount: wastageAmount,
        category: 'Expense',
        reference: expense._id,
        refModel: 'Expense',
        description: `Wastage: ${bottle.sizeMl}ml (${bottle.type})`,
      });
    }

    res.json({
      message: `Wasted ${qty} bottle(s). Remaining: ${bottle.currentStock}.`,
      bottle,
    });
  } catch (error) {
    console.error('Bottle waste error:', error);
    res.status(500).json({ message: error.message });
  }
};