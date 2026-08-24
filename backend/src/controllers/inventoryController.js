const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');
// Optional: import Product if you want to check references before delete
// const Product = require('../models/Product');

// @desc    Get all raw materials with stock and total purchase cost
// @route   GET /api/inventory/materials
exports.getMaterials = async (req, res) => {
  try {
    // 1. Fetch all real materials
    const materials = await RawMaterial.find();
    
    // 2. Map to add totalPurchaseCost
    const result = materials.map(m => {
      const totalPurchaseCost = (m.purchases || []).reduce((sum, p) => sum + (p.totalCost || 0), 0);
      const obj = m.toObject();
      delete obj.purchases;
      return {
        ...obj,
        totalPurchaseCost,
      };
    });

    // 3. Compute usage for SR_SP and LUXE1_SP from sales
    //    We'll compute total oil used (all oils combined) per product.
    const sales = await Sale.find().populate('items.product');
    const usageMap = {
      'SR_SP': 0,
      'LUXE1_SP': 0,
    };

    for (const sale of sales) {
      if (!sale.items) continue;
      for (const item of sale.items) {
        const product = item.product;
        if (!product) continue;
        const sku = product.sku;
        if (sku !== 'SR_SP' && sku !== 'LUXE1_SP') continue;

        const sizeMl = item.sizeMl || 0;
        const qty = item.quantity || 0;

        // Get size variant to ensure we have the correct bottle size
        const sizeVariant = product.sizes.find(s => s.sizeMl === sizeMl);
        if (!sizeVariant) continue;

        // Compute total oil used from blend components
        let totalOilPct = 0;
        if (product.blendComponents && product.blendComponents.length > 0) {
          // Sum the percentages of oil components
          // We'll assume all components except ethanol and fixatives are oils.
          // We can identify them by material type if we populate, but to avoid extra queries,
          // we rely on the fact that in our system, oils are the first components.
          // Safer: we can fetch the material types, but that's heavy.
          // Instead, we use the total oil percentage from the blend rules, as we know the rules.
          // But to be generic, we can compute oil total as 100 - (ethanol + iso + glx + ambx) if they exist.
          // However, we can simply look at the percentages and sum them, but we need to know which are oils.
          // We know that for our sprays, the oil components are the ones that are not ethanol/fixatives.
          // So we can compute total oil by subtracting known fixative percentages.
          // We'll use the sprayRules object directly to get oil percentage for the product's max size.
          // That's simpler and matches the blend logic.
          // We'll compute the oil percentage based on the product's max size.
        }

        // Instead of complex logic, use the same sprayRules as in applyExactBlends.
        // Determine the oil percentage for this product's size.
        const sprayRules = {
          '6': 45,
          '15': 45,
          '30': 45,
          '50': 50,
          '100': 55,
        };
        // Determine which rule applies based on the product's maximum size
        // (since the blend is set per product, not per size, we use max size).
        const maxSize = product.sizes.length > 0
          ? Math.max(...product.sizes.map(s => s.sizeMl))
          : sizeMl; // fallback to current size
        let oilPct = 45; // default
        for (const [max, pct] of Object.entries(sprayRules)) {
          if (maxSize <= parseInt(max)) {
            oilPct = pct;
            break;
          }
        }
        // But if product is special, we already have its blendComponents,
        // but we can still use the rule because the special blend's oil total is the same as standard for that size.
        // For SR_SP and LUXE1_SP, the oil total percentages are the same as standard sprays of that size.
        // So the rule works.

        const totalOilMl = (sizeMl * (oilPct / 100)) * qty;
        usageMap[sku] = (usageMap[sku] || 0) + totalOilMl;
      }
    }

    // 4. Add virtual entries with computed usage
    const virtualMaterials = [
      {
        _id: 'SR_SP_VIRTUAL',
        name: 'SRK Spray',
        sku: 'SR_SP',
        type: 'oil',
        currentStockMl: 0,
        avgCostPerMl: 0,
        totalPurchaseCost: 0,
        usedOil: usageMap['SR_SP'] || 0,
        availableOil: 0,
      },
      {
        _id: 'LUXE1_VIRTUAL',
        name: 'Luxe Special',
        sku: 'LUXE1',
        type: 'oil',
        currentStockMl: 0,
        avgCostPerMl: 0,
        totalPurchaseCost: 0,
        usedOil: usageMap['LUXE1_SP'] || 0,
        availableOil: 0,
      },
    ];

    // 5. Combine real + virtual
    const allMaterials = [...result, ...virtualMaterials];

    res.json(allMaterials);
  } catch (error) {
    console.error('Error in getMaterials:', error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
};

// @desc    Get single raw material
// @route   GET /api/inventory/materials/:id
exports.getMaterialById = async (req, res) => {
  try {
    const material = await RawMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json(material);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new raw material type
// @route   POST /api/inventory/materials
exports.createMaterial = async (req, res) => {
  try {
    const { name, sku, type } = req.body;
    const material = await RawMaterial.create({ name, sku, type });
    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update raw material
// @route   PUT /api/inventory/materials/:id
exports.updateMaterial = async (req, res) => {
  try {
    const { name, sku, type } = req.body;
    const material = await RawMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });

    material.name = name || material.name;
    material.sku = sku || material.sku;
    material.type = type || material.type;
    await material.save();
    res.json(material);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a raw material
// @route   DELETE /api/inventory/materials/:id
exports.deleteMaterial = async (req, res) => {
  try {
    const material = await RawMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });

    // Optional: check if material is used in products before deleting
    // const Product = require('../models/Product');
    // const usedInProducts = await Product.findOne({
    //   $or: [
    //     { baseOil: req.params.id },
    //     { 'blendComponents.material': req.params.id }
    //   ]
    // });
    // if (usedInProducts) {
    //   return res.status(400).json({
    //     message: 'Cannot delete: material is used in one or more products'
    //   });
    // }

    await material.deleteOne();
    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all bottle types
// @route   GET /api/inventory/bottles
exports.getBottles = async (req, res) => {
  try {
    // ✅ Keep excluding purchases for performance
    const bottles = await Bottle.find().select('-purchases');
    res.json(bottles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new bottle type
// @route   POST /api/inventory/bottles
exports.createBottle = async (req, res) => {
  try {
    const { sizeMl, type } = req.body;
    const bottle = await Bottle.create({ sizeMl, type });
    res.status(201).json(bottle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a bottle type (including stock and cost)
// @route   PUT /api/inventory/bottles/:id
exports.updateBottle = async (req, res) => {
  try {
    const { sizeMl, type, currentStock, avgCostPerUnit } = req.body;
    const bottle = await Bottle.findById(req.params.id);
    if (!bottle) return res.status(404).json({ message: 'Bottle not found' });

    if (sizeMl !== undefined) bottle.sizeMl = parseFloat(sizeMl);
    if (type) bottle.type = type;
    if (currentStock !== undefined && currentStock >= 0) bottle.currentStock = parseFloat(currentStock);
    if (avgCostPerUnit !== undefined && avgCostPerUnit >= 0) bottle.avgCostPerUnit = parseFloat(avgCostPerUnit);
    await bottle.save();
    res.json(bottle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a bottle type
// @route   DELETE /api/inventory/bottles/:id
exports.deleteBottle = async (req, res) => {
  try {
    const bottle = await Bottle.findById(req.params.id);
    if (!bottle) return res.status(404).json({ message: 'Bottle not found' });

    // Optional: check if bottle is used in products before deleting
    // const Product = require('../models/Product');
    // const usedInProducts = await Product.findOne({ 'sizes.bottle': req.params.id });
    // if (usedInProducts) {
    //   return res.status(400).json({
    //     message: 'Cannot delete: bottle is used in one or more products'
    //   });
    // }

    await bottle.deleteOne();
    res.json({ message: 'Bottle deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get inventory logs
// @route   GET /api/inventory/logs
exports.getLogs = async (req, res) => {
  try {
    const logs = await InventoryLog.find()
      .populate('material', 'name sku')
      .populate('bottle', 'sizeMl type')
      .sort('-date')
      .limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk create raw materials from Excel/CSV
// @route   POST /api/inventory/materials/bulk
exports.bulkCreateMaterials = async (req, res) => {
  try {
    const { items } = req.body; // array of { name, sku, type }
    if (!items || !items.length) {
      return res.status(400).json({ message: 'No items provided' });
    }

    const errors = [];
    const created = [];
    for (const item of items) {
      try {
        const { name, sku, type } = item;
        if (!name || !sku || !type) {
          errors.push({ item, error: 'Missing required fields (name, sku, type)' });
          continue;
        }
        const existing = await RawMaterial.findOne({ sku });
        if (existing) {
          errors.push({ item, error: `SKU '${sku}' already exists` });
          continue;
        }
        const material = await RawMaterial.create({ name, sku, type });
        created.push(material);
      } catch (err) {
        errors.push({ item, error: err.message });
      }
    }

    res.status(201).json({
      message: `Created ${created.length} materials, ${errors.length} errors`,
      created,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk create bottles from Excel/CSV
// @route   POST /api/inventory/bottles/bulk

exports.bulkCreateBottles = async (req, res) => {
  try {
    const { items } = req.body; // array of { sizeMl, type, currentStock?, avgCostPerUnit? }
    if (!items || !items.length) {
      return res.status(400).json({ message: 'No items provided' });
    }

    const errors = [];
    const created = [];
    for (const item of items) {
      try {
        const { sizeMl, type, currentStock = 0, avgCostPerUnit = 0 } = item;
        if (sizeMl === undefined || !type) {
          errors.push({ item, error: 'Missing required fields (sizeMl, type)' });
          continue;
        }
        const existing = await Bottle.findOne({ sizeMl, type });
        if (existing) {
          errors.push({ item, error: `Bottle ${sizeMl}ml (${type}) already exists` });
          continue;
        }
        const bottle = await Bottle.create({
          sizeMl,
          type,
          currentStock: Math.max(0, currentStock),
          avgCostPerUnit: Math.max(0, avgCostPerUnit),
        });
        created.push(bottle);
      } catch (err) {
        errors.push({ item, error: err.message });
      }
    }

    res.status(201).json({
      message: `Created ${created.length} bottles, ${errors.length} errors`,
      created,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Import materials with purchase history
// @route   POST /api/inventory/materials/import
exports.importMaterialsWithPurchases = async (req, res) => {
  try {
    const { items } = req.body; // array of { name, sku, type, purchases: [{ quantityMl, costPerMl, totalCost, supplier?, invoiceNo? }] }
    if (!items || !items.length) {
      return res.status(400).json({ message: 'No items provided' });
    }

    const errors = [];
    const created = [];

    for (const item of items) {
      try {
        const { name, sku, type, purchases = [] } = item;
        if (!name || !sku || !type) {
          errors.push({ item, error: 'Missing name, sku, or type' });
          continue;
        }
        // Check duplicate SKU
        const existing = await RawMaterial.findOne({ sku });
        if (existing) {
          errors.push({ item, error: `SKU '${sku}' already exists` });
          continue;
        }
        // Create material with no purchases yet
        const material = new RawMaterial({ name, sku, type, currentStockMl: 0, avgCostPerMl: 0 });
        // Add each purchase
        for (const p of purchases) {
          if (!p.quantityMl || !p.costPerMl) continue;
          const totalCost = p.quantityMl * p.costPerMl;
          material.addPurchase(p.quantityMl, p.costPerMl, totalCost, p.supplier || '', p.invoiceNo || '');
        }
        await material.save();
        created.push(material);
      } catch (err) {
        errors.push({ item, error: err.message });
      }
    }

    res.status(201).json({
      message: `Imported ${created.length} materials, ${errors.length} errors`,
      created,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// @desc    Bulk add stock to bottles (e.g., from production)
// @route   POST /api/inventory/bottles/bulk-add-stock
exports.bulkAddStockToBottles = async (req, res) => {
  try {
    const { items } = req.body; // array of { sizeMl, type, quantity, costPerUnit? }
    if (!items || !items.length) {
      return res.status(400).json({ message: 'No items provided' });
    }

    const errors = [];
    const updated = [];

    for (const item of items) {
      try {
        const { sizeMl, type, quantity, costPerUnit } = item;
        if (sizeMl === undefined || !type || !quantity || quantity <= 0) {
          errors.push({ item, error: 'Missing or invalid fields (sizeMl, type, quantity)' });
          continue;
        }
        const bottle = await Bottle.findOne({ sizeMl, type });
        if (!bottle) {
          errors.push({ item, error: `Bottle ${sizeMl}ml (${type}) not found` });
          continue;
        }
        // Add stock – if costPerUnit provided, treat as purchase; otherwise just add stock without changing average cost?
        if (costPerUnit !== undefined && costPerUnit > 0) {
          const totalCost = quantity * costPerUnit;
          bottle.addPurchase(quantity, costPerUnit, totalCost, 'Production', 'BATCH-PROD');
        } else {
          // Just increase stock without changing avg cost (production from raw materials)
          bottle.currentStock += quantity;
          // optionally we could keep avg cost unchanged
        }
        await bottle.save();

        // ✅ CREATE INVENTORY LOG
        await InventoryLog.create({
          bottle: bottle._id,
          changeQuantity: quantity,
          reason: 'production',
          notes: `Bulk added ${quantity} bottles (${sizeMl}ml, ${type})`,
        });

        updated.push(bottle);
      } catch (err) {
        errors.push({ item, error: err.message });
      }
    }

    res.status(200).json({
      message: `Updated ${updated.length} bottles, ${errors.length} errors`,
      updated,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// @desc    Record a purchase for a specific bottle
// @route   POST /api/inventory/bottles/:id/purchase
exports.addBottlePurchase = async (req, res) => {
  try {
    const { quantity, costPerUnit, supplier, invoiceNo } = req.body;
    const bottle = await Bottle.findById(req.params.id);
    if (!bottle) return res.status(404).json({ message: 'Bottle not found' });

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be a positive number' });
    }
    if (!costPerUnit || costPerUnit < 0) {
      return res.status(400).json({ message: 'Cost per unit must be >= 0' });
    }

    const totalCost = quantity * costPerUnit;
    bottle.addPurchase(quantity, costPerUnit, totalCost, supplier || '', invoiceNo || '');
    await bottle.save();

    // Create an inventory log entry for this purchase
    await InventoryLog.create({
      bottle: bottle._id,
      changeQuantity: quantity,
      reason: 'purchase',
      notes: `Purchase from ${supplier || 'unknown supplier'} - ${invoiceNo || 'no invoice'}`,
    });

    res.json({ message: 'Purchase recorded successfully', bottle });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

