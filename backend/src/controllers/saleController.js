const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');
const { deductRawMaterial, deductBottle } = require('../services/inventoryService');
const { generateInvoiceNo } = require('../utils/generateInvoice');

// @desc    Create a sale (auto-deduct stock) – with sequential invoice numbers
// @route   POST /api/sales
exports.createSale = async (req, res) => {
  try {
    const { channel, items, saleDate, paymentStatus, notes } = req.body;
    let totalAmount = 0;

    // ---------- Get next invoice number ----------
    const lastSale = await Sale.findOne().sort({ createdAt: -1 });
    let nextNumber = 1;
    if (lastSale && lastSale.invoiceNo) {
      const match = lastSale.invoiceNo.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const invoiceNo = `INV-${String(nextNumber).padStart(4, '0')}`;

    // ---------- Process items ----------
    for (const item of items) {
      const product = await Product.findById(item.product).populate('sizes.bottle');
      if (!product) throw new Error(`Product ${item.product} not found`);

      const sizeVariant = product.sizes.find(s => s.sizeMl === item.sizeMl);
      if (!sizeVariant) throw new Error(`Size ${item.sizeMl} not available for this product`);

      totalAmount += item.quantity * item.unitPrice;

      // ---------- Safe raw material deduction ----------
      if (product.type === 'roll-on') {
        if (product.baseOil) {
          await deductRawMaterial(product.baseOil, sizeVariant.oilMlUsed * item.quantity, 'sale', null);
        } else {
          console.warn(`⚠️ No baseOil for ${product.name} (SKU: ${product.sku}) – skipping raw material deduction.`);
        }
      } else {
        if (product.blendComponents && product.blendComponents.length > 0) {
          for (const comp of product.blendComponents) {
            if (comp.material) {
              const mlUsed = (sizeVariant.sizeMl * comp.percentage / 100) * item.quantity;
              await deductRawMaterial(comp.material, mlUsed, 'sale', null);
            } else {
              console.warn(`⚠️ Missing material in blend for ${product.name} – skipping.`);
            }
          }
        } else {
          console.warn(`⚠️ No blendComponents for ${product.name} (SKU: ${product.sku}) – skipping raw material deduction.`);
        }
      }

      // Deduct bottles
      await deductBottle(sizeVariant.bottle, item.quantity, 'sale', null);
    }

    // ---------- Create sale ----------
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

// @desc    Get all sales (with filters) – populates description
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
      .populate('items.product', 'name sku type description')
      .sort('-saleDate');
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single sale – populates description
// @route   GET /api/sales/:id
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('items.product', 'name sku type description');
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update payment status (e.g., mark due as paid)
// @route   PUT /api/sales/:id/payment  (and also PATCH /api/sales/:id)
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

// ============================================================
// ✅ UPDATED bulkCreateSales with trimming and duplicate check
// ============================================================
// @desc    Bulk create sales from CSV/Excel
// @route   POST /api/sales/bulk
exports.bulkCreateSales = async (req, res) => {
  try {
    const { sales } = req.body;
    if (!sales || !sales.length) {
      return res.status(400).json({ message: 'No sales provided' });
    }

    // 1️⃣ Extract all invoice numbers, trimming any leading/trailing spaces
    const invoiceNos = sales.map(s => s.invoiceNo?.trim()).filter(Boolean);

    // 2️⃣ Query the database for any that already exist (exact match)
    const existingSales = await Sale.find({ invoiceNo: { $in: invoiceNos } }, 'invoiceNo').lean();
    const existingSet = new Set(existingSales.map(s => s.invoiceNo));

    // 3️⃣ Separate new sales from duplicates (trim each invoice when comparing)
    const newSales = sales.filter(s => !existingSet.has(s.invoiceNo?.trim()));
    const duplicateSales = sales.filter(s => existingSet.has(s.invoiceNo?.trim()));

    const errors = [];
    const created = [];

    // 4️⃣ Report duplicates as errors
    for (const sale of duplicateSales) {
      errors.push({
        saleData: sale,
        error: `Invoice ${sale.invoiceNo?.trim()} already exists`
      });
    }

    // 5️⃣ Process only brand‑new sales
    for (const saleData of newSales) {
      try {
        const invoiceNo = saleData.invoiceNo?.trim();
        const { channel, items, saleDate, paymentStatus, notes } = saleData;

        if (!invoiceNo || !channel || !items || !items.length) {
          errors.push({ saleData, error: 'Missing required fields: invoiceNo, channel, items' });
          continue;
        }

        // Process items
        const processedItems = [];
        let totalAmount = 0;

        for (const item of items) {
          const { sku, sizeMl, quantity, unitPrice } = item;

          const product = await Product.findOne({ sku }).populate('sizes.bottle');
          if (!product) {
            errors.push({ saleData, error: `Product SKU ${sku} not found` });
            continue;
          }

          const sizeVariant = product.sizes.find(s => s.sizeMl === sizeMl);
          if (!sizeVariant) {
            errors.push({ saleData, error: `Size ${sizeMl}ml not available for SKU ${sku}` });
            continue;
          }

          const itemTotal = quantity * unitPrice;
          totalAmount += itemTotal;
          processedItems.push({
            product: product._id,
            sizeMl,
            quantity,
            unitPrice,
            totalPrice: itemTotal,
            productRef: product,
            sizeVariant,
          });
        }

        if (processedItems.length === 0) continue;

        // Create the sale
        const sale = await Sale.create({
          invoiceNo,
          channel,
          items: processedItems.map(({ product, sizeMl, quantity, unitPrice, totalPrice }) => ({
            product,
            sizeMl,
            quantity,
            unitPrice,
            totalPrice,
          })),
          totalAmount,
          paymentStatus: paymentStatus || 'paid',
          saleDate: saleDate ? new Date(saleDate) : new Date(),
          notes: notes || '',
        });

        // Deduct stock
        for (const item of processedItems) {
          const { productRef, sizeVariant, quantity } = item;
          await deductBottle(sizeVariant.bottle, quantity, 'sale', sale);
          if (productRef.type === 'roll-on') {
            await deductRawMaterial(productRef.baseOil, sizeVariant.oilMlUsed * quantity, 'sale', sale);
          } else {
            for (const comp of productRef.blendComponents) {
              const mlUsed = (sizeVariant.sizeMl * comp.percentage / 100) * quantity;
              await deductRawMaterial(comp.material, mlUsed, 'sale', sale);
            }
          }
        }

        if (sale.paymentStatus === 'paid') {
          await Transaction.create({
            type: 'cash_in',
            amount: totalAmount,
            category: 'Sale',
            reference: sale._id,
            refModel: 'Sale',
            description: `Sale ${invoiceNo} (${channel})`,
          });
        }

        created.push(sale);
      } catch (err) {
        errors.push({ saleData, error: err.message });
      }
    }

    res.status(201).json({
      message: `Created ${created.length} sales, ${errors.length} errors`,
      created,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a sale (permanently)
// @route   DELETE /api/sales/:id
exports.deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    await InventoryLog.deleteMany({ reference: sale._id, refModel: 'Sale' });
    await Transaction.deleteMany({ reference: sale._id, refModel: 'Sale' });
    await sale.deleteOne();

    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};