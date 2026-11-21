const mongoose = require('mongoose');

const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
/* ========================================
   HELPERS
======================================== */

const sanitizeImages = (images) => {
  if (!Array.isArray(images)) {
    return [];
  }

  return [
    ...new Set(
      images
        .map((image) =>
          String(image || '').trim()
        )
        .filter(Boolean)
    ),
  ].slice(0, 10);
};

/* ========================================
   RAW MATERIALS
======================================== */

exports.getMaterials = async (req, res) => {
  try {
    const materials =
      await RawMaterial.find();

    const result =
      materials.map((material) => {
        const totalPurchaseCost =
          (material.purchases || []).reduce(
            (sum, purchase) =>
              sum +
              Number(
                purchase.totalCost || 0
              ),
            0
          );

        const totalPurchaseMl =
          (material.purchases || []).reduce(
            (sum, purchase) =>
              sum +
              Number(
                purchase.quantityMl || 0
              ),
            0
          );

        const object =
          material.toObject();

        delete object.purchases;

        return {
          ...object,
          totalPurchaseCost,
          totalPurchaseMl,
        };
      });

    const sales =
      await Sale.find()
        .populate(
          'items.product'
        );

    const usageMap = {};
    const costMap = {};

    function getOilPercentage(
      product,
      sizeMl
    ) {
      const sizeVariant =
        product.sizes?.find(
          (size) =>
            Number(
              size.sizeMl
            ) ===
            Number(
              sizeMl
            )
        );

      let components = [];

      if (
        sizeVariant
          ?.blendComponents
          ?.length
      ) {
        components =
          sizeVariant
            .blendComponents;
      } else if (
        product
          .blendComponents
          ?.length
      ) {
        components =
          product
            .blendComponents;
      }

      if (!components.length) {
        return 0;
      }

      let totalOil = 0;

      for (
        const component of
        components
      ) {
        const materialId =
          component
            .material
            ?._id
            ?.toString() ||
          component
            .material
            ?.toString();

        const material =
          materials.find(
            (row) =>
              row._id.toString() ===
              materialId
          );

        if (
          material &&
          material.type ===
            'oil'
        ) {
          totalOil +=
            Number(
              component
                .percentage ||
              0
            );
        }
      }

      return totalOil;
    }

    function computeOilBlendCost(
      product,
      sizeMl
    ) {
      const sizeVariant =
        product.sizes?.find(
          (size) =>
            Number(
              size.sizeMl
            ) ===
            Number(
              sizeMl
            )
        );

      let components = [];

      if (
        sizeVariant
          ?.blendComponents
          ?.length
      ) {
        components =
          sizeVariant
            .blendComponents;
      } else if (
        product
          .blendComponents
          ?.length
      ) {
        components =
          product
            .blendComponents;
      }

      if (!components.length) {
        return 0;
      }

      let totalWeight = 0;
      let weightedCost = 0;

      for (
        const component of
        components
      ) {
        const materialId =
          component
            .material
            ?._id
            ?.toString() ||
          component
            .material
            ?.toString();

        const material =
          materials.find(
            (row) =>
              row._id.toString() ===
              materialId
          );

        if (
          material &&
          material.type ===
            'oil'
        ) {
          const percentage =
            Number(
              component
                .percentage ||
              0
            );

          weightedCost +=
            Number(
              material
                .avgCostPerMl ||
              0
            ) *
            percentage;

          totalWeight +=
            percentage;
        }
      }

      return totalWeight >
        0
        ? weightedCost /
            totalWeight
        : 0;
    }

    for (const sale of sales) {
      if (
        !Array.isArray(
          sale.items
        )
      ) {
        continue;
      }

      for (
        const item of
        sale.items
      ) {
        if (
          item.itemType ===
          'bottle'
        ) {
          continue;
        }

        const product =
          item.product;

        if (!product) {
          continue;
        }

        const sku =
          product.sku
            ? product.sku.trim()
            : '';

        if (
          sku !== 'SR_SP' &&
          sku !== 'LUXE1_SP'
        ) {
          continue;
        }

        const sizeMl =
          Number(
            item.sizeMl ||
            0
          );

        const quantity =
          Number(
            item.quantity ||
            0
          );

        const oilPercentage =
          getOilPercentage(
            product,
            sizeMl
          );

        if (
          oilPercentage ===
          0
        ) {
          continue;
        }

        const totalOilMl =
          sizeMl *
          (oilPercentage /
            100) *
          quantity;

        if (!usageMap[sku]) {
          usageMap[sku] = 0;
        }

        usageMap[sku] +=
          totalOilMl;

        if (!costMap[sku]) {
          costMap[sku] =
            computeOilBlendCost(
              product,
              sizeMl
            );
        }
      }
    }

    for (
      const sku in
      usageMap
    ) {
      usageMap[sku] =
        Math.round(
          usageMap[sku] *
            100
        ) / 100;
    }

    const specialSKUs = [
      'SR_SP',
      'LUXE1_SP',
    ];

    const nameMap = {
      SR_SP:
        'SRK Spray',

      LUXE1_SP:
        'Luxe Special',
    };

    const virtualMaterials =
      [];

    for (
      const sku of
      specialSKUs
    ) {
      const used =
        usageMap[sku] ||
        0;

      const cost =
        costMap[sku] ||
        0;

      virtualMaterials.push({
        _id:
          `${sku}_VIRTUAL`,

        name:
          nameMap[sku] ||
          sku,

        sku,

        type:
          'oil',

        currentStockMl:
          0,

        avgCostPerMl:
          cost,

        totalPurchaseCost:
          used * cost,

        totalPurchaseMl:
          0,

        usedOil:
          used,

        availableOil:
          0,
      });
    }

    return res.json([
      ...result,
      ...virtualMaterials,
    ]);
  } catch (error) {
    console.error(
      'Error in getMaterials:',
      error
    );

    return res
      .status(500)
      .json({
        message:
          error.message,
      });
  }
};

/* ========================================
   GET MATERIAL
======================================== */

exports.getMaterialById =
  async (req, res) => {
    try {
      const material =
        await RawMaterial.findById(
          req.params.id
        );

      if (!material) {
        return res
          .status(404)
          .json({
            message:
              'Material not found',
          });
      }

      return res.json(
        material
      );
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   CREATE MATERIAL
======================================== */

exports.createMaterial =
  async (req, res) => {
    try {
      const {
        name,
        sku,
        type,
      } = req.body;

      const material =
        await RawMaterial.create({
          name,
          sku,
          type,
        });

      return res
        .status(201)
        .json(
          material
        );
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   UPDATE MATERIAL
======================================== */

exports.updateMaterial = async (req, res) => {
  try {
    const { name, sku, type } = req.body;

    const material = await RawMaterial.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        message: 'Material not found',
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          message: 'Material name is required',
        });
      }

      material.name = name.trim();
    }

    if (sku !== undefined) {
      if (typeof sku !== 'string' || !sku.trim()) {
        return res.status(400).json({
          message: 'Valid SKU is required',
        });
      }

      const normalizedSku = sku.trim();

      const duplicate = await RawMaterial.findOne({
        sku: normalizedSku,
        _id: { $ne: material._id },
      });

      if (duplicate) {
        return res.status(409).json({
          message: `SKU "${normalizedSku}" already exists`,
        });
      }

      material.sku = normalizedSku;
    }

    if (type !== undefined) {
      if (!['oil', 'ethanol', 'fixative'].includes(type)) {
        return res.status(400).json({
          message: 'Invalid material type',
        });
      }

      material.type = type;
    }

    await material.save();

    return res.json(material);
  } catch (error) {
    console.error('Update material error:', error);

    return res.status(500).json({
      message: error.message,
    });
  }
};

/* ========================================
   DELETE MATERIAL
======================================== */

exports.deleteMaterial =
  async (req, res) => {
    try {
      const material =
        await RawMaterial.findById(
          req.params.id
        );

      if (!material) {
        return res
          .status(404)
          .json({
            message:
              'Material not found',
          });
      }

      await material.deleteOne();

      return res.json({
        message:
          'Material deleted successfully',
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   GET ADMIN BOTTLES
======================================== */

exports.getBottles =
  async (req, res) => {
    try {
      const bottles =
        await Bottle.find()
          .select(
            '-purchases'
          )
          .sort({
            type: 1,
            sizeMl: 1,
          });

      return res.json(
        bottles
      );
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   PUBLIC BOTTLES

   IMPORTANT:
   Do NOT filter by sellingPrice here.

   This lets the client display the
   bottle section even while prices
   are still being configured.
======================================== */
// @desc    Public bottle catalogue
// @route   GET /api/inventory/bottles/public
exports.getPublicBottles = async (req, res) => {
  try {
    const bottles = await Bottle.find()
      .select(
        "sizeMl type currentStock sellingPrice images isStockOut createdAt updatedAt"
      )
      .sort({
        type: 1,
        sizeMl: 1,
      })
      .lean();

    console.log(
      `Public bottles found: ${bottles.length}`
    );

    return res.status(200).json(bottles);
  } catch (error) {
    console.error(
      "Get public bottles error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load bottles",
    });
  }
};
/* ========================================
   CREATE BOTTLE
======================================== */

exports.createBottle =
  async (req, res) => {
    try {
      const {
        sizeMl,
        type,
        currentStock = 0,
        avgCostPerUnit = 0,
        sellingPrice = 0,
        images = [],
      } = req.body;

      const parsedSize =
        Number(
          sizeMl
        );

      const parsedStock =
        Number(
          currentStock
        );

      const parsedCost =
        Number(
          avgCostPerUnit
        );

      const parsedSellingPrice =
        Number(
          sellingPrice
        );

      if (
        !Number.isFinite(
          parsedSize
        ) ||
        parsedSize <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'Bottle size must be greater than 0',
          });
      }

      if (
        ![
          'roll-on',
          'spray',
        ].includes(
          type
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              'Bottle type must be roll-on or spray',
          });
      }

      if (
        !Number.isInteger(
          parsedStock
        ) ||
        parsedStock < 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'Bottle stock must be a non-negative whole number',
          });
      }

      if (
        !Number.isFinite(
          parsedCost
        ) ||
        parsedCost < 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'Bottle cost cannot be negative',
          });
      }

      if (
        !Number.isFinite(
          parsedSellingPrice
        ) ||
        parsedSellingPrice <
          0
      ) {
        return res
          .status(400)
          .json({
            message:
              'Selling price cannot be negative',
          });
      }

      const existing =
        await Bottle.findOne({
          sizeMl:
            parsedSize,

          type,
        });

      if (existing) {
        return res
          .status(409)
          .json({
            message:
              `${parsedSize}ml ${type} bottle already exists`,
          });
      }

      const bottle =
        await Bottle.create({
          sizeMl:
            parsedSize,

          type,

          currentStock:
            parsedStock,

          avgCostPerUnit:
            parsedCost,

          sellingPrice:
            parsedSellingPrice,

          images:
            sanitizeImages(
              images
            ),

          isStockOut:
            parsedStock <=
            0,
        });

      return res
        .status(201)
        .json(
          bottle
        );
    } catch (error) {
      console.error(
        'Create bottle error:',
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   UPDATE BOTTLE
======================================== */

exports.updateBottle =
  async (req, res) => {
    try {
      const {
        sizeMl,
        type,
        currentStock,
        avgCostPerUnit,
        sellingPrice,
        images,
      } = req.body;

      const bottle =
        await Bottle.findById(
          req.params.id
        );

      if (!bottle) {
        return res
          .status(404)
          .json({
            message:
              'Bottle not found',
          });
      }

      if (
        sizeMl !==
        undefined
      ) {
        const parsed =
          Number(
            sizeMl
          );

        if (
          !Number.isFinite(
            parsed
          ) ||
          parsed <= 0
        ) {
          return res
            .status(400)
            .json({
              message:
                'Bottle size must be greater than 0',
            });
        }

        bottle.sizeMl =
          parsed;
      }

      if (
        type !==
        undefined
      ) {
        if (
          ![
            'roll-on',
            'spray',
          ].includes(
            type
          )
        ) {
          return res
            .status(400)
            .json({
              message:
                'Bottle type must be roll-on or spray',
            });
        }

        bottle.type =
          type;
      }

      if (
        currentStock !==
        undefined
      ) {
        const parsed =
          Number(
            currentStock
          );

        if (
          !Number.isInteger(
            parsed
          ) ||
          parsed < 0
        ) {
          return res
            .status(400)
            .json({
              message:
                'Current stock must be a non-negative whole number',
            });
        }

        bottle.currentStock =
          parsed;

        bottle.isStockOut =
          parsed <= 0;
      }

      if (
        avgCostPerUnit !==
        undefined
      ) {
        const parsed =
          Number(
            avgCostPerUnit
          );

        if (
          !Number.isFinite(
            parsed
          ) ||
          parsed < 0
        ) {
          return res
            .status(400)
            .json({
              message:
                'Bottle cost cannot be negative',
            });
        }

        bottle.avgCostPerUnit =
          parsed;
      }

      if (
        sellingPrice !==
        undefined
      ) {
        const parsed =
          Number(
            sellingPrice
          );

        if (
          !Number.isFinite(
            parsed
          ) ||
          parsed < 0
        ) {
          return res
            .status(400)
            .json({
              message:
                'Selling price cannot be negative',
            });
        }

        bottle.sellingPrice =
          parsed;
      }

      if (
        images !==
        undefined
      ) {
        bottle.images =
          sanitizeImages(
            images
          );
      }

      const duplicate =
        await Bottle.findOne({
          _id: {
            $ne:
              bottle._id,
          },

          sizeMl:
            bottle.sizeMl,

          type:
            bottle.type,
        });

      if (duplicate) {
        return res
          .status(409)
          .json({
            message:
              `${bottle.sizeMl}ml ${bottle.type} bottle already exists`,
          });
      }

      await bottle.save();

      return res.json(
        bottle
      );
    } catch (error) {
      console.error(
        'Update bottle error:',
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   DELETE BOTTLE
======================================== */

exports.deleteBottle =
  async (req, res) => {
    try {
      const bottle =
        await Bottle.findById(
          req.params.id
        );

      if (!bottle) {
        return res
          .status(404)
          .json({
            message:
              'Bottle not found',
          });
      }

      await bottle.deleteOne();

      return res.json({
        message:
          'Bottle deleted successfully',
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   INVENTORY LOGS
======================================== */

exports.getLogs =
  async (req, res) => {
    try {
      const {
        reason,
        material,
        bottle,
      } = req.query;

      const filter = {};

      if (reason) {
        filter.reason =
          reason;
      }

      if (material) {
        filter.material =
          material;
      }

      if (bottle) {
        filter.bottle =
          bottle;
      }

      const limit =
        reason
          ? 0
          : 100;

      const query =
        InventoryLog.find(
          filter
        )
          .populate(
            'material',
            'name sku'
          )
          .populate(
            'bottle',
            'sizeMl type'
          )
          .sort(
            '-date'
          );

      if (limit) {
        query.limit(
          limit
        );
      }

      const logs =
        await query;

      return res.json(
        logs
      );
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   BULK CREATE MATERIALS
======================================== */

exports.bulkCreateMaterials =
  async (req, res) => {
    try {
      const {
        items,
      } = req.body;

      if (
        !Array.isArray(
          items
        ) ||
        !items.length
      ) {
        return res
          .status(400)
          .json({
            message:
              'No items provided',
          });
      }

      const errors = [];
      const created = [];

      for (
        const item of
        items
      ) {
        try {
          const {
            name,
            sku,
            type,
          } = item;

          if (
            !name ||
            !sku ||
            !type
          ) {
            errors.push({
              item,
              error:
                'Missing required fields (name, sku, type)',
            });

            continue;
          }

          const existing =
            await RawMaterial.findOne({
              sku,
            });

          if (existing) {
            errors.push({
              item,
              error:
                `SKU '${sku}' already exists`,
            });

            continue;
          }

          const material =
            await RawMaterial.create({
              name,
              sku,
              type,
            });

          created.push(
            material
          );
        } catch (error) {
          errors.push({
            item,
            error:
              error.message,
          });
        }
      }

      return res
        .status(201)
        .json({
          message:
            `Created ${created.length} materials, ${errors.length} errors`,

          created,
          errors,
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   BULK CREATE BOTTLES
======================================== */

exports.bulkCreateBottles =
  async (req, res) => {
    try {
      const {
        items,
      } = req.body;

      if (
        !Array.isArray(
          items
        ) ||
        !items.length
      ) {
        return res
          .status(400)
          .json({
            message:
              'No items provided',
          });
      }

      const errors = [];
      const created = [];

      for (
        const item of
        items
      ) {
        try {
          const {
            sizeMl,
            type,
            currentStock = 0,
            avgCostPerUnit = 0,
            sellingPrice = 0,
            images = [],
          } = item;

          const parsedSize =
            Number(
              sizeMl
            );

          const parsedStock =
            Number(
              currentStock
            );

          const parsedCost =
            Number(
              avgCostPerUnit
            );

          const parsedSellingPrice =
            Number(
              sellingPrice
            );

          if (
            !Number.isFinite(
              parsedSize
            ) ||
            parsedSize <=
              0
          ) {
            errors.push({
              item,
              error:
                'Invalid bottle size',
            });

            continue;
          }

          if (
            ![
              'roll-on',
              'spray',
            ].includes(
              type
            )
          ) {
            errors.push({
              item,
              error:
                'Invalid bottle type',
            });

            continue;
          }

          const existing =
            await Bottle.findOne({
              sizeMl:
                parsedSize,

              type,
            });

          if (existing) {
            errors.push({
              item,
              error:
                `Bottle ${parsedSize}ml (${type}) already exists`,
            });

            continue;
          }

          const bottle =
            await Bottle.create({
              sizeMl:
                parsedSize,

              type,

              currentStock:
                Number.isInteger(
                  parsedStock
                ) &&
                parsedStock >
                  0
                  ? parsedStock
                  : 0,

              avgCostPerUnit:
                Math.max(
                  0,
                  Number.isFinite(
                    parsedCost
                  )
                    ? parsedCost
                    : 0
                ),

              sellingPrice:
                Math.max(
                  0,
                  Number.isFinite(
                    parsedSellingPrice
                  )
                    ? parsedSellingPrice
                    : 0
                ),

              images:
                sanitizeImages(
                  images
                ),

              isStockOut:
                !(
                  Number.isInteger(
                    parsedStock
                  ) &&
                  parsedStock >
                    0
                ),
            });

          created.push(
            bottle
          );
        } catch (error) {
          errors.push({
            item,
            error:
              error.message,
          });
        }
      }

      return res
        .status(201)
        .json({
          message:
            `Created ${created.length} bottles, ${errors.length} errors`,

          created,
          errors,
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   IMPORT MATERIALS
======================================== */

exports.importMaterialsWithPurchases =
  async (req, res) => {
    try {
      const {
        items,
      } = req.body;

      if (
        !Array.isArray(
          items
        ) ||
        !items.length
      ) {
        return res
          .status(400)
          .json({
            message:
              'No items provided',
          });
      }

      const errors = [];
      const created = [];

      for (
        const item of
        items
      ) {
        try {
          const {
            name,
            sku,
            type,
            purchases = [],
          } = item;

          if (
            !name ||
            !sku ||
            !type
          ) {
            errors.push({
              item,
              error:
                'Missing name, sku, or type',
            });

            continue;
          }

          const existing =
            await RawMaterial.findOne({
              sku,
            });

          if (existing) {
            errors.push({
              item,
              error:
                `SKU '${sku}' already exists`,
            });

            continue;
          }

          const material =
            new RawMaterial({
              name,
              sku,
              type,
              currentStockMl:
                0,
              avgCostPerMl:
                0,
            });

          for (
            const purchase of
            purchases
          ) {
            const quantity =
              Number(
                purchase
                  .quantityMl
              );

            const costPerMl =
              Number(
                purchase
                  .costPerMl
              );

            if (
              !Number.isFinite(
                quantity
              ) ||
              quantity <=
                0 ||
              !Number.isFinite(
                costPerMl
              ) ||
              costPerMl <
                0
            ) {
              continue;
            }

            const totalCost =
              quantity *
              costPerMl;

            material.addPurchase(
              quantity,
              costPerMl,
              totalCost,
              purchase
                .supplier ||
                '',
              purchase
                .invoiceNo ||
                ''
            );
          }

          await material.save();

          created.push(
            material
          );
        } catch (error) {
          errors.push({
            item,
            error:
              error.message,
          });
        }
      }

      return res
        .status(201)
        .json({
          message:
            `Imported ${created.length} materials, ${errors.length} errors`,

          created,
          errors,
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   BULK ADD BOTTLE STOCK
======================================== */

exports.bulkAddStockToBottles = async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({
      message: 'No items provided',
    });
  }

  const errors = [];
  const updated = [];

  for (const item of items) {
    const session = await mongoose.startSession();

    try {
      let updatedBottle;

      await session.withTransaction(async () => {
        const {
          sizeMl,
          type,
          quantity,
          costPerUnit,
        } = item;

        const parsedSize = Number(sizeMl);
        const qty = Number(quantity);
        const cost = Number(costPerUnit ?? 0);

        if (
          !Number.isFinite(parsedSize) ||
          parsedSize <= 0 ||
          !['roll-on', 'spray'].includes(type) ||
          !Number.isInteger(qty) ||
          qty <= 0 ||
          !Number.isFinite(cost) ||
          cost < 0
        ) {
          const error = new Error(
            'Invalid size, type, quantity, or cost'
          );
          error.statusCode = 400;
          throw error;
        }

        const bottle = await Bottle.findOne({
          sizeMl: parsedSize,
          type,
        }).session(session);

        if (!bottle) {
          const error = new Error(
            `Bottle ${parsedSize}ml (${type}) not found`
          );
          error.statusCode = 404;
          throw error;
        }

        if (cost > 0) {
          bottle.addPurchase(
            qty,
            cost,
            qty * cost,
            'Production',
            'BATCH-PROD'
          );
        } else {
          bottle.currentStock =
            Number(bottle.currentStock || 0) + qty;

          bottle.isStockOut = false;
        }

        await bottle.save({ session });

        await InventoryLog.create(
          [{
            bottle: bottle._id,
            changeQuantity: qty,
            reason: 'production',
            date: new Date(),
            notes: `Bulk added ${qty} bottles (${parsedSize}ml, ${type})`,
          }],
          { session }
        );

        updatedBottle = bottle;
      });

      updated.push(updatedBottle);
    } catch (error) {
      errors.push({
        item,
        error: error.message,
      });
    } finally {
      await session.endSession();
    }
  }

  return res.json({
    message: `Updated ${updated.length} bottles, ${errors.length} errors`,
    updated,
    errors,
  });
};
/* ========================================
   BOTTLE PURCHASE
======================================== */

exports.addBottlePurchase = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      const {
        quantity,
        costPerUnit,
        supplier,
        invoiceNo,
      } = req.body;

      const qty = Number(quantity);
      const cost = Number(costPerUnit);

      if (!Number.isInteger(qty) || qty <= 0) {
        const error = new Error(
          'Quantity must be a positive whole number'
        );
        error.statusCode = 400;
        throw error;
      }

      if (!Number.isFinite(cost) || cost < 0) {
        const error = new Error(
          'Cost per unit must be a non-negative number'
        );
        error.statusCode = 400;
        throw error;
      }

      const bottle = await Bottle.findById(
        req.params.id
      ).session(session);

      if (!bottle) {
        const error = new Error('Bottle not found');
        error.statusCode = 404;
        throw error;
      }

      const totalCost = qty * cost;

      bottle.addPurchase(
        qty,
        cost,
        totalCost,
        supplier || '',
        invoiceNo || ''
      );

      await bottle.save({ session });

      await InventoryLog.create(
        [{
          bottle: bottle._id,
          changeQuantity: qty,
          reason: 'purchase',
          date: new Date(),
          notes: `Purchase from ${supplier || 'unknown supplier'} - ${invoiceNo || 'no invoice'}`,
        }],
        { session }
      );

      response = {
        message: 'Purchase recorded successfully',
        bottle,
      };
    });

    return res.json(response);
  } catch (error) {
    console.error('Bottle purchase error:', error);

    return res.status(error.statusCode || 500).json({
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};
/* ========================================
   RAW MATERIAL STOCK OUT
======================================== */


exports.stockOutMaterial = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      const material = await RawMaterial.findById(
        req.params.id
      ).session(session);

      if (!material) {
        const error = new Error('Material not found');
        error.statusCode = 404;
        throw error;
      }

      const remainingStock = Math.round(
        Number(material.currentStockMl || 0) * 100
      ) / 100;

      if (remainingStock <= 0) {
        material.currentStockMl = 0;
        material.isStockOut = true;

        await material.save({ session });

        response = {
          message: 'Material is already out of stock.',
          wastageQuantityMl: 0,
          material,
        };

        return;
      }

      const wastageAmount = Math.round(
        remainingStock *
        Number(material.avgCostPerMl || 0) *
        100
      ) / 100;

      const now = new Date();

      const [expense] = await Expense.create(
        [{
          type: 'regular',
          category: 'Wastage',
          amount: wastageAmount,
          date: now,
          description: `Stock out: ${material.name} (${remainingStock.toFixed(2)} ml)`,
          reference: material.sku,
          material: material._id,
          quantityMl: remainingStock,
          notes: `Stock-out recorded on ${now.toISOString()}`,
        }],
        { session }
      );

      await Transaction.create(
        [{
          type: 'cash_out',
          amount: wastageAmount,
          category: 'Expense',
          reference: expense._id,
          refModel: 'Expense',
          date: now,
          description: `Wastage from stock-out: ${material.name}`,
        }],
        { session }
      );

      await InventoryLog.create(
        [{
          material: material._id,
          changeQuantity: -remainingStock,
          reason: 'wastage',
          reference: expense._id,
          refModel: 'Expense',
          date: now,
          notes: `Stock out: remaining ${remainingStock.toFixed(2)} ml sent to wastage`,
        }],
        { session }
      );

      material.currentCycleWastageMl = Math.round(
        (
          Number(material.currentCycleWastageMl || 0) +
          remainingStock
        ) * 100
      ) / 100;

      material.currentStockMl = 0;
      material.isStockOut = true;

      await material.save({ session });

      response = {
        message: `Material "${material.name}" marked as stock-out.`,
        wastageQuantityMl: remainingStock,
        expenseId: expense._id,
        material,
      };
    });

    return res.json(response);
  } catch (error) {
    console.error('Stock-out error:', error);

    return res.status(error.statusCode || 500).json({
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

exports.adjustMaterialStock = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      const material = await RawMaterial.findById(
        req.params.id
      ).session(session);

      if (!material) {
        const error = new Error('Material not found');
        error.statusCode = 404;
        throw error;
      }

      const {
        newStockMl,
        reason,
        recordAsWastage = true,
        notes,
      } = req.body;

      const target = Number(newStockMl);

      if (
        newStockMl === undefined ||
        !Number.isFinite(target) ||
        target < 0
      ) {
        const error = new Error(
          'newStockMl must be a non-negative number'
        );
        error.statusCode = 400;
        throw error;
      }

      const oldStock = Number(
        material.currentStockMl || 0
      );

      const delta = Math.round(
        (target - oldStock) * 100
      ) / 100;

      if (Math.abs(delta) < 0.001) {
        response = {
          message: 'No change needed',
          material,
        };

        return;
      }

      const now = new Date();

      let expenseId = null;
      let wastageAmount = 0;

      if (delta < 0 && recordAsWastage === true) {
        const lossMl = Math.abs(delta);

        wastageAmount = Math.round(
          lossMl *
          Number(material.avgCostPerMl || 0) *
          100
        ) / 100;

        const [expense] = await Expense.create(
          [{
            type: 'regular',
            category: 'Wastage',
            amount: wastageAmount,
            date: now,
            description: `Stock adjustment: ${material.name} (${lossMl.toFixed(2)} ml)`,
            reference: material.sku,
            material: material._id,
            quantityMl: lossMl,
            notes: notes || `Adjustment from ${oldStock} ml to ${target} ml`,
          }],
          { session }
        );

        expenseId = expense._id;

        await Transaction.create(
          [{
            type: 'cash_out',
            amount: wastageAmount,
            category: 'Expense',
            reference: expense._id,
            refModel: 'Expense',
            date: now,
            description: `Wastage from stock adjustment: ${material.name}`,
          }],
          { session }
        );

        await InventoryLog.create(
          [{
            material: material._id,
            changeQuantity: -lossMl,
            reason: 'wastage',
            reference: expense._id,
            refModel: 'Expense',
            date: now,
            notes: notes || `Wastage adjustment: ${oldStock} ml → ${target} ml`,
          }],
          { session }
        );

        material.currentCycleWastageMl = Math.round(
          (
            Number(material.currentCycleWastageMl || 0) +
            lossMl
          ) * 100
        ) / 100;
      } else {
        await InventoryLog.create(
          [{
            material: material._id,
            changeQuantity: delta,
            reason: 'adjustment',
            date: now,
            notes: notes ||
              `Manual stock adjustment: ${oldStock} → ${target} ml (${reason || 'recount'})`,
          }],
          { session }
        );
      }

      material.currentStockMl = target;
      material.isStockOut = target === 0;

      await material.save({ session });

      response = {
        message: `Stock adjusted from ${oldStock} → ${target} ml`,
        wastageRecorded: wastageAmount,
        expenseId,
        material,
      };
    });

    return res.json(response);
  } catch (error) {
    console.error('Adjust stock error:', error);

    return res.status(error.statusCode || 500).json({
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};