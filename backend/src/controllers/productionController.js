const Production = require('../models/Production');
const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');
const { deductRawMaterial, deductBottle } = require('../services/inventoryService');
const { generateInvoiceNo } = require('../utils/generateInvoice');

// @desc    Create production batch
// @route   POST /api/production
exports.createProduction = async (req, res) => {
  try {
    const { items, productionDate, notes } = req.body;

    for (const item of items) {
      const product = await Product.findById(item.product).populate('sizes.bottle');
      if (!product) throw new Error(`Product ${item.product} not found`);

      const sizeVariant = product.sizes.find(s => s.sizeMl === item.sizeMl);
      if (!sizeVariant) throw new Error(`Size ${item.sizeMl} not found for product`);

      // Deduct raw materials
      if (product.type === 'roll-on') {
        await deductRawMaterial(product.baseOil, sizeVariant.oilMlUsed * item.quantity, 'production', null);
      } else {
        for (const comp of product.blendComponents) {
          const mlUsed = (sizeVariant.sizeMl * comp.percentage / 100) * item.quantity;
          await deductRawMaterial(comp.material, mlUsed, 'production', null);
        }
      }

      // Deduct bottles
      await deductBottle(sizeVariant.bottle, item.quantity, 'production', null);
    }

    const batchNo = generateInvoiceNo('BATCH');
    const production = await Production.create({
      batchNo,
      items,
      productionDate: productionDate || Date.now(),
      notes,
      status: 'completed',
    });

    // Link logs
    await InventoryLog.updateMany(
      { reference: null, reason: 'production' },
      { reference: production._id, refModel: 'Production' }
    );

    res.status(201).json(production);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all production batches
// @route   GET /api/production
exports.getProductions = async (req, res) => {
  try {
    const productions = await Production.find()
      .populate('items.product', 'name sku')
      .sort('-productionDate');
    res.json(productions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single batch
// @route   GET /api/production/:id
exports.getProductionById = async (req, res) => {
  try {
    const production = await Production.findById(req.params.id)
      .populate('items.product', 'name sku');
    if (!production) return res.status(404).json({ message: 'Batch not found' });
    res.json(production);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};