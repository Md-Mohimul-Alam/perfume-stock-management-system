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

      // Deduct bottles (always attempt)
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

    await InventoryLog.updateMany(
      { reference: null, reason: 'sale' },
      { reference: sale._id, refModel: 'Sale' }
    );

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
      .populate('items.product', 'name sku type')   // ✅ includes type
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
      .populate('items.product', 'name sku type'); // ✅ includes type
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

// =============================================
// Bulk create sales from CSV/Excel
// =============================================
// @desc    Bulk create sales from CSV/Excel
// @route   POST /api/sales/bulk
exports.bulkCreateSales = async (req, res) => {
  try {
    const { sales } = req.body; // array of sale objects
    if (!sales || !sales.length) {
      return res.status(400).json({ message: 'No sales provided' });
    }

    const errors = [];
    const created = [];

    for (const saleData of sales) {
      try {
        // Validate required fields
        const { invoiceNo, channel, items, saleDate, paymentStatus, notes } = saleData;
        if (!invoiceNo || !channel || !items || !items.length) {
          errors.push({ saleData, error: 'Missing required fields: invoiceNo, channel, items' });
          continue;
        }

        // Check if invoice already exists
        const existing = await Sale.findOne({ invoiceNo });
        if (existing) {
          errors.push({ saleData, error: `Invoice ${invoiceNo} already exists` });
          continue;
        }

        // Prepare items with product lookups and stock deduction
        const processedItems = [];
        let totalAmount = 0;

        for (const item of items) {
          const { sku, sizeMl, quantity, unitPrice } = item;

          // Find product by SKU and populate bottle info
          const product = await Product.findOne({ sku }).populate('sizes.bottle');
          if (!product) {
            errors.push({ saleData, error: `Product SKU ${sku} not found` });
            continue;
          }

          // Check if size exists in product
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

        // If any item failed, skip this sale entirely
        if (processedItems.length === 0) {
          continue;
        }

        // Create sale
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

        // Now deduct stock for each item
        for (const item of processedItems) {
          const { productRef, sizeVariant, quantity } = item;

          // Deduct bottles
          await deductBottle(sizeVariant.bottle, quantity, 'sale', sale);

          // Deduct raw materials
          if (productRef.type === 'roll-on') {
            await deductRawMaterial(productRef.baseOil, sizeVariant.oilMlUsed * quantity, 'sale', sale);
          } else {
            for (const comp of productRef.blendComponents) {
              const mlUsed = (sizeVariant.sizeMl * comp.percentage / 100) * quantity;
              await deductRawMaterial(comp.material, mlUsed, 'sale', sale);
            }
          }
        }

        // Record cash transaction if paid
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