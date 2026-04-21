const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');
const { deductRawMaterial, deductBottle } = require('../services/inventoryService');
const { generateInvoiceNo } = require('../utils/generateInvoice');

// @desc    Create a sale (auto-deduct stock)
// @route   POST /api/sales
exports.createSale = async (req, res) => {
  try {
    const { channel, items, saleDate, paymentStatus, notes } = req.body;
    let totalAmount = 0;

    for (const item of items) {
      const product = await Product.findById(item.product).populate('sizes.bottle');
      if (!product) throw new Error(`Product ${item.product} not found`);

      const sizeVariant = product.sizes.find(s => s.sizeMl === item.sizeMl);
      if (!sizeVariant) throw new Error(`Size ${item.sizeMl} not available for this product`);

      totalAmount += item.quantity * item.unitPrice;

      // Deduct raw materials
      if (product.type === 'roll-on') {
        await deductRawMaterial(product.baseOil, sizeVariant.oilMlUsed * item.quantity, 'sale', null);
      } else {
        for (const comp of product.blendComponents) {
          const mlUsed = (sizeVariant.sizeMl * comp.percentage / 100) * item.quantity;
          await deductRawMaterial(comp.material, mlUsed, 'sale', null);
        }
      }

      // Deduct bottles
      await deductBottle(sizeVariant.bottle, item.quantity, 'sale', null);
    }

    const invoiceNo = generateInvoiceNo('INV');
    const sale = await Sale.create({
      invoiceNo,
      channel,
      items,
      totalAmount,
      saleDate: saleDate || Date.now(),
      paymentStatus,
      notes,
    });

    // Link inventory logs
    await InventoryLog.updateMany(
      { reference: null, reason: 'sale' },
      { reference: sale._id, refModel: 'Sale' }
    );

    // Record cash transaction if paid
    if (paymentStatus === 'paid') {
      await Transaction.create({
        type: 'cash_in',
        amount: totalAmount,
        category: 'Sale',
        reference: sale._id,
        refModel: 'Sale',
        description: `Sale ${invoiceNo} (${channel})`,
      });
    }

    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all sales (with filters)
// @route   GET /api/sales
exports.getSales = async (req, res) => {
  try {
    const { channel, startDate, endDate, paymentStatus } = req.query;
    const filter = {};
    if (channel) filter.channel = channel;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }
    const sales = await Sale.find(filter)
      .populate('items.product', 'name sku')
      .sort('-saleDate');
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('items.product', 'name sku');
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update payment status (e.g., mark due as paid)
// @route   PUT /api/sales/:id/payment
exports.updatePayment = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const { paymentStatus } = req.body;
    if (paymentStatus === 'paid' && sale.paymentStatus !== 'paid') {
      sale.paymentStatus = 'paid';
      await sale.save();
      // Record transaction
      await Transaction.create({
        type: 'cash_in',
        amount: sale.totalAmount,
        category: 'Sale',
        reference: sale._id,
        refModel: 'Sale',
        description: `Sale ${sale.invoiceNo} marked paid`,
      });
    } else {
      sale.paymentStatus = paymentStatus;
      await sale.save();
    }
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};