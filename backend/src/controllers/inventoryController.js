const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');

// @desc    Get all raw materials with stock
// @route   GET /api/inventory/materials
exports.getMaterials = async (req, res) => {
  try {
    const materials = await RawMaterial.find().select('-purchases');
    res.json(materials);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

// @desc    Get all bottle types
// @route   GET /api/inventory/bottles
exports.getBottles = async (req, res) => {
  try {
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