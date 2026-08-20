const Purchase = require('../models/Purchase');
const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');
const Transaction = require('../models/Transaction');
const { generateInvoiceNo } = require('../utils/generateInvoice');
const mongoose = require('mongoose');

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

// @desc    Update purchase (supplier, date, notes only)
// @route   PUT /api/purchases/:id
exports.updatePurchase = async (req, res) => {
  try {
    const { supplier, purchaseDate, notes } = req.body;
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    // Only allow updating these fields – items are immutable
    if (supplier !== undefined) purchase.supplier = supplier;
    if (purchaseDate) purchase.purchaseDate = new Date(purchaseDate);
    if (notes !== undefined) purchase.notes = notes;

    await purchase.save();
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a purchase (reverses stock)
// @route   DELETE /api/purchases/:id
exports.deletePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // 1. Reverse stock for each item
    for (const item of purchase.items) {
      const { itemType, item: itemId, quantity, costPerUnit, totalCost } = item;
      if (itemType === 'RawMaterial') {
        const material = await RawMaterial.findById(itemId).session(session);
        if (!material) {
          await session.abortTransaction();
          return res.status(404).json({ message: `Material ${itemId} not found` });
        }
        // Remove the purchase entry by invoice number
        const purchaseEntryIndex = material.purchases.findIndex(p => p.invoiceNo === purchase.invoiceNo);
        if (purchaseEntryIndex !== -1) {
          material.purchases.splice(purchaseEntryIndex, 1);
          // Recalculate avg cost
          const totalQty = material.purchases.reduce((sum, p) => sum + p.quantityMl, 0);
          const totalCostSum = material.purchases.reduce((sum, p) => sum + p.totalCost, 0);
          material.avgCostPerMl = totalQty > 0 ? totalCostSum / totalQty : 0;
          material.currentStockMl -= quantity;
          await material.save({ session });
        } else {
          // Fallback: just subtract stock
          material.currentStockMl -= quantity;
          await material.save({ session });
        }
        // Delete inventory logs for this purchase
        await InventoryLog.deleteMany({
          reference: purchase._id,
          reason: 'purchase',
          material: material._id,
        }).session(session);
      } else if (itemType === 'Bottle') {
        const bottle = await Bottle.findById(itemId).session(session);
        if (!bottle) {
          await session.abortTransaction();
          return res.status(404).json({ message: `Bottle ${itemId} not found` });
        }
        // Remove purchase entry by invoice
        const purchaseEntryIndex = bottle.purchases.findIndex(p => p.invoiceNo === purchase.invoiceNo);
        if (purchaseEntryIndex !== -1) {
          bottle.purchases.splice(purchaseEntryIndex, 1);
          const totalQty = bottle.purchases.reduce((sum, p) => sum + p.quantity, 0);
          const totalCostSum = bottle.purchases.reduce((sum, p) => sum + p.totalCost, 0);
          bottle.avgCostPerUnit = totalQty > 0 ? totalCostSum / totalQty : 0;
          bottle.currentStock -= quantity;
          await bottle.save({ session });
        } else {
          bottle.currentStock -= quantity;
          await bottle.save({ session });
        }
        await InventoryLog.deleteMany({
          reference: purchase._id,
          reason: 'purchase',
          bottle: bottle._id,
        }).session(session);
      }
    }

    // 2. Delete transaction
    await Transaction.deleteMany({ reference: purchase._id, refModel: 'Purchase' }).session(session);

    // 3. Delete the purchase itself
    await purchase.deleteOne({ session });

    await session.commitTransaction();
    res.json({ message: 'Purchase deleted and stock reversed' });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
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
            error: 'Missing invoiceNo or items',
          });
          continue;
        }

        // Check for duplicate invoice
        const existing = await Purchase.findOne({ invoiceNo: purchaseData.invoiceNo });
        if (existing) {
          errors.push({
            purchaseData,
            error: `Invoice ${purchaseData.invoiceNo} already exists`,
          });
          continue;
        }

        // Validate each item
        let totalAmount = 0;
        const validItems = [];

        for (const itemData of purchaseData.items) {
          const { itemType, item: itemId, quantity, costPerUnit } = itemData;

          if (!itemType || !itemId || !quantity || quantity <= 0 || !costPerUnit || costPerUnit <= 0) {
            throw new Error(`Invalid item data: ${JSON.stringify(itemData)}`);
          }

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
          error: err.message,
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