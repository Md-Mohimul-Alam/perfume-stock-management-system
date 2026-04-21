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