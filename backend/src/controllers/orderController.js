const Order = require('../models/Order');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');
const { deductRawMaterial, deductBottle } = require('../services/inventoryService');
const mongoose = require('mongoose');

// ============================================================
// Helper: get the effective blend for a specific size
// ============================================================
function getSizeBlend(product, sizeMl) {
  const sizeVariant = product.sizes?.find(s => s.sizeMl === sizeMl);
  if (sizeVariant && sizeVariant.blendComponents && sizeVariant.blendComponents.length > 0) {
    return sizeVariant.blendComponents;
  }
  return product.blendComponents || [];
}

// ============================================================
// Generate next order number
// ============================================================
async function generateOrderNo() {
  const last = await Order.findOne({}, { orderNo: 1 }).sort({ orderNo: -1 }).lean();
  let next = 1;
  if (last && last.orderNo) {
    const match = last.orderNo.match(/(\d+)$/);
    if (match) next = parseInt(match[1]) + 1;
  }
  return `ORD-${String(next).padStart(4, '0')}`;
}

// ============================================================
// @desc    Create a new order (public – from client site)
// @route   POST /api/orders
// ============================================================
exports.createOrder = async (req, res) => {
  try {
    const { customer, items, subtotal, tax, shipping, totalAmount, notes } = req.body;

    // Validate
    if (!customer || !customer.name || !customer.mobile || !customer.address || !customer.city) {
      return res.status(400).json({ message: 'Customer details (name, mobile, address, city) are required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }

    // Validate each item and enrich with product reference
    const processedItems = [];
    for (const item of items) {
      if (!item.name || !item.sizeMl || !item.quantity || !item.unitPrice) {
        return res.status(400).json({ message: `Invalid item: ${JSON.stringify(item)}` });
      }

      let productRef = null;
      if (item.product) {
        productRef = await Product.findById(item.product).select('_id name sku');
      }

      processedItems.push({
        product: productRef ? productRef._id : undefined,
        name: item.name,
        sizeMl: item.sizeMl,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity,
      });
    }

    const orderNo = await generateOrderNo();

    const order = await Order.create({
      orderNo,
      customer: {
        name: customer.name.trim(),
        mobile: customer.mobile.trim(),
        address: customer.address.trim(),
        city: customer.city.trim(),
      },
      items: processedItems,
      subtotal: subtotal || processedItems.reduce((s, i) => s + i.totalPrice, 0),
      tax: tax || 0,
      shipping: shipping || 0,
      totalAmount: totalAmount || processedItems.reduce((s, i) => s + i.totalPrice, 0),
      notes: notes || '',
      status: 'pending',
      source: 'client-site',
    });

    res.status(201).json({
      message: 'Order placed successfully',
      orderNo: order.orderNo,
      order,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ============================================================
// @desc    Get all orders
// @route   GET /api/orders
// ============================================================
exports.getOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('items.product', 'name sku type')
      .populate('saleId', 'invoiceNo')
      .sort('-createdAt');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================================
// @desc    Get single order
// @route   GET /api/orders/:id
// ============================================================
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name sku type')
      .populate('saleId', 'invoiceNo totalAmount');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================================
// @desc    Update order status (pending / placed / cancelled)
// @route   PUT /api/orders/:id/status
// ============================================================
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'placed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    await order.save();
    res.json({ message: `Order marked as ${status}`, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================================
// @desc    Convert order → Sale (deducts stock)
// @route   POST /api/orders/:id/place
// ============================================================
exports.convertOrderToSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.saleId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'This order has already been converted to a sale' });
    }

    // ---------- Generate sequential invoice ----------
    const lastSale = await Sale.findOne({}, { invoiceNo: 1 }).sort({ invoiceNo: -1 }).lean();
    let nextNumber = 1;
    if (lastSale && lastSale.invoiceNo) {
      const match = lastSale.invoiceNo.match(/(\d+)$/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const invoiceNo = `INV-${String(nextNumber).padStart(4, '0')}`;

    // ---------- Process each item – deduct stock ----------
    const saleItems = [];
    let totalAmount = 0;

    for (const orderItem of order.items) {
      const product = await Product.findById(orderItem.product).populate('sizes.bottle').session(session);
      if (!product) {
        throw new Error(`Product "${orderItem.name}" (${orderItem.product}) not found`);
      }

      const sizeVariant = product.sizes.find(s => s.sizeMl === orderItem.sizeMl);
      if (!sizeVariant) {
        throw new Error(`Size ${orderItem.sizeMl}ml not available for ${product.name}`);
      }

      // Deduct raw materials
      if (product.type === 'roll-on') {
        if (product.baseOil) {
          await deductRawMaterial(
            product.baseOil,
            sizeVariant.oilMlUsed * orderItem.quantity,
            'sale',
            null
          );
        }
      } else {
        const comps = getSizeBlend(product, orderItem.sizeMl);
        for (const comp of comps) {
          const pct = comp.percentage || 0;
          if (pct <= 0) continue;
          const mlUsed = (sizeVariant.sizeMl * pct / 100) * orderItem.quantity;
          if (mlUsed <= 0) continue;
          await deductRawMaterial(comp.material, mlUsed, 'sale', null);
        }
      }

      // Deduct bottles
      await deductBottle(sizeVariant.bottle, orderItem.quantity, 'sale', null);

      totalAmount += orderItem.totalPrice;

      saleItems.push({
        product: product._id,
        sizeMl: orderItem.sizeMl,
        quantity: orderItem.quantity,
        unitPrice: orderItem.unitPrice,
        totalPrice: orderItem.totalPrice,
      });
    }

    // ---------- Create the Sale ----------
    const sale = await Sale.create([{
      invoiceNo,
      channel: 'Online Order',
      items: saleItems,
      totalAmount,
      saleDate: new Date(),
      paymentStatus: 'due',   // Online orders default to due – admin marks paid when collected
      notes: `Order ${order.orderNo} – ${order.customer.name} (${order.customer.mobile})`,
    }], { session });

    const createdSale = sale[0];

    // ---------- Link InventoryLogs to Sale ----------
    await InventoryLog.updateMany(
      { reference: null, reason: 'sale' },
      { reference: createdSale._id, refModel: 'Sale' }
    ).session(session);

    // ---------- Mark order as placed ----------
    order.status = 'placed';
    order.saleId = createdSale._id;
    await order.save({ session });

    await session.commitTransaction();

    res.json({
      message: `Order ${order.orderNo} placed successfully. Sale ${invoiceNo} created.`,
      sale: createdSale,
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Convert order to sale error:', error);
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// ============================================================
// @desc    Delete an order
// @route   DELETE /api/orders/:id
// ============================================================
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.saleId) {
      return res.status(400).json({ message: 'Cannot delete an order already converted to a sale. Delete the sale first.' });
    }
    await order.deleteOne();
    res.json({ message: 'Order deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};