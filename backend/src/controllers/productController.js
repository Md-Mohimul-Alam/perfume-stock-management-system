const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');

// @desc    Get all products
// @route   GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .populate('baseOil', 'name sku')
      .populate('blendComponents.material', 'name sku type')
      .populate('sizes.bottle', 'sizeMl type');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a product
// @route   POST /api/products
exports.createProduct = async (req, res) => {
  try {
    const { name, sku, type, baseOil, blendComponents, sizes } = req.body;

    // Validate that sizes have bottle references
    for (const size of sizes) {
      const bottleExists = await Bottle.findById(size.bottle);
      if (!bottleExists) throw new Error(`Bottle ${size.bottle} not found`);
    }

    const product = await Product.create({
      name,
      sku,
      type,
      baseOil,
      blendComponents,
      sizes,
    });

    // Calculate initial making costs
    for (let i = 0; i < product.sizes.length; i++) {
      await product.calculateMakingCost(i);
    }
    await product.save();

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { name, sku, type, baseOil, blendComponents, sizes, isActive } = req.body;
    if (name) product.name = name;
    if (sku) product.sku = sku;
    if (type) product.type = type;
    if (baseOil) product.baseOil = baseOil;
    if (blendComponents) product.blendComponents = blendComponents;
    if (sizes) product.sizes = sizes;
    if (isActive !== undefined) product.isActive = isActive;

    await product.save();
    // Recalculate making costs
    for (let i = 0; i < product.sizes.length; i++) {
      await product.calculateMakingCost(i);
    }
    await product.save();

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Recalculate making cost for a product's size
// @route   POST /api/products/:id/calculate-cost
exports.calculateCost = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { sizeIndex } = req.body;
    if (sizeIndex === undefined) {
      for (let i = 0; i < product.sizes.length; i++) {
        await product.calculateMakingCost(i);
      }
    } else {
      await product.calculateMakingCost(sizeIndex);
    }
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete (deactivate) product
// @route   DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.isActive = false;
    await product.save();
    res.json({ message: 'Product deactivated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// @desc    Bulk create products from CSV/Excel
// @route   POST /api/products/bulk
exports.bulkCreateProducts = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ message: 'No items provided' });
    }

    const errors = [];
    const created = [];

    const Bottle = require('../models/Bottle');
    const Product = require('../models/Product');

    // Helper: parse size string like "3.5ml Role" -> { sizeMl: 3.5, bottleType: 'roll-on' }
    const parseSizeString = (sizeStr) => {
      if (!sizeStr) return null;
      const trimmed = sizeStr.trim();
      // Extract numeric part (e.g., "3.5ml" -> 3.5)
      const numMatch = trimmed.match(/^([\d.]+)\s*ml/i);
      if (!numMatch) return null;
      const sizeMl = parseFloat(numMatch[1]);
      // Determine bottle type
      let bottleType = 'spray'; // default
      const lower = trimmed.toLowerCase();
      if (lower.includes('role') || lower.includes('roll')) {
        bottleType = 'roll-on';
      } else if (lower.includes('spray')) {
        bottleType = 'spray';
      }
      return { sizeMl, bottleType };
    };

    for (const item of items) {
      try {
        let { name, sku, sellingPrice, bottleType, sizeMl, sizeString } = item;

        // If sizeString is provided, parse it
        if (sizeString) {
          const parsed = parseSizeString(sizeString);
          if (parsed) {
            sizeMl = parsed.sizeMl;
            // Only override bottleType if not explicitly provided
            if (!bottleType) {
              bottleType = parsed.bottleType;
            }
          } else {
            errors.push({ item, error: `Invalid size string: "${sizeString}"` });
            continue;
          }
        }

        // Fallback: if sizeMl is still undefined or bottleType missing
        if (sizeMl === undefined || sizeMl === null || isNaN(sizeMl)) {
          errors.push({ item, error: 'Missing or invalid sizeMl' });
          continue;
        }
        if (!bottleType) {
          bottleType = 'spray'; // default
        }
        bottleType = bottleType.toLowerCase().trim();
        if (!['spray', 'roll-on'].includes(bottleType)) {
          bottleType = 'spray';
        }

        if (!name || !sku || sellingPrice === undefined || sellingPrice === null || isNaN(sellingPrice)) {
          errors.push({ item, error: 'Missing required fields: name, sku, sellingPrice' });
          continue;
        }

        // Find or create product
        let product = await Product.findOne({ sku });
        if (!product) {
          // Set product type based on the bottle type of this size
          product = new Product({
            name,
            sku,
            type: bottleType === 'roll-on' ? 'roll-on' : 'spray',
            isActive: true,
            blendComponents: [],
            baseOil: null,
          });
        } else {
          // If product exists but type is different? We'll keep existing type.
          // We'll also update name if changed?
          if (product.name !== name) {
            // Optionally update name, but we'll keep the first name.
          }
        }

        // Check if size variant already exists
        const sizeExists = product.sizes.some(s => s.sizeMl === parseFloat(sizeMl));
        if (sizeExists) {
          errors.push({ item, error: `Size ${sizeMl} already exists for SKU ${sku}` });
          continue;
        }

        // Find bottle reference
        const bottle = await Bottle.findOne({ sizeMl: parseFloat(sizeMl), type: bottleType });
        if (!bottle) {
          errors.push({ item, error: `Bottle ${sizeMl}ml (${bottleType}) not found. Please create it first.` });
          continue;
        }

        // Add size variant
        product.sizes.push({
          sizeMl: parseFloat(sizeMl),
          bottle: bottle._id,
          oilMlUsed: 0, // will be calculated later
          ethanolMlUsed: 0,
          fixativeMlUsed: 0,
          makingCost: 0,
          sellingPrice: parseFloat(sellingPrice),
        });

        // Save product
        await product.save();
        created.push(product);
      } catch (err) {
        errors.push({ item, error: err.message });
      }
    }

    res.status(201).json({
      message: `Created/Updated ${created.length} products, ${errors.length} errors`,
      created,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};