const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const { updateBestsellers } = require('../services/productService');

// =============================================
// GET /api/products
// =============================================
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

// =============================================
// POST /api/products
// =============================================
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

// =============================================
// PUT /api/products/:id
// =============================================
// =============================================
// PUT /api/products/:id
// =============================================
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
    if (isActive !== undefined) product.isActive = isActive;
    if (description !== undefined) product.description = description;
    if (intensity) product.intensity = intensity;
    if (bestFor) product.bestFor = bestFor;
    if (notes) product.notes = notes;
    if (isBestseller !== undefined) product.isBestseller = isBestseller;
    if (images) product.images = images;

    // --- Handle sizes carefully: preserve existing bottle IDs if not provided ---
    if (sizes) {
      const updatedSizes = sizes.map((newSize, index) => {
        // If bottle is missing or empty, try to keep the existing one
        if (!newSize.bottle) {
          // Find the existing size by _id (if it exists)
          const existingSize = product.sizes.find(s =>
            s._id && s._id.toString() === newSize._id
          );
          if (existingSize) {
            // Use the existing bottle ID
            return { ...newSize, bottle: existingSize.bottle };
          }
          // If it's a new size (no _id) and bottle is empty, we can't create it
          // So we skip it (or you could throw an error)
          // For safety, we'll keep it as-is and let the validator fail if required
          // But better to skip or set a default if you have a fallback
        }
        return newSize;
      });
      product.sizes = updatedSizes;
    }

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

// =============================================
// POST /api/products/:id/calculate-cost
// =============================================
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

// =============================================
// DELETE /api/products/:id (soft delete)
// =============================================
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

// =============================================
// POST /api/products/bulk
// =============================================
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

    const toArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        return value.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [String(value)];
    };

    for (const item of items) {
      try {
        let { name, sku, sellingPrice, bottleType, sizeMl, sizeString } = item;

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

        if (!name || !sku || sellingPrice === undefined || sellingPrice === null || isNaN(sellingPrice)) {
          errors.push({ item, error: 'Missing required fields: name, sku, sellingPrice' });
          continue;
        }

        const bottle = await Bottle.findOne({ sizeMl: parseFloat(sizeMl), type: bottleType });
        if (!bottle) {
          errors.push({ item, error: `Bottle ${sizeMl}ml (${bottleType}) not found. Please create it first.` });
          continue;
        }

        let product = await Product.findOne({ sku });
        if (!product) {
          const bestFor = toArray(item.bestFor);
          const notes = toArray(item.notes);
          let intensity = (item.intensity || 'medium').toLowerCase();
          if (!['light', 'medium', 'strong', 'fresh'].includes(intensity)) {
            intensity = 'medium';
          }

          product = new Product({
            name,
            sku,
            type: bottleType === 'roll-on' ? 'roll-on' : 'spray',
            isActive: true,
            blendComponents: [],
            baseOil: null,
            description: item.description || '',
            intensity,
            bestFor: bestFor.length ? bestFor : ['all'],
            notes,
            isBestseller: !!item.isBestseller,
            images: [],
          });
        }

        const sizeExists = product.sizes.some(s =>
          s.sizeMl === parseFloat(sizeMl) &&
          s.bottle && s.bottle.toString() === bottle._id.toString()
        );
        if (sizeExists) {
          errors.push({ item, error: `Size ${sizeMl}ml (${bottleType}) already exists for SKU ${sku}` });
          continue;
        }

        product.sizes.push({
          sizeMl: parseFloat(sizeMl),
          bottle: bottle._id,
          oilMlUsed: 0,
          ethanolMlUsed: 0,
          fixativeMlUsed: 0,
          makingCost: 0,
          sellingPrice: parseFloat(sellingPrice),
          // image: '' – will be added separately via update
        });

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
// POST /api/products/correct-types
// =============================================
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
      else if (hasSpray && hasRollOn) newType = 'spray';

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
// POST /api/products/fix-product-types
// =============================================
exports.fixProductTypesAndBottles = async (req, res) => {
  try {
    const products = await Product.find({});
    let updatedProducts = 0;
    let updatedSizes = 0;

    const sprayBottles = await Bottle.find({ type: 'spray' });
    const rollOnBottles = await Bottle.find({ type: 'roll-on' });

    const sprayMap = {};
    sprayBottles.forEach(b => { sprayMap[b.sizeMl] = b._id; });
    const rollOnMap = {};
    rollOnBottles.forEach(b => { rollOnMap[b.sizeMl] = b._id; });

    const spraySizes = [6, 15, 30, 50, 100];
    const rollOnSizes = [3, 3.5];

    for (const product of products) {
      if (!product.sizes || product.sizes.length === 0) continue;

      let hasSpray = false;
      let hasRollOn = false;
      let changed = false;

      for (let i = 0; i < product.sizes.length; i++) {
        const size = product.sizes[i];
        const sizeMl = size.sizeMl;

        if (size.bottle) {
          const bottle = await Bottle.findById(size.bottle);
          if (bottle) {
            if (bottle.type === 'spray') hasSpray = true;
            else if (bottle.type === 'roll-on') hasRollOn = true;
            continue;
          }
        }

        let newBottleId = null;
        let isSpray = false;

        if (rollOnSizes.includes(sizeMl)) {
          isSpray = false;
        } else if (spraySizes.includes(sizeMl)) {
          const hasLargeSize = product.sizes.some(s => [50, 100].includes(s.sizeMl));
          isSpray = hasLargeSize;
          if (!isSpray) {
            const hasSprayBottle = product.sizes.some(s => s.bottle && s.bottle.type === 'spray');
            if (hasSprayBottle) isSpray = true;
          }
        } else {
          isSpray = false;
        }

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

      let newType = null;
      if (hasSpray && !hasRollOn) newType = 'spray';
      else if (!hasSpray && hasRollOn) newType = 'roll-on';
      else if (hasSpray && hasRollOn) newType = 'spray';

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

// =============================================
// POST /api/products/update-bestsellers
// =============================================
exports.triggerBestsellerUpdate = async (req, res) => {
  try {
    const { topN = 5, timeRange = 'all' } = req.body;
    const updated = await updateBestsellers(topN, timeRange);
    res.json({
      message: `✅ Bestsellers updated (${updated.length} products marked as bestsellers)`,
      updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// =============================================
// GET /api/products/:id
// =============================================
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('baseOil', 'name sku')
      .populate('blendComponents.material', 'name sku type')
      .populate('sizes.bottle', 'sizeMl type');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};