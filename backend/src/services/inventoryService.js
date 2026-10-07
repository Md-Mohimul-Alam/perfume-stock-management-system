const mongoose = require('mongoose');

const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');

/* ========================================
   HELPERS
======================================== */

const getReferenceId = (reference) => {
  if (!reference) {
    return null;
  }

  if (reference._id) {
    return reference._id;
  }

  return reference;
};

const getRefModel = (reason) => {
  switch (reason) {
    case 'sale':
      return 'Sale';

    case 'production':
      return 'Production';

    case 'purchase':
      return 'Purchase';

    case 'adjustment':
    case 'wastage':
      return 'ManualAdjustment';

    default:
      return undefined;
  }
};

const validatePositiveNumber = (
  value,
  label
) => {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      `${label} must be greater than 0`
    );
  }

  return amount;
};

const createInventoryLog = async (
  data,
  session = null
) => {
  if (session) {
    const [log] =
      await InventoryLog.create(
        [data],
        { session }
      );

    return log;
  }

  return InventoryLog.create(data);
};

/* ========================================
   DEDUCT RAW MATERIAL
======================================== */

/*
  Usage without transaction:

  await deductRawMaterial(
    materialId,
    quantityMl,
    'sale',
    sale
  );

  Usage with transaction:

  await deductRawMaterial(
    materialId,
    quantityMl,
    'sale',
    sale,
    session
  );
*/

exports.deductRawMaterial = async (
  materialId,
  quantityMl,
  reason,
  reference = null,
  session = null
) => {
  if (!materialId) {
    throw new Error(
      'Material ID is required'
    );
  }

  if (
    !mongoose.isValidObjectId(
      materialId
    )
  ) {
    throw new Error(
      'Invalid material ID'
    );
  }

  const quantity =
    validatePositiveNumber(
      quantityMl,
      'Raw material quantity'
    );

  const referenceId =
    getReferenceId(reference);

  const refModel =
    referenceId
      ? getRefModel(reason)
      : undefined;

  /*
    Atomic stock deduction.

    Stock will only be reduced if enough
    stock currently exists.

    This prevents two simultaneous sales
    from both reading the same stock and
    overselling it.
  */

  const material =
    await RawMaterial.findOneAndUpdate(
      {
        _id: materialId,

        currentStockMl: {
          $gte: quantity,
        },
      },

      {
        $inc: {
          currentStockMl:
            -quantity,
        },
      },

      {
        new: true,
        runValidators: true,
        session:
          session || undefined,
      }
    );

  /*
    If update failed, determine whether
    material does not exist or stock is
    simply insufficient.
  */

  if (!material) {
    const existingMaterial =
      await RawMaterial.findById(
        materialId
      ).session(
        session || null
      );

    if (!existingMaterial) {
      throw new Error(
        `Material ${materialId} not found`
      );
    }

    throw new Error(
      `Insufficient stock for ${existingMaterial.name}. ` +
      `Available: ${Number(
        existingMaterial.currentStockMl || 0
      ).toFixed(2)}ml, ` +
      `needed: ${quantity.toFixed(2)}ml`
    );
  }

  /*
    Create inventory log inside the same
    transaction when session is supplied.
  */

  await createInventoryLog(
    {
      material:
        material._id,

      changeQuantity:
        -quantity,

      reason,

      reference:
        referenceId,

      refModel,

      notes:
        `Deducted ${quantity}ml for ${reason}`,
    },

    session
  );

  return material;
};

/* ========================================
   DEDUCT BOTTLE
======================================== */

exports.deductBottle = async (
  bottleId,
  quantity,
  reason,
  reference = null,
  session = null
) => {
  if (!bottleId) {
    throw new Error(
      'Bottle ID is required'
    );
  }

  if (
    !mongoose.isValidObjectId(
      bottleId
    )
  ) {
    throw new Error(
      'Invalid bottle ID'
    );
  }

  const amount =
    validatePositiveNumber(
      quantity,
      'Bottle quantity'
    );

  /*
    Bottle stock should normally be a
    whole number.
  */

  if (
    !Number.isInteger(amount)
  ) {
    throw new Error(
      'Bottle quantity must be a whole number'
    );
  }

  const referenceId =
    getReferenceId(reference);

  const refModel =
    referenceId
      ? getRefModel(reason)
      : undefined;

  /*
    Atomic bottle deduction.
  */

  const bottle =
    await Bottle.findOneAndUpdate(
      {
        _id: bottleId,

        currentStock: {
          $gte: amount,
        },
      },

      {
        $inc: {
          currentStock:
            -amount,
        },
      },

      {
        new: true,
        runValidators: true,
        session:
          session || undefined,
      }
    );

  if (!bottle) {
    const existingBottle =
      await Bottle.findById(
        bottleId
      ).session(
        session || null
      );

    if (!existingBottle) {
      throw new Error(
        `Bottle ${bottleId} not found`
      );
    }

    throw new Error(
      `Insufficient bottle stock for ` +
      `${existingBottle.sizeMl}ml ${existingBottle.type || ''}. ` +
      `Available: ${Number(
        existingBottle.currentStock || 0
      )}, ` +
      `needed: ${amount}`
    );
  }

  await createInventoryLog(
    {
      bottle:
        bottle._id,

      changeQuantity:
        -amount,

      reason,

      reference:
        referenceId,

      refModel,

      notes:
        `Deducted ${amount} bottle${
          amount === 1
            ? ''
            : 's'
        } for ${reason}`,
    },

    session
  );

  return bottle;
};