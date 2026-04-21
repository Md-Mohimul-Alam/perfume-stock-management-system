const Purchase = require('../models/Purchase');
const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');
const Transaction = require('../models/Transaction');
const { generateInvoiceNo } = require('../utils/generateInvoice');

// @desc    Create a purchase (materials/bottles)
// @route   POST /api/purchases
exports.createPurchase = async (req, res) => {
  try {
    const { supplier, items, purchaseDate, notes } = req.body;

    // Calculate total and process each item
    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const { itemType, item: itemId, quantity, costPerUnit } = item;
      const totalCost = quantity * costPerUnit;
      totalAmount += totalCost;

      let itemRef;
      if (itemType === 'RawMaterial') {
        itemRef = await RawMaterial.findById(itemId);
        if (!itemRef) throw new Error(`Material ${itemId} not found`);
        itemRef.addPurchase(quantity, costPerUnit, totalCost, supplier, req.body.invoiceNo);
        await itemRef.save();

        await InventoryLog.create({
          material: itemId,
          changeQuantity: quantity,
          reason: 'purchase',
          reference: null, // will be set after purchase creation
          notes: `Purchase invoice ${req.body.invoiceNo || 'manual'}`,
        });
      } else {
        itemRef = await Bottle.findById(itemId);
        if (!itemRef) throw new Error(`Bottle ${itemId} not found`);
        itemRef.addPurchase(quantity, costPerUnit, totalCost, supplier, req.body.invoiceNo);
        await itemRef.save();

        await InventoryLog.create({
          bottle: itemId,
          changeQuantity: quantity,
          reason: 'purchase',
          notes: `Purchase invoice ${req.body.invoiceNo || 'manual'}`,
        });
      }

      processedItems.push({
        itemType,
        item: itemId,
        quantity,
        costPerUnit,
        totalCost,
      });
    }

    const invoiceNo = req.body.invoiceNo || generateInvoiceNo('PUR');
    const purchase = await Purchase.create({
      invoiceNo,
      supplier,
      items: processedItems,
      totalAmount,
      purchaseDate: purchaseDate || Date.now(),
      notes,
    });

    // Link logs to purchase
    await InventoryLog.updateMany(
      { reference: null, reason: 'purchase' },
      { reference: purchase._id, refModel: 'Purchase' }
    );

    // Record transaction (cash out)
    await Transaction.create({
      type: 'cash_out',
      amount: totalAmount,
      category: 'Purchase',
      reference: purchase._id,
      refModel: 'Purchase',
      description: `Purchase ${invoiceNo}`,
    });

    res.status(201).json(purchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all purchases
// @route   GET /api/purchases
exports.getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .populate('items.item', 'name sku sizeMl type')
      .sort('-purchaseDate');
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single purchase
// @route   GET /api/purchases/:id
exports.getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('items.item', 'name sku sizeMl type');
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};