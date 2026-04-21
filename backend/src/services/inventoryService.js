const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');

exports.deductRawMaterial = async (materialId, quantityMl, reason, reference) => {
  const material = await RawMaterial.findById(materialId);
  if (!material) throw new Error('Material not found');
  if (material.currentStockMl < quantityMl) {
    throw new Error(`Insufficient stock for ${material.name}. Available: ${material.currentStockMl}ml`);
  }
  material.currentStockMl -= quantityMl;
  await material.save();

  await InventoryLog.create({
    material: materialId,
    changeQuantity: -quantityMl,
    reason,
    reference: reference?._id,
    refModel: reference?.constructor.modelName,
  });
};

exports.deductBottle = async (bottleId, quantity, reason, reference) => {
  const bottle = await Bottle.findById(bottleId);
  if (!bottle) throw new Error('Bottle not found');
  if (bottle.currentStock < quantity) {
    throw new Error(`Insufficient bottle stock for ${bottle.sizeMl}ml. Available: ${bottle.currentStock}`);
  }
  bottle.currentStock -= quantity;
  await bottle.save();

  await InventoryLog.create({
    bottle: bottleId,
    changeQuantity: -quantity,
    reason,
    reference: reference?._id,
    refModel: reference?.constructor.modelName,
  });
};