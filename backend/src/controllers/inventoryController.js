const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const InventoryLog = require('../models/InventoryLog');
const Sale = require('../models/Sale');

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

exports.updateMaterial =
  async (req, res) => {
    try {
      const {
        name,
        sku,
        type,
      } = req.body;

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

      if (name) {
        material.name =
          name;
      }

      if (sku) {
        material.sku =
          sku;
      }

      if (type) {
        material.type =
          type;
      }

      await material.save();

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
    const bottles =
      await Bottle.find()
        .select(
          [
            'sizeMl',
            'type',
            'currentStock',
            'sellingPrice',
            'images',
            'isStockOut',
            'createdAt',
            'updatedAt',
          ].join(' ')
        )
        .sort({
          type: 1,
          sizeMl: 1,
        })
        .lean();

    console.log(
      `Public bottles found: ${bottles.length}`
    );

    return res.json(
      bottles
    );
  } catch (error) {
    console.error(
      'Public bottles error:',
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

exports.bulkAddStockToBottles =
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
      const updated = [];

      for (
        const item of
        items
      ) {
        try {
          const {
            sizeMl,
            type,
            quantity,
            costPerUnit,
          } = item;

          const qty =
            Number(
              quantity
            );

          if (
            sizeMl ===
              undefined ||
            !type ||
            !Number.isInteger(
              qty
            ) ||
            qty <= 0
          ) {
            errors.push({
              item,
              error:
                'Missing or invalid fields (sizeMl, type, quantity)',
            });

            continue;
          }

          const bottle =
            await Bottle.findOne({
              sizeMl:
                Number(
                  sizeMl
                ),

              type,
            });

          if (!bottle) {
            errors.push({
              item,
              error:
                `Bottle ${sizeMl}ml (${type}) not found`,
            });

            continue;
          }

          const cost =
            Number(
              costPerUnit
            );

          if (
            Number.isFinite(
              cost
            ) &&
            cost > 0
          ) {
            const totalCost =
              qty *
              cost;

            bottle.addPurchase(
              qty,
              cost,
              totalCost,
              'Production',
              'BATCH-PROD'
            );
          } else {
            bottle.currentStock +=
              qty;

            bottle.isStockOut =
              false;
          }

          await bottle.save();

          await InventoryLog.create({
            bottle:
              bottle._id,

            changeQuantity:
              qty,

            reason:
              'production',

            notes:
              `Bulk added ${qty} bottles (${sizeMl}ml, ${type})`,
          });

          updated.push(
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

      return res.json({
        message:
          `Updated ${updated.length} bottles, ${errors.length} errors`,

        updated,
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
   BOTTLE PURCHASE
======================================== */

exports.addBottlePurchase =
  async (req, res) => {
    try {
      const {
        quantity,
        costPerUnit,
        supplier,
        invoiceNo,
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

      const qty =
        Number(
          quantity
        );

      const cost =
        Number(
          costPerUnit
        );

      if (
        !Number.isInteger(
          qty
        ) ||
        qty <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'Quantity must be a positive whole number',
          });
      }

      if (
        !Number.isFinite(
          cost
        ) ||
        cost < 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'Cost per unit must be >= 0',
          });
      }

      const totalCost =
        qty *
        cost;

      bottle.addPurchase(
        qty,
        cost,
        totalCost,
        supplier || '',
        invoiceNo || ''
      );

      await bottle.save();

      await InventoryLog.create({
        bottle:
          bottle._id,

        changeQuantity:
          qty,

        reason:
          'purchase',

        notes:
          `Purchase from ${supplier || 'unknown supplier'} - ${invoiceNo || 'no invoice'}`,
      });

      return res.json({
        message:
          'Purchase recorded successfully',

        bottle,
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
   RAW MATERIAL STOCK OUT
======================================== */

exports.stockOutMaterial =
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

      const remainingStock =
        Number(
          material.currentStockMl ||
            0
        );

      const avgCost =
        Number(
          material.avgCostPerMl ||
            0
        );

      if (
        remainingStock >
        0
      ) {
        const wastageAmount =
          remainingStock *
          avgCost;

        const Expense =
          require('../models/Expense');

        const Transaction =
          require('../models/Transaction');

        const expense =
          await Expense.create({
            type:
              'regular',

            category:
              'Wastage',

            amount:
              wastageAmount,

            date:
              new Date(),

            description:
              `Stock out: ${material.name} (${remainingStock} ml)`,

            reference:
              material.sku,

            notes:
              `Stock out on ${new Date().toISOString()}`,
          });

        await Transaction.create({
          type:
            'cash_out',

          amount:
            wastageAmount,

          category:
            'Expense',

          reference:
            expense._id,

          refModel:
            'Expense',

          description:
            `Wastage from stock-out: ${material.name}`,
        });

        await InventoryLog.create({
          material:
            material._id,

          changeQuantity:
            -remainingStock,

          reason:
            'wastage',

          notes:
            `Stock out: remaining ${remainingStock} ml sent to wastage`,
        });
      }

      material.currentCycleWastageMl =
        Number(
          material.currentCycleWastageMl ||
            0
        ) +
        remainingStock;

      material.currentStockMl =
        0;

      material.isStockOut =
        true;

      await material.save();

      return res.json({
        message:
          `Material "${material.name}" marked as stock-out.`,

        material,
      });
    } catch (error) {
      console.error(
        'Stock-out error:',
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
   MATERIAL STOCK ADJUSTMENT
======================================== */

exports.adjustMaterialStock =
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

      const {
        newStockMl,
        reason,
        recordAsWastage = true,
        notes,
      } = req.body;

      const target =
        Number(
          newStockMl
        );

      if (
        !Number.isFinite(
          target
        ) ||
        target < 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'newStockMl must be a non-negative number',
          });
      }

      const oldStock =
        Number(
          material.currentStockMl ||
            0
        );

      const delta =
        target -
        oldStock;

      if (
        Math.abs(
          delta
        ) <
        0.001
      ) {
        return res.json({
          message:
            'No change needed',

          material,
        });
      }

      await InventoryLog.create({
        material:
          material._id,

        changeQuantity:
          delta,

        reason:
          'adjustment',

        notes:
          notes ||
          `Manual stock adjustment: ${oldStock} → ${target} ml (${reason || 'recount'})`,
      });

      let wastageAmount = 0;

      if (
        delta < 0 &&
        recordAsWastage
      ) {
        const lossMl =
          Math.abs(
            delta
          );

        wastageAmount =
          lossMl *
          Number(
            material.avgCostPerMl ||
              0
          );

        if (
          wastageAmount >
          0.01
        ) {
          const Expense =
            require('../models/Expense');

          const Transaction =
            require('../models/Transaction');

          const expense =
            await Expense.create({
              type:
                'regular',

              category:
                'Wastage',

              amount:
                wastageAmount,

              date:
                new Date(),

              description:
                `Stock adjustment: ${material.name} (${lossMl.toFixed(2)} ml)`,

              reference:
                material.sku,

              notes:
                notes ||
                `Adjustment from ${oldStock} → ${target} ml`,
            });

          await Transaction.create({
            type:
              'cash_out',

            amount:
              wastageAmount,

            category:
              'Expense',

            reference:
              expense._id,

            refModel:
              'Expense',

            description:
              `Wastage from stock adjustment: ${material.name}`,
          });
        }

        material.currentCycleWastageMl =
          Number(
            material.currentCycleWastageMl ||
              0
          ) +
          lossMl;
      } else if (
        delta > 0
      ) {
        material.currentCycleWastageMl =
          0;

        material.lastRestockAt =
          new Date();
      }

      material.currentStockMl =
        target;

      material.isStockOut =
        target === 0;

      await material.save();

      return res.json({
        message:
          `Stock adjusted from ${oldStock} → ${target} ml`,

        wastageRecorded:
          wastageAmount,

        material,
      });
    } catch (error) {
      console.error(
        'Adjust stock error:',
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