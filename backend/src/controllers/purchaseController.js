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
    const { supplier, startDate, endDate } = req.query;
    const filter = {};
    if (supplier) filter.supplier = supplier;
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.$gte = new Date(startDate);
      if (endDate) filter.purchaseDate.$lte = new Date(endDate);
    }
    const purchases = await Purchase.find(filter)
      .populate('items.item', 'name sku sizeMl type') // Important!
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

// @desc    Bulk create purchases from sheet
// @route   POST /api/purchases/bulk
exports.bulkCreatePurchases = async (req, res) => {
  try {
    const { purchases } = req.body;
    if (!purchases || !purchases.length) {
      return res.status(400).json({ message: 'No purchases provided' });
    }

    const created = [];
    const errors = [];

    for (const purchaseData of purchases) {
      try {
        // Validate required fields
        if (!purchaseData.invoiceNo || !purchaseData.items || !purchaseData.items.length) {
          errors.push({ 
            purchaseData, 
            error: 'Missing invoiceNo or items' 
          });
          continue;
        }

        // Check for duplicate invoice
        const existing = await Purchase.findOne({ invoiceNo: purchaseData.invoiceNo });
        if (existing) {
          errors.push({ 
            purchaseData, 
            error: `Invoice ${purchaseData.invoiceNo} already exists` 
          });
          continue;
        }

        // Validate each item
        let totalAmount = 0;
        const validItems = [];

        for (const itemData of purchaseData.items) {
          const { itemType, item: itemId, quantity, costPerUnit } = itemData;

          // Validate required fields
          if (!itemType || !itemId || !quantity || quantity <= 0 || !costPerUnit || costPerUnit <= 0) {
            throw new Error(`Invalid item data: ${JSON.stringify(itemData)}`);
          }

          // Verify the referenced item exists
          const Model = itemType === 'RawMaterial' ? RawMaterial : Bottle;
          const exists = await Model.findById(itemId);
          if (!exists) {
            throw new Error(`Item ${itemId} not found in ${itemType} collection`);
          }

          const itemTotal = quantity * costPerUnit;
          totalAmount += itemTotal;

          validItems.push({
            itemType,
            item: itemId,
            quantity,
            costPerUnit,
            totalCost: itemTotal,
          });
        }

        // Create purchase
        const purchase = new Purchase({
          invoiceNo: purchaseData.invoiceNo,
          supplier: purchaseData.supplier || '',
          purchaseDate: purchaseData.purchaseDate || new Date(),
          notes: purchaseData.notes || '',
          items: validItems,
          totalAmount,
        });

        await purchase.save();
        created.push(purchase);
      } catch (err) {
        errors.push({ 
          purchaseData, 
          error: err.message 
        });
      }
    }

    res.status(201).json({
      message: `Created ${created.length} purchases, ${errors.length} errors`,
      created,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};