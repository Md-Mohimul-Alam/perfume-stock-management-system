const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');

exports.deductRawMaterial = async (materialId, quantityMl, reason, reference) => {
  if (!materialId) throw new Error('Material ID is required');

  // ✅ Skip if quantity is zero or negative — nothing to deduct
  if (quantityMl <= 0) {
    console.warn(`⚠️ Skipping raw material deduction for ${materialId}: quantity = ${quantityMl}`);
    return null;
  }

  const material = await RawMaterial.findById(materialId);
  if (!material) throw new Error(`Material ${materialId} not found`);

  if (material.currentStockMl < quantityMl) {
    throw new Error(
      `Insufficient stock for ${material.name}. Available: ${material.currentStockMl}ml, needed: ${quantityMl}ml`
    );
  }

  material.currentStockMl -= quantityMl;
  await material.save();

  await InventoryLog.create({
    material: material._id,
    changeQuantity: -quantityMl,
    reason,
    reference: reference?._id || null,
    refModel: reason === 'sale' ? 'Sale' : reason === 'production' ? 'Production' : null,
    notes: `Deducted ${quantityMl}ml for ${reason}`,
  });

  return material;
};

exports.deductBottle = async (bottleId, quantity, reason, reference) => {
  if (!bottleId) throw new Error('Bottle ID is required');

  // ✅ Skip if quantity is zero or negative
  if (quantity <= 0) {
    console.warn(`⚠️ Skipping bottle deduction for ${bottleId}: quantity = ${quantity}`);
    return null;
  }

  const bottle = await Bottle.findById(bottleId);
  if (!bottle) throw new Error(`Bottle ${bottleId} not found`);

  if (bottle.currentStock < quantity) {
    throw new Error(
      `Insufficient bottle stock for ${bottle.sizeMl}ml. Available: ${bottle.currentStock}, needed: ${quantity}`
    );
  }

  bottle.currentStock -= quantity;
  await bottle.save();

  await InventoryLog.create({
    bottle: bottle._id,
    changeQuantity: -quantity,
    reason,
    reference: reference?._id || null,
    refModel: reason === 'sale' ? 'Sale' : reason === 'production' ? 'Production' : null,
    notes: `Deducted ${quantity} bottles for ${reason}`,
  });

  return bottle;
};