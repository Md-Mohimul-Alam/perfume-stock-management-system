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

// @desc    Create a product (with new fields)
// @route   POST /api/products
exports.createProduct = async (req, res) => {
  try {
    const {
      name, sku, type, baseOil, blendComponents, sizes,
      description, intensity, bestFor, notes, isBestseller, images
    } = req.body;

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
      description: description || '',
      intensity: intensity || 'medium',
      bestFor: bestFor || ['all'],
      notes: notes || [],
      isBestseller: isBestseller || false,
      images: images || [],
    });

    for (let i = 0; i < product.sizes.length; i++) {
      await product.calculateMakingCost(i);
    }
    await product.save();

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update product (with new fields)
// @route   PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const {
      name, sku, type, baseOil, blendComponents, sizes, isActive,
      description, intensity, bestFor, notes, isBestseller, images
    } = req.body;

    if (name) product.name = name;
    if (sku) product.sku = sku;
    if (type) product.type = type;
    if (baseOil) product.baseOil = baseOil;
    if (blendComponents) product.blendComponents = blendComponents;
    if (sizes) product.sizes = sizes;
    if (isActive !== undefined) product.isActive = isActive;
    if (description !== undefined) product.description = description;
    if (intensity) product.intensity = intensity;
    if (bestFor) product.bestFor = bestFor;
    if (notes) product.notes = notes;
    if (isBestseller !== undefined) product.isBestseller = isBestseller;
    if (images) product.images = images;

    await product.save();

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

    const parseSizeString = (sizeStr) => {
      if (!sizeStr) return null;
      const trimmed = sizeStr.trim();
      const numMatch = trimmed.match(/^([\d.]+)\s*ml/i);
      if (!numMatch) return null;
      const sizeMl = parseFloat(numMatch[1]);
      let bottleType = 'spray';
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

        // Parse size string
        if (sizeString) {
          const parsed = parseSizeString(sizeString);
          if (parsed) {
            sizeMl = parsed.sizeMl;
            if (!bottleType) {
              bottleType = parsed.bottleType;
            }
          } else {
            errors.push({ item, error: `Invalid size string: "${sizeString}"` });
            continue;
          }
        }

        // Validate size and type
        if (sizeMl === undefined || sizeMl === null || isNaN(sizeMl)) {
          errors.push({ item, error: 'Missing or invalid sizeMl' });
          continue;
        }
        if (!bottleType) {
          bottleType = 'spray';
        }
        bottleType = bottleType.toLowerCase().trim();
        if (!['spray', 'roll-on'].includes(bottleType)) {
          bottleType = 'spray';
        }

        // Validate required fields
        if (!name || !sku || sellingPrice === undefined || sellingPrice === null || isNaN(sellingPrice)) {
          errors.push({ item, error: 'Missing required fields: name, sku, sellingPrice' });
          continue;
        }

        // Find the bottle for this size/type
        const bottle = await Bottle.findOne({ sizeMl: parseFloat(sizeMl), type: bottleType });
        if (!bottle) {
          errors.push({ item, error: `Bottle ${sizeMl}ml (${bottleType}) not found. Please create it first.` });
          continue;
        }

        // Find or create product
        let product = await Product.findOne({ sku });
        if (!product) {
          product = new Product({
            name,
            sku,
            type: bottleType === 'roll-on' ? 'roll-on' : 'spray',
            isActive: true,
            blendComponents: [],
            baseOil: null,
            // new fields (optional, can be set via extra columns if needed)
            description: item.description || '',
            intensity: item.intensity || 'medium',
            bestFor: item.bestFor ? item.bestFor.split(',').map(s => s.trim()) : ['all'],
            notes: item.notes ? item.notes.split(',').map(s => s.trim()) : [],
            isBestseller: item.isBestseller || false,
            images: [],
          });
        }

        // Check for duplicate variant (by sizeMl AND bottle type)
        const sizeExists = product.sizes.some(s =>
          s.sizeMl === parseFloat(sizeMl) &&
          s.bottle && s.bottle.toString() === bottle._id.toString()
        );
        if (sizeExists) {
          errors.push({ item, error: `Size ${sizeMl}ml (${bottleType}) already exists for SKU ${sku}` });
          continue;
        }

        // Add the new size variant
        product.sizes.push({
          sizeMl: parseFloat(sizeMl),
          bottle: bottle._id,
          oilMlUsed: 0,
          ethanolMlUsed: 0,
          fixativeMlUsed: 0,
          makingCost: 0,
          sellingPrice: parseFloat(sellingPrice),
        });

        // Save the product
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

// =============================================
// CORRECT PRODUCT TYPES (existing)
// =============================================
// @desc    Correct product types based on bottle types
// @route   POST /api/products/correct-types
exports.correctProductTypes = async (req, res) => {
  try {
    const products = await Product.find({}).populate('sizes.bottle');
    let updated = 0;

    for (const product of products) {
      if (!product.sizes || product.sizes.length === 0) continue;

      const hasSpray = product.sizes.some(s => s.bottle && s.bottle.type === 'spray');
      const hasRollOn = product.sizes.some(s => s.bottle && s.bottle.type === 'roll-on');

      let newType = null;
      if (hasSpray && !hasRollOn) newType = 'spray';
      else if (!hasSpray && hasRollOn) newType = 'roll-on';
      else if (hasSpray && hasRollOn) newType = 'spray'; // mixed – choose spray

      if (newType && product.type !== newType) {
        product.type = newType;
        await product.save();
        updated++;
      }
    }

    res.json({ message: `Updated ${updated} products`, updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================
// NEW: FIX PRODUCT TYPES AND BOTTLE REFERENCES
// =============================================
// @desc    Fix product types and bottle references (one‑time correction)
// @route   POST /api/products/fix-product-types
exports.fixProductTypesAndBottles = async (req, res) => {
  try {
    const products = await Product.find({});
    let updatedProducts = 0;
    let updatedSizes = 0;

    // Get all spray and roll‑on bottles
    const sprayBottles = await Bottle.find({ type: 'spray' });
    const rollOnBottles = await Bottle.find({ type: 'roll-on' });

    // Create maps: sizeMl -> bottle _id
    const sprayMap = {};
    sprayBottles.forEach(b => { sprayMap[b.sizeMl] = b._id; });
    const rollOnMap = {};
    rollOnBottles.forEach(b => { rollOnMap[b.sizeMl] = b._id; });

    // Sizes that are typically sprays (adjust as needed)
    const spraySizes = [6, 15, 30, 50, 100];
    const rollOnSizes = [3, 3.5]; // 3, 3.5 are always roll‑on

    for (const product of products) {
      if (!product.sizes || product.sizes.length === 0) continue;

      let hasSpray = false;
      let hasRollOn = false;
      let changed = false;

      for (let i = 0; i < product.sizes.length; i++) {
        const size = product.sizes[i];
        const sizeMl = size.sizeMl;

        // If bottle is already set, check its type
        if (size.bottle) {
          const bottle = await Bottle.findById(size.bottle);
          if (bottle) {
            if (bottle.type === 'spray') hasSpray = true;
            else if (bottle.type === 'roll-on') hasRollOn = true;
            continue;
          }
        }

        // If bottle is missing or invalid, try to assign the correct bottle
        let newBottleId = null;
        let isSpray = false;

        // Determine type based on sizeMl and product context
        if (rollOnSizes.includes(sizeMl)) {
          isSpray = false;
        } else if (spraySizes.includes(sizeMl)) {
          // For 6, 15, 30, 50, 100: check if the product has any other size that is definitely spray
          // We'll check if the product has a 50ml or 100ml size (spray) – if yes, treat all medium as spray
          const hasLargeSize = product.sizes.some(s => [50, 100].includes(s.sizeMl));
          isSpray = hasLargeSize;
          // If the product already has a spray bottle somewhere, we'll also treat as spray
          if (!isSpray) {
            const hasSprayBottle = product.sizes.some(s => s.bottle && s.bottle.type === 'spray');
            if (hasSprayBottle) isSpray = true;
          }
        } else {
          // fallback – treat as roll-on
          isSpray = false;
        }

        // Find the correct bottle
        if (isSpray && sprayMap[sizeMl]) {
          newBottleId = sprayMap[sizeMl];
          hasSpray = true;
        } else if (!isSpray && rollOnMap[sizeMl]) {
          newBottleId = rollOnMap[sizeMl];
          hasRollOn = true;
        }

        if (newBottleId && (!size.bottle || size.bottle.toString() !== newBottleId.toString())) {
          product.sizes[i].bottle = newBottleId;
          changed = true;
          updatedSizes++;
        }
      }

      // Re‑evaluate hasSpray / hasRollOn after assignments
      if (!hasSpray && !hasRollOn) {
        for (const size of product.sizes) {
          if (size.bottle) {
            const bottle = await Bottle.findById(size.bottle);
            if (bottle) {
              if (bottle.type === 'spray') hasSpray = true;
              else if (bottle.type === 'roll-on') hasRollOn = true;
            }
          }
        }
      }

      // Determine product type
      let newType = null;
      if (hasSpray && !hasRollOn) newType = 'spray';
      else if (!hasSpray && hasRollOn) newType = 'roll-on';
      else if (hasSpray && hasRollOn) newType = 'spray'; // mixed – choose spray

      if (newType && product.type !== newType) {
        product.type = newType;
        changed = true;
      }

      if (changed) {
        await product.save();
        updatedProducts++;
      }
    }

    res.json({
      message: `Updated ${updatedProducts} products and ${updatedSizes} size variants`,
      updatedProducts,
      updatedSizes,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};