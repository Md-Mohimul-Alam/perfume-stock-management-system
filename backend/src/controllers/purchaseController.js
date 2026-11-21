
const mongoose = require('mongoose');

const Purchase = require('../models/Purchase');
const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');
const Transaction = require('../models/Transaction');

const { generateInvoiceNo } = require('../utils/generateInvoice');

const MAX_INVOICE_RETRIES = 3;

/* ========================================
   BASIC HELPERS
======================================== */

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toNumber = (value, label) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw createError(`${label} must be a valid number`);
  }

  return parsed;
};

const positiveNumber = (value, label) => {
  const parsed = toNumber(value, label);

  if (parsed <= 0) {
    throw createError(`${label} must be greater than 0`);
  }

  return parsed;
};

const positiveInteger = (value, label) => {
  const parsed = positiveNumber(value, label);

  if (!Number.isInteger(parsed)) {
    throw createError(`${label} must be a whole number`);
  }

  return parsed;
};

const validateObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) {
    throw createError(`Invalid ${label}`);
  }

  return value;
};

/* ========================================
   DATE
======================================== */

const parsePurchaseDate = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') {
    return fallback || new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError('Invalid purchase date');
  }

  return date;
};

/* ========================================
   ERROR RESPONSE
======================================== */

const sendError = (res, error) => {
  console.error('Purchase controller error:', error);

  if (error?.code === 11000) {
    return res.status(409).json({
      message: 'Purchase invoice already exists',
    });
  }

  if (error?.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid ID',
    });
  }

  const message = error?.message || 'Purchase operation failed';

  let status = error?.statusCode || 500;

  if (!error?.statusCode && /not found/i.test(message)) {
    status = 404;
  }

  if (
    !error?.statusCode &&
    /invalid|cannot|must|required|duplicate|stock|exceed/i.test(message)
  ) {
    status = 400;
  }

  return res.status(status).json({ message });
};

/* ========================================
   PAYMENT HELPERS
======================================== */

// Old purchases without paidAmount are treated as fully paid.
const getPaidAmount = (purchase) => {
  if (
    purchase.paidAmount === undefined ||
    purchase.paidAmount === null
  ) {
    return Number(purchase.totalAmount || 0);
  }

  return Number(purchase.paidAmount);
};

const getOutstandingAmount = (purchase) => {
  return Math.max(
    0,
    Number(purchase.totalAmount || 0) -
      getPaidAmount(purchase)
  );
};

const getPaymentStatus = (totalAmount, paidAmount) => {
  if (paidAmount <= 0) {
    return 'unpaid';
  }

  if (paidAmount >= totalAmount) {
    return 'paid';
  }

  return 'partial';
};

// Convert an old purchase into the new payment structure
// without losing its historical full-payment accounting.
const initializeLegacyPaymentTracking = (purchase) => {
  if (
    purchase.paidAmount === undefined ||
    purchase.paidAmount === null
  ) {
    const oldPaidAmount = Number(purchase.totalAmount || 0);

    purchase.paidAmount = oldPaidAmount;

    purchase.payments = oldPaidAmount > 0
      ? [
          {
            amount: oldPaidAmount,
            paymentDate: purchase.purchaseDate || new Date(),
            method: 'Cash',
            note: 'Historical purchase payment',
          },
        ]
      : [];

    purchase.paymentStatus = getPaymentStatus(
      purchase.totalAmount,
      oldPaidAmount
    );

    return;
  }

  if (!Array.isArray(purchase.payments)) {
    purchase.payments = [];
  }

  // Preserve any previously recorded amount that does not
  // yet have an individual payment record.
  const recordedPayments = purchase.payments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0
  );

  const missingPaymentAmount =
    Number(purchase.paidAmount) - recordedPayments;

  if (missingPaymentAmount > 0.001) {
    purchase.payments.push({
      amount: missingPaymentAmount,
      paymentDate: purchase.purchaseDate || new Date(),
      method: 'Cash',
      note: 'Previously recorded purchase payment',
    });
  }

  purchase.paymentStatus = getPaymentStatus(
    purchase.totalAmount,
    Number(purchase.paidAmount)
  );
};

const syncPurchaseTransaction = async ({
  purchase,
  session,
}) => {
  await Transaction.deleteMany({
    reference: purchase._id,
    refModel: 'Purchase',
    category: 'Purchase',
  }).session(session);

  const paymentRecords = Array.isArray(purchase.payments)
    ? purchase.payments
    : [];

  const transactions = paymentRecords
    .filter((payment) => Number(payment.amount) > 0)
    .map((payment) => ({
      type: 'cash_out',
      amount: Number(payment.amount),
      category: 'Purchase',
      reference: purchase._id,
      refModel: 'Purchase',
      date: payment.paymentDate || purchase.purchaseDate,
      description: `Payment for purchase ${purchase.invoiceNo}${
        payment.method ? ` (${payment.method})` : ''
      }${payment.note ? ` - ${payment.note}` : ''}`,
    }));

  // Fallback for legacy records not yet initialized.
  if (
    transactions.length === 0 &&
    (purchase.paidAmount === undefined ||
      purchase.paidAmount === null)
  ) {
    transactions.push({
      type: 'cash_out',
      amount: Number(purchase.totalAmount),
      category: 'Purchase',
      reference: purchase._id,
      refModel: 'Purchase',
      date: purchase.purchaseDate,
      description: `Historical purchase ${purchase.invoiceNo}`,
    });
  }

  if (transactions.length > 0) {
    await Transaction.create(transactions, { session });
  }
};

/* ========================================
   ITEM VALIDATION
======================================== */

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createError('At least one purchase item is required');
  }

  const seen = new Set();

  return items.map((item, index) => {
    const itemType = item?.itemType;

    if (!['RawMaterial', 'Bottle'].includes(itemType)) {
      throw createError(
        `Item ${index + 1} has an invalid item type`
      );
    }

    const itemId = validateObjectId(
      item?.item,
      `item ID at row ${index + 1}`
    );

    const quantity =
      itemType === 'Bottle'
        ? positiveInteger(
            item.quantity,
            `Item ${index + 1} quantity`
          )
        : positiveNumber(
            item.quantity,
            `Item ${index + 1} quantity`
          );

    const costPerUnit = positiveNumber(
      item.costPerUnit,
      `Item ${index + 1} cost`
    );

    const key = `${itemType}:${String(itemId)}`;

    if (seen.has(key)) {
      throw createError(
        `Duplicate purchase item at row ${index + 1}`
      );
    }

    seen.add(key);

    return {
      itemType,
      item: itemId,
      quantity,
      costPerUnit,
      totalCost: quantity * costPerUnit,
    };
  });
};

/* ========================================
   COST RECALCULATION
======================================== */

const recalculateMaterialCost = (material) => {
  const purchases = material.purchases || [];

  const totalQuantity = purchases.reduce(
    (total, purchase) =>
      total + Number(purchase.quantityMl || 0),
    0
  );

  const totalCost = purchases.reduce(
    (total, purchase) =>
      total + Number(purchase.totalCost || 0),
    0
  );

  material.avgCostPerMl =
    totalQuantity > 0 ? totalCost / totalQuantity : 0;
};

const recalculateBottleCost = (bottle) => {
  const purchases = bottle.purchases || [];

  const totalQuantity = purchases.reduce(
    (total, purchase) =>
      total + Number(purchase.quantity || 0),
    0
  );

  const totalCost = purchases.reduce(
    (total, purchase) =>
      total + Number(purchase.totalCost || 0),
    0
  );

  bottle.avgCostPerUnit =
    totalQuantity > 0 ? totalCost / totalQuantity : 0;

  bottle.totalPurchased = totalQuantity;
};

/* ========================================
   INVENTORY LOG
======================================== */

const createPurchaseLog = async ({
  purchase,
  itemType,
  itemId,
  changeQuantity,
  notes,
  date,
  session,
}) => {
  const data = {
    changeQuantity,
    reason: 'purchase',
    reference: purchase._id,
    refModel: 'Purchase',
    notes,
    date: date || new Date(),
  };

  if (itemType === 'RawMaterial') {
    data.material = itemId;
  }

  if (itemType === 'Bottle') {
    data.bottle = itemId;
  }

  await InventoryLog.create([data], { session });
};

/* ========================================
   CREATE INVENTORY ADDITION
======================================== */

const addPurchaseToInventory = async ({
  purchase,
  item,
  supplier,
  purchaseDate,
  session,
}) => {
  const {
    itemType,
    item: itemId,
    quantity,
    costPerUnit,
    totalCost,
  } = item;

  if (itemType === 'RawMaterial') {
    const material = await RawMaterial.findById(itemId).session(session);

    if (!material) {
      throw createError(`Raw material ${itemId} not found`, 404);
    }

    material.purchases.push({
      quantityMl: quantity,
      costPerMl: costPerUnit,
      totalCost,
      supplier,
      invoiceNo: purchase.invoiceNo,
      purchaseDate,
    });

    material.currentStockMl += quantity;
    material.isStockOut = false;
    material.currentCycleWastageMl = 0;
    material.lastRestockAt = purchaseDate;

    recalculateMaterialCost(material);

    await material.save({ session });

    await createPurchaseLog({
      purchase,
      itemType,
      itemId,
      changeQuantity: quantity,
      notes: `Purchase ${purchase.invoiceNo}: added ${quantity}ml`,
      date: purchaseDate,
      session,
    });

    return;
  }

  const bottle = await Bottle.findById(itemId).session(session);

  if (!bottle) {
    throw createError(`Bottle ${itemId} not found`, 404);
  }

  bottle.purchases.push({
    quantity,
    costPerUnit,
    totalCost,
    supplier,
    invoiceNo: purchase.invoiceNo,
    purchaseDate,
  });

  bottle.currentStock += quantity;
  bottle.isStockOut = false;

  recalculateBottleCost(bottle);

  await bottle.save({ session });

  await createPurchaseLog({
    purchase,
    itemType,
    itemId,
    changeQuantity: quantity,
    notes: `Purchase ${purchase.invoiceNo}: added ${quantity} bottle(s)`,
    date: purchaseDate,
    session,
  });
};

/* ========================================
   CREATE PURCHASE INTERNAL
======================================== */

const createPurchaseInternal = async ({
  invoiceNo,
  supplier,
  items,
  purchaseDate,
  notes,
  session,
}) => {
  const cleanInvoice = String(invoiceNo || '').trim();

  if (!cleanInvoice) {
    throw createError('Invoice number is required');
  }

  const existing = await Purchase.findOne({
    invoiceNo: cleanInvoice,
  })
    .session(session)
    .lean();

  if (existing) {
    throw createError(
      `Invoice ${cleanInvoice} already exists`,
      409
    );
  }

  const cleanSupplier = String(supplier || '').trim();
  const cleanDate = parsePurchaseDate(purchaseDate);
  const normalizedItems = normalizeItems(items);

  const totalAmount = normalizedItems.reduce(
    (total, item) => total + item.totalCost,
    0
  );

  const [purchase] = await Purchase.create(
    [
      {
        invoiceNo: cleanInvoice,
        supplier: cleanSupplier,
        items: normalizedItems,
        totalAmount,

        // New purchases start unpaid.
        paidAmount: 0,
        paymentStatus: 'unpaid',
        payments: [],

        purchaseDate: cleanDate,
        notes: String(notes || '').trim(),
      },
    ],
    { session }
  );

  for (const item of normalizedItems) {
    await addPurchaseToInventory({
      purchase,
      item,
      supplier: cleanSupplier,
      purchaseDate: cleanDate,
      session,
    });
  }

  await syncPurchaseTransaction({
    purchase,
    session,
  });

  return purchase;
};

/* ========================================
   CREATE PURCHASE
======================================== */

exports.createPurchase = async (req, res) => {
  const requestedInvoice = String(
    req.body?.invoiceNo || ''
  ).trim();

  const maxAttempts = requestedInvoice
    ? 1
    : MAX_INVOICE_RETRIES;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const invoiceNo =
        requestedInvoice || generateInvoiceNo('PUR');

      const purchase = await createPurchaseInternal({
        invoiceNo,
        supplier: req.body?.supplier,
        items: req.body?.items,
        purchaseDate: req.body?.purchaseDate,
        notes: req.body?.notes,
        session,
      });

      await session.commitTransaction();

      return res.status(201).json(purchase);
    } catch (error) {
      await session.abortTransaction();

      if (
        !requestedInvoice &&
        error?.code === 11000 &&
        attempt < maxAttempts
      ) {
        continue;
      }

      return sendError(res, error);
    } finally {
      session.endSession();
    }
  }

  return res.status(409).json({
    message: 'Could not generate purchase invoice. Please try again.',
  });
};

/* ========================================
   GET PURCHASES
======================================== */

exports.getPurchases = async (req, res) => {
  try {
    const { supplier, startDate, endDate, paymentStatus } = req.query;

    const filter = {};

    if (supplier) {
      filter.supplier = supplier;
    }

    if (paymentStatus) {
      if (!['unpaid', 'partial', 'paid'].includes(paymentStatus)) {
        throw createError('Invalid payment status');
      }

      if (paymentStatus === 'paid') {
        filter.$or = [
          { paymentStatus: 'paid' },
          { paidAmount: { $exists: false } },
          { paidAmount: null },
        ];
      } else {
        filter.paymentStatus = paymentStatus;
      }
    }

    if (startDate || endDate) {
      filter.purchaseDate = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          throw createError('Invalid start date');
        }

        filter.purchaseDate.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          throw createError('Invalid end date');
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          end.setUTCHours(23, 59, 59, 999);
        }

        filter.purchaseDate.$lte = end;
      }
    }

    const purchases = await Purchase.find(filter)
      .populate('items.item', 'name sku sizeMl type')
      .sort({
        purchaseDate: -1,
        createdAt: -1,
      });

    // Add a calculated outstanding amount to each result.
    const results = purchases.map((purchase) => {
      const data = purchase.toObject();

      data.calculatedPaidAmount = getPaidAmount(purchase);
      data.outstandingAmount = getOutstandingAmount(purchase);

      // Old documents without payment fields are historically paid.
      if (
        data.paidAmount === undefined ||
        data.paidAmount === null
      ) {
        data.paymentStatus = 'paid';
      }

      return data;
    });

    return res.json(results);
  } catch (error) {
    return sendError(res, error);
  }
};

/* ========================================
   GET SINGLE PURCHASE
======================================== */

exports.getPurchaseById = async (req, res) => {
  try {
    validateObjectId(req.params.id, 'purchase ID');

    const purchase = await Purchase.findById(
      req.params.id
    ).populate('items.item', 'name sku sizeMl type');

    if (!purchase) {
      return res.status(404).json({
        message: 'Purchase not found',
      });
    }

    const data = purchase.toObject();

    data.calculatedPaidAmount = getPaidAmount(purchase);
    data.outstandingAmount = getOutstandingAmount(purchase);

    if (
      data.paidAmount === undefined ||
      data.paidAmount === null
    ) {
      data.paymentStatus = 'paid';
    }

    return res.json(data);
  } catch (error) {
    return sendError(res, error);
  }
};

/* ========================================
   RECORD SUPPLIER PAYMENT
======================================== */

exports.addPurchasePayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    validateObjectId(req.params.id, 'purchase ID');

    const purchase = await Purchase.findById(
      req.params.id
    ).session(session);

    if (!purchase) {
      throw createError('Purchase not found', 404);
    }

    const amount = positiveNumber(
      req.body.amount,
      'Payment amount'
    );

    const method = req.body.method || 'Cash';

    const allowedMethods = [
      'Cash',
      'Bank',
      'Mobile Banking',
      'Other',
    ];

    if (!allowedMethods.includes(method)) {
      throw createError('Invalid payment method');
    }

    const paymentDate = parsePurchaseDate(
      req.body.paymentDate
    );

    const note = String(req.body.note || '').trim();

    // Preserve the original paid amount if this is a legacy purchase.
    initializeLegacyPaymentTracking(purchase);

    const paidAmount = Number(purchase.paidAmount || 0);
    const outstandingAmount =
      Number(purchase.totalAmount) - paidAmount;

    if (outstandingAmount <= 0.001) {
      throw createError('This purchase is already fully paid');
    }

    if (amount > outstandingAmount + 0.001) {
      throw createError(
        `Payment exceeds outstanding balance of ${outstandingAmount.toFixed(2)}`
      );
    }

    purchase.payments.push({
      amount,
      paymentDate,
      method,
      note,
    });

    purchase.paidAmount = paidAmount + amount;

    // Avoid floating-point display issues.
    purchase.paidAmount = Number(
      purchase.paidAmount.toFixed(2)
    );

    purchase.paymentStatus = getPaymentStatus(
      purchase.totalAmount,
      purchase.paidAmount
    );

    await purchase.save({ session });

    await syncPurchaseTransaction({
      purchase,
      session,
    });

    await session.commitTransaction();

    const updated = await Purchase.findById(
      purchase._id
    ).populate('items.item', 'name sku sizeMl type');

    const result = updated.toObject();

    result.outstandingAmount = getOutstandingAmount(updated);

    return res.json({
      message: 'Supplier payment recorded successfully',
      purchase: result,
    });
  } catch (error) {
    await session.abortTransaction();
    return sendError(res, error);
  } finally {
    session.endSession();
  }
};

/* ========================================
   UPDATE INVENTORY LINE
======================================== */

const updateInventoryLine = async ({
  purchase,
  oldItem,
  newItem,
  supplier,
  purchaseDate,
  session,
}) => {
  const itemType = newItem.itemType;
  const itemId = newItem.item;

  const oldQuantity = oldItem
    ? Number(oldItem.quantity)
    : 0;

  const newQuantity = Number(newItem.quantity);
  const delta = newQuantity - oldQuantity;

  if (itemType === 'RawMaterial') {
    const material = await RawMaterial.findById(itemId).session(session);

    if (!material) {
      throw createError(`Raw material ${itemId} not found`, 404);
    }

    if (
      delta < 0 &&
      material.currentStockMl < Math.abs(delta)
    ) {
      throw createError(
        `Cannot reduce purchase quantity by ${Math.abs(
          delta
        )}ml. Only ${material.currentStockMl}ml is currently available.`
      );
    }

    material.currentStockMl += delta;

    const entry = material.purchases.find(
      (purchaseEntry) =>
        purchaseEntry.invoiceNo === purchase.invoiceNo
    );

    if (entry) {
      entry.quantityMl = newQuantity;
      entry.costPerMl = newItem.costPerUnit;
      entry.totalCost = newItem.totalCost;
      entry.supplier = supplier;
      entry.purchaseDate = purchaseDate;
    } else {
      material.purchases.push({
        quantityMl: newQuantity,
        costPerMl: newItem.costPerUnit,
        totalCost: newItem.totalCost,
        supplier,
        invoiceNo: purchase.invoiceNo,
        purchaseDate,
      });
    }

    material.isStockOut =
      Number(material.currentStockMl || 0) <= 0;

    recalculateMaterialCost(material);

    await material.save({ session });

    if (delta !== 0) {
      await createPurchaseLog({
        purchase,
        itemType,
        itemId,
        changeQuantity: delta,
        notes: `Purchase ${purchase.invoiceNo} edited: ${
          delta > 0 ? 'added' : 'removed'
        } ${Math.abs(delta)}ml`,
        session,
      });
    }

    return;
  }

  const bottle = await Bottle.findById(itemId).session(session);

  if (!bottle) {
    throw createError(`Bottle ${itemId} not found`, 404);
  }

  if (
    delta < 0 &&
    bottle.currentStock < Math.abs(delta)
  ) {
    throw createError(
      `Cannot reduce purchase quantity by ${Math.abs(
        delta
      )}. Only ${bottle.currentStock} bottle(s) are currently available.`
    );
  }

  bottle.currentStock += delta;

  const entry = bottle.purchases.find(
    (purchaseEntry) =>
      purchaseEntry.invoiceNo === purchase.invoiceNo
  );

  if (entry) {
    entry.quantity = newQuantity;
    entry.costPerUnit = newItem.costPerUnit;
    entry.totalCost = newItem.totalCost;
    entry.supplier = supplier;
    entry.purchaseDate = purchaseDate;
  } else {
    bottle.purchases.push({
      quantity: newQuantity,
      costPerUnit: newItem.costPerUnit,
      totalCost: newItem.totalCost,
      supplier,
      invoiceNo: purchase.invoiceNo,
      purchaseDate,
    });
  }

  bottle.isStockOut =
    Number(bottle.currentStock || 0) <= 0;

  recalculateBottleCost(bottle);

  await bottle.save({ session });

  if (delta !== 0) {
    await createPurchaseLog({
      purchase,
      itemType,
      itemId,
      changeQuantity: delta,
      notes: `Purchase ${purchase.invoiceNo} edited: ${
        delta > 0 ? 'added' : 'removed'
      } ${Math.abs(delta)} bottle(s)`,
      session,
    });
  }
};

/* ========================================
   REMOVE INVENTORY LINE
======================================== */

const removeInventoryLine = async ({
  purchase,
  oldItem,
  session,
}) => {
  const itemType = oldItem.itemType;
  const itemId = oldItem.item;
  const quantity = Number(oldItem.quantity);

  if (itemType === 'RawMaterial') {
    const material = await RawMaterial.findById(itemId).session(session);

    if (!material) {
      throw createError(`Raw material ${itemId} not found`, 404);
    }

    if (material.currentStockMl < quantity) {
      throw createError(
        `Cannot remove ${material.name} from purchase. Current stock is ${material.currentStockMl}ml but purchase contains ${quantity}ml. Some stock has already been consumed.`
      );
    }

    material.currentStockMl -= quantity;

    material.isStockOut =
      Number(material.currentStockMl || 0) <= 0;

    material.purchases = material.purchases.filter(
      (entry) => entry.invoiceNo !== purchase.invoiceNo
    );

    recalculateMaterialCost(material);

    await material.save({ session });

    await createPurchaseLog({
      purchase,
      itemType,
      itemId,
      changeQuantity: -quantity,
      notes: `Purchase ${purchase.invoiceNo} edited: material removed completely`,
      session,
    });

    return;
  }

  const bottle = await Bottle.findById(itemId).session(session);

  if (!bottle) {
    throw createError(`Bottle ${itemId} not found`, 404);
  }

  if (bottle.currentStock < quantity) {
    throw createError(
      `Cannot remove bottle from purchase. Current stock is ${bottle.currentStock} but purchase contains ${quantity}. Some bottles have already been consumed.`
    );
  }

  bottle.currentStock -= quantity;

  bottle.isStockOut =
    Number(bottle.currentStock || 0) <= 0;

  bottle.purchases = bottle.purchases.filter(
    (entry) => entry.invoiceNo !== purchase.invoiceNo
  );

  recalculateBottleCost(bottle);

  await bottle.save({ session });

  await createPurchaseLog({
    purchase,
    itemType,
    itemId,
    changeQuantity: -quantity,
    notes: `Purchase ${purchase.invoiceNo} edited: bottle removed completely`,
    session,
  });
};

/* ========================================
   SYNC EMBEDDED PURCHASE METADATA
======================================== */

const syncPurchaseMetadata = async ({
  purchase,
  supplier,
  purchaseDate,
  session,
}) => {
  for (const item of purchase.items) {
    if (item.itemType === 'RawMaterial') {
      const material = await RawMaterial.findById(
        item.item
      ).session(session);

      if (!material) {
        continue;
      }

      const entry = material.purchases.find(
        (purchaseEntry) =>
          purchaseEntry.invoiceNo === purchase.invoiceNo
      );

      if (entry) {
        entry.supplier = supplier;
        entry.purchaseDate = purchaseDate;

        await material.save({ session });
      }

      continue;
    }

    const bottle = await Bottle.findById(item.item).session(session);

    if (!bottle) {
      continue;
    }

    const entry = bottle.purchases.find(
      (purchaseEntry) =>
        purchaseEntry.invoiceNo === purchase.invoiceNo
    );

    if (entry) {
      entry.supplier = supplier;
      entry.purchaseDate = purchaseDate;

      await bottle.save({ session });
    }
  }
};

/* ========================================
   UPDATE PURCHASE
======================================== */

exports.updatePurchase = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    validateObjectId(req.params.id, 'purchase ID');

    const purchase = await Purchase.findById(
      req.params.id
    ).session(session);

    if (!purchase) {
      throw createError('Purchase not found', 404);
    }

    // Preserve legacy payment history before changing purchase totals.
    initializeLegacyPaymentTracking(purchase);

    const supplier =
      req.body.supplier !== undefined
        ? String(req.body.supplier).trim()
        : purchase.supplier || '';

    const purchaseDate =
      req.body.purchaseDate !== undefined
        ? parsePurchaseDate(
            req.body.purchaseDate,
            purchase.purchaseDate
          )
        : purchase.purchaseDate;

    const notes =
      req.body.notes !== undefined
        ? String(req.body.notes || '').trim()
        : purchase.notes || '';

    const itemsWereProvided =
      req.body.items !== undefined;

    if (itemsWereProvided) {
      const newItems = normalizeItems(req.body.items);

      const oldMap = new Map();

      for (const oldItem of purchase.items) {
        const key = `${oldItem.itemType}:${String(oldItem.item)}`;
        oldMap.set(key, oldItem);
      }

      const newMap = new Map();

      for (const newItem of newItems) {
        const key = `${newItem.itemType}:${String(newItem.item)}`;
        newMap.set(key, newItem);

        const oldItem = oldMap.get(key);

        await updateInventoryLine({
          purchase,
          oldItem,
          newItem,
          supplier,
          purchaseDate,
          session,
        });
      }

      for (const [key, oldItem] of oldMap) {
        if (!newMap.has(key)) {
          await removeInventoryLine({
            purchase,
            oldItem,
            session,
          });
        }
      }

      const newTotalAmount = newItems.reduce(
        (total, item) => total + item.totalCost,
        0
      );

      if (newTotalAmount < Number(purchase.paidAmount) - 0.001) {
        throw createError(
          'Purchase total cannot be less than the amount already paid to the supplier'
        );
      }

      purchase.items = newItems;
      purchase.totalAmount = newTotalAmount;
    }

    purchase.supplier = supplier;
    purchase.purchaseDate = purchaseDate;
    purchase.notes = notes;

    purchase.paymentStatus = getPaymentStatus(
      purchase.totalAmount,
      Number(purchase.paidAmount || 0)
    );

    await purchase.save({ session });

    if (!itemsWereProvided) {
      await syncPurchaseMetadata({
        purchase,
        supplier,
        purchaseDate,
        session,
      });
    }

    await syncPurchaseTransaction({
      purchase,
      session,
    });

    await session.commitTransaction();

    const updated = await Purchase.findById(
      purchase._id
    ).populate('items.item', 'name sku sizeMl type');

    const result = updated.toObject();
    result.outstandingAmount = getOutstandingAmount(updated);

    return res.json(result);
  } catch (error) {
    await session.abortTransaction();
    return sendError(res, error);
  } finally {
    session.endSession();
  }
};

/* ========================================
   DELETE PURCHASE INVENTORY
======================================== */

const reversePurchaseItem = async ({
  purchase,
  item,
  session,
}) => {
  const quantity = Number(item.quantity);

  if (item.itemType === 'RawMaterial') {
    const material = await RawMaterial.findById(
      item.item
    ).session(session);

    if (!material) {
      throw createError(
        `Raw material ${item.item} not found`,
        404
      );
    }

    if (material.currentStockMl < quantity) {
      throw createError(
        `Cannot delete purchase ${purchase.invoiceNo}. ${material.name} currently has ${material.currentStockMl}ml but this purchase added ${quantity}ml. Some stock has already been consumed.`
      );
    }

    material.currentStockMl -= quantity;

    material.isStockOut =
      Number(material.currentStockMl || 0) <= 0;

    material.purchases = material.purchases.filter(
      (entry) => entry.invoiceNo !== purchase.invoiceNo
    );

    recalculateMaterialCost(material);

    await material.save({ session });

    await InventoryLog.create(
      [
        {
          material: material._id,
          changeQuantity: -quantity,
          reason: 'adjustment',
          reference: purchase._id,
          refModel: 'Purchase',
          notes: `Reversal of deleted purchase ${purchase.invoiceNo}`,
        },
      ],
      { session }
    );

    return;
  }

  const bottle = await Bottle.findById(item.item).session(session);

  if (!bottle) {
    throw createError(
      `Bottle ${item.item} not found`,
      404
    );
  }

  if (bottle.currentStock < quantity) {
    throw createError(
      `Cannot delete purchase ${purchase.invoiceNo}. Bottle stock is ${bottle.currentStock} but this purchase added ${quantity}. Some bottles have already been consumed.`
    );
  }

  bottle.currentStock -= quantity;

  bottle.isStockOut =
    Number(bottle.currentStock || 0) <= 0;

  bottle.purchases = bottle.purchases.filter(
    (entry) => entry.invoiceNo !== purchase.invoiceNo
  );

  recalculateBottleCost(bottle);

  await bottle.save({ session });

  await InventoryLog.create(
    [
      {
        bottle: bottle._id,
        changeQuantity: -quantity,
        reason: 'adjustment',
        reference: purchase._id,
        refModel: 'Purchase',
        notes: `Reversal of deleted purchase ${purchase.invoiceNo}`,
      },
    ],
    { session }
  );
};

/* ========================================
   DELETE PURCHASE
======================================== */


/* ========================================
   DELETE PURCHASE
======================================== */

exports.deletePurchase = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    validateObjectId(req.params.id, 'purchase ID');

    const purchase = await Purchase.findById(
      req.params.id
    ).session(session);

    if (!purchase) {
      throw createError('Purchase not found', 404);
    }

    // Protect supplier payment history.
    // Legacy purchases without paidAmount are treated as fully paid.
    const paidAmount = getPaidAmount(purchase);

    const hasPaymentRecords =
      Array.isArray(purchase.payments) &&
      purchase.payments.length > 0;

    if (paidAmount > 0 || hasPaymentRecords) {
      throw createError(
        'Cannot delete a purchase with recorded supplier payments. Please keep the purchase for accounting history.',
        400
      );
    }

    // Reverse inventory only when no payment has been recorded.
    for (const item of purchase.items) {
      await reversePurchaseItem({
        purchase,
        item,
        session,
      });
    }

    await InventoryLog.deleteMany({
      reference: purchase._id,
      refModel: 'Purchase',
      reason: 'purchase',
    }).session(session);

    await Transaction.deleteMany({
      reference: purchase._id,
      refModel: 'Purchase',
    }).session(session);

    await purchase.deleteOne({ session });

    await session.commitTransaction();

    return res.json({
      message: 'Purchase deleted and stock reversed successfully',
    });
  } catch (error) {
    await session.abortTransaction();
    return sendError(res, error);
  } finally {
    session.endSession();
  }
};


/* ========================================
   BULK CREATE PURCHASES
======================================== */

exports.bulkCreatePurchases = async (req, res) => {
  try {
    const purchases = req.body?.purchases;

    if (!Array.isArray(purchases) || purchases.length === 0) {
      return res.status(400).json({
        message: 'No purchases provided',
      });
    }

    const created = [];
    const errors = [];

    for (const purchaseData of purchases) {
      const session = await mongoose.startSession();

      try {
        session.startTransaction();

        const invoiceNo = String(
          purchaseData?.invoiceNo || ''
        ).trim();

        if (!invoiceNo) {
          throw createError('Invoice number is required');
        }

        const purchase = await createPurchaseInternal({
          invoiceNo,
          supplier: purchaseData.supplier,
          items: purchaseData.items,
          purchaseDate: purchaseData.purchaseDate,
          notes: purchaseData.notes,
          session,
        });

        await session.commitTransaction();

        created.push(purchase);
      } catch (error) {
        await session.abortTransaction();

        errors.push({
          invoiceNo: purchaseData?.invoiceNo || null,
          error: error.message,
        });
      } finally {
        session.endSession();
      }
    }

    return res.status(created.length ? 201 : 400).json({
      message: `Created ${created.length} purchases, ${errors.length} errors`,
      created,
      errors,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
