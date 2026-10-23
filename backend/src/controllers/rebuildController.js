const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');

/* ========================================
   HELPERS
======================================== */

const getId = (value) =>
  value?._id?.toString() || value?.toString() || null;

const getItemType = (item) => item?.itemType || 'product';

function getSizeBlend(product, sizeMl) {
  const size = product.sizes?.find(
    (s) => Number(s.sizeMl) === Number(sizeMl)
  );

  // For sprays, prefer the formula for this exact size.
  if (size?.blendComponents?.length) {
    return size.blendComponents;
  }

  return product.blendComponents || [];
}

const roundMl = (value) => Math.round(value * 10000) / 10000;

/* ========================================
   FORMULAS
======================================== */

const sprayRules = {
  6: { oil: 58, ethanol: 39, iso: 1, glx: 1, ambx: 1 },
  15: { oil: 55, ethanol: 42, iso: 1, glx: 1, ambx: 1 },
  30: { oil: 55, ethanol: 42, iso: 1, glx: 1, ambx: 1 },
  50: { oil: 55, ethanol: 42, iso: 1, glx: 1, ambx: 1 },
  100: { oil: 55, ethanol: 42, iso: 1, glx: 1, ambx: 1 },
};

const specialSprays = {
  SR_SP: {
    oilComponents: [
      { sku: 'DunIco', percentage: 52 },
      { sku: 'DipTam', percentage: 48 },
    ],
  },
  LUXE1_SP: {
    oilComponents: [
      { sku: 'GucFla', percentage: 28 },
      { sku: 'CreAve', percentage: 72 },
    ],
  },
};

const requiredMaterials = [
  { name: 'Ethanol', sku: 'ETH', type: 'ethanol' },
  { name: 'Iso E Super', sku: 'Iso', type: 'fixative' },
  { name: 'Galaxolide', sku: 'Glx', type: 'fixative' },
  { name: 'Ambroxan', sku: 'Ambx', type: 'fixative' },
  { name: 'Dunhill Icon', sku: 'DunIco', type: 'oil' },
  { name: 'Diptyque tam dao', sku: 'DipTam', type: 'oil' },
  { name: 'Gucci Flora', sku: 'GucFla', type: 'oil' },
  { name: 'Creed Aventus', sku: 'CreAve', type: 'oil' },
];

/* ========================================
   ENSURE REQUIRED MATERIALS EXIST
======================================== */

async function ensureRequiredMaterials() {
  for (const item of requiredMaterials) {
    let material = await RawMaterial.findOne({ sku: item.sku });

    if (!material) {
      material = await RawMaterial.findOne({ name: item.name });
    }

    if (!material) {
      material = new RawMaterial({
        ...item,
        currentStockMl: 0,
        avgCostPerMl: 0,
      });

      await material.save();
      console.log(`[MATERIAL CREATED] ${item.name} (${item.sku})`);
    } else {
      let changed = false;

      if (material.type !== item.type) {
        material.type = item.type;
        changed = true;
      }

      if (!material.sku) {
        material.sku = item.sku;
        changed = true;
      }

      if (changed) await material.save();
    }
  }
}

/* ========================================
   APPLY EXACT PRODUCT BLENDS
======================================== */

async function applyExactBlends() {
  console.log('[BLENDS] Applying product formulas...');

  await ensureRequiredMaterials();

  const materials = await RawMaterial.find();
  const matMap = {};

  for (const material of materials) {
    if (material.sku) matMap[material.sku] = material;
  }

  const products = await Product.find({ isActive: true });

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    try {
      /* ------------------------------------
         ROLL-ON PRODUCTS
      ------------------------------------ */

      if (product.type === 'roll-on') {
        const oilMaterial = matMap[product.sku];

        if (!oilMaterial) {
          console.warn(
            `[BLEND SKIPPED] No oil material for roll-on ${product.name} (${product.sku})`
          );
          skipped++;
          continue;
        }

        let changed = false;

        if (getId(product.baseOil) !== getId(oilMaterial._id)) {
          product.baseOil = oilMaterial._id;
          changed = true;
        }

        for (const size of product.sizes || []) {
          if (Number(size.oilMlUsed || 0) !== Number(size.sizeMl)) {
            size.oilMlUsed = Number(size.sizeMl);
            changed = true;
          }

          if (Number(size.ethanolMlUsed || 0) !== 0) {
            size.ethanolMlUsed = 0;
            changed = true;
          }

          if (Number(size.fixativeMlUsed || 0) !== 0) {
            size.fixativeMlUsed = 0;
            changed = true;
          }
        }

        if (changed) {
          product.markModified('sizes');
          await product.save();
          updated++;
        }

        continue;
      }

      /* ------------------------------------
         SPRAY PRODUCTS
      ------------------------------------ */

      if (product.type !== 'spray') {
        skipped++;
        continue;
      }

      const ethanol = matMap.ETH;
      const iso = matMap.Iso;
      const glx = matMap.Glx;
      const ambx = matMap.Ambx;

      if (!ethanol || !iso || !glx || !ambx) {
        console.warn(
          `[BLEND SKIPPED] Required fixative/ethanol material missing for ${product.name}`
        );
        skipped++;
        continue;
      }

      const specialConfig = specialSprays[product.sku];
      let productChanged = false;

      for (const size of product.sizes || []) {
        const sizeMl = Number(size.sizeMl);
        const rule = sprayRules[sizeMl];

        // Never silently use a different size's formula.
        if (!rule) {
          console.warn(
            `[BLEND SKIPPED] No formula configured for ${product.name} ${sizeMl}ml`
          );
          continue;
        }

        const components = [];

        /* Oil component(s) */
        if (specialConfig) {
          for (const oilComponent of specialConfig.oilComponents) {
            const oilMaterial = matMap[oilComponent.sku];

            if (!oilMaterial) {
              console.warn(
                `[BLEND MATERIAL MISSING] ${oilComponent.sku} for ${product.name}`
              );
              continue;
            }

            const percentage =
              (oilComponent.percentage / 100) * rule.oil;

            components.push({
              material: oilMaterial._id,
              percentage: Number(percentage.toFixed(4)),
            });
          }
        } else {
          const oilSku = product.sku.replace(/_SP$/, '');
          let oilMaterial = matMap[oilSku];

          if (!oilMaterial) {
            const baseName = product.name.replace(/\s+Spray$/i, '').trim();
            const escapedName = baseName.replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&'
            );

            oilMaterial = await RawMaterial.findOne({
              name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
            });
          }

          if (!oilMaterial) {
            console.warn(
              `[BLEND MATERIAL MISSING] Oil not found for ${product.name} (${product.sku})`
            );
            skipped++;
            components.length = 0;
            break;
          }

          components.push({
            material: oilMaterial._id,
            percentage: rule.oil,
          });
        }

        /* Ethanol and fixatives */
        components.push(
          { material: ethanol._id, percentage: rule.ethanol },
          { material: iso._id, percentage: rule.iso },
          { material: glx._id, percentage: rule.glx },
          { material: ambx._id, percentage: rule.ambx }
        );

        if (!components.length) continue;

        /*
         * Correct only minor floating-point differences.
         * Formula totals should already be 100%.
         */
        const total = components.reduce(
          (sum, component) => sum + Number(component.percentage || 0),
          0
        );

        if (Math.abs(total - 100) > 0.05) {
          console.error(
            `[INVALID BLEND] ${product.name} ${sizeMl}ml totals ${total}%`
          );
          continue;
        }

        const current = size.blendComponents || [];

        const same =
          current.length === components.length &&
          current.every((component, index) => {
            return (
              getId(component.material) ===
                getId(components[index].material) &&
              Math.abs(
                Number(component.percentage) -
                  Number(components[index].percentage)
              ) < 0.0001
            );
          });

        if (!same) {
          size.blendComponents = components.map((component) => ({
            material: component.material,
            percentage: component.percentage,
          }));

          productChanged = true;
        }
      }

      if (product.blendComponents?.length) {
        product.blendComponents = [];
        productChanged = true;
      }

      if (product.baseOil) {
        product.baseOil = null;
        productChanged = true;
      }

      if (productChanged) {
        product.markModified('sizes');
        product.markModified('blendComponents');
        await product.save();
        updated++;
      }
    } catch (error) {
      console.error(
        `[BLEND ERROR] ${product.name}:`,
        error.message
      );
    }
  }

  console.log(
    `[BLENDS] Complete. ${updated} products updated; ${skipped} skipped.`
  );
}

/* ========================================
   REBUILD STOCK
======================================== */

exports.rebuildStock = async (req, res) => {
  try {
    console.log('[REBUILD] Starting inventory rebuild...');

    /*
     * IMPORTANT:
     * Update product formulas BEFORE reading products for consumption.
     */
    await applyExactBlends();

    /* ====================================
       PURCHASES
    ==================================== */

    const purchases = await Purchase.find().lean();

    const purchaseQty = {};
    const purchaseCost = {};

    for (const purchase of purchases) {
      for (const item of purchase.items || []) {
        const entityId = getId(item.item);
        if (!entityId) continue;

        const quantity = Number(item.quantity || 0);
        const totalCost = Number(item.totalCost || 0);

        purchaseQty[entityId] =
          (purchaseQty[entityId] || 0) + quantity;

        if (!purchaseCost[entityId]) {
          purchaseCost[entityId] = {
            totalCost: 0,
            totalQty: 0,
          };
        }

        purchaseCost[entityId].totalCost += totalCost;
        purchaseCost[entityId].totalQty += quantity;
      }
    }

    /* ====================================
       LOAD CURRENT PRODUCTS AND MATERIALS
    ==================================== */

    const [sales, products, materials] = await Promise.all([
      Sale.find().lean(),
      Product.find().lean(),
      RawMaterial.find(),
    ]);

    const productMap = {};

    for (const product of products) {
      productMap[getId(product._id)] = product;
    }

    const materialNameMap = {};

    for (const material of materials) {
      materialNameMap[material.name.toLowerCase()] = getId(material._id);

      if (material.sku) {
        materialNameMap[material.sku.toLowerCase()] = getId(material._id);
      }
    }

    const rawConsumption = {};
    const perfumeBottleUsage = {};
    const directBottleSales = {};
    const brokenProducts = new Set();

    /* ====================================
       CALCULATE SALES CONSUMPTION
    ==================================== */

    for (const sale of sales) {
      for (const item of sale.items || []) {
        const itemType = getItemType(item);
        const quantity = Number(item.quantity || 0);

        if (quantity <= 0) continue;

        /* Direct bottle sales */
        if (itemType === 'bottle') {
          const bottleId = getId(item.bottle);

          if (!bottleId) {
            console.warn(
              `[SALE WARNING] Bottle reference missing in ${sale.invoiceNo || sale._id}`
            );
            continue;
          }

          directBottleSales[bottleId] =
            (directBottleSales[bottleId] || 0) + quantity;

          continue;
        }

        /* Perfume product sales */
        const productId = getId(item.product);

        if (!productId) {
          console.warn(
            `[SALE WARNING] Product reference missing in ${sale.invoiceNo || sale._id}`
          );
          continue;
        }

        const product = productMap[productId];

        if (!product) {
          console.warn(
            `[SALE WARNING] Product ${productId} not found in ${sale.invoiceNo || sale._id}`
          );
          continue;
        }

        const sizeMl = Number(item.sizeMl || 0);

        if (sizeMl <= 0) {
          console.warn(
            `[SALE WARNING] Invalid size for ${product.name} in ${sale.invoiceNo || sale._id}`
          );
          continue;
        }

        const sizeVariant = product.sizes?.find(
          (size) => Number(size.sizeMl) === sizeMl
        );

        /* Bottle included with perfume */
        if (sizeVariant?.bottle) {
          const bottleId = getId(sizeVariant.bottle);

          if (bottleId) {
            perfumeBottleUsage[bottleId] =
              (perfumeBottleUsage[bottleId] || 0) + quantity;
          }
        }

        /* Roll-on consumption */
        if (product.type === 'roll-on') {
          const oilId = getId(product.baseOil);

          if (!oilId) {
            brokenProducts.add(
              `${product.name} (${product.sku}): missing baseOil`
            );
            continue;
          }

          const oilMlUsed = Number(
            sizeVariant?.oilMlUsed || sizeMl
          );

          const totalMl = oilMlUsed * quantity;

          rawConsumption[oilId] =
            (rawConsumption[oilId] || 0) + totalMl;

          console.log('[RAW CONSUMPTION]', {
            product: product.name,
            sizeMl,
            quantity,
            materialId: oilId,
            percentage: 100,
            mlUsed: totalMl,
          });

          continue;
        }

        /* Spray consumption */
        if (product.type === 'spray') {
          const components = getSizeBlend(product, sizeMl);

          if (!components.length) {
            brokenProducts.add(
              `${product.name} @ ${sizeMl}ml (${product.sku}): missing blendComponents`
            );
            console.warn(
              `[MISSING BLEND] ${product.name} ${sizeMl}ml has no components`
            );
            continue;
          }

          for (const component of components) {
            const percentage = Number(component.percentage || 0);
            if (percentage <= 0) continue;

            let materialId = getId(component.material);

            if (!materialId && component.name) {
              materialId =
                materialNameMap[component.name.toLowerCase()];
            }

            if (!materialId) {
              console.warn('[MISSING BLEND MATERIAL]', {
                product: product.name,
                sizeMl,
                component,
              });
              continue;
            }

            const mlUsed = sizeMl * (percentage / 100) * quantity;

            rawConsumption[materialId] =
              (rawConsumption[materialId] || 0) + mlUsed;

            console.log('[RAW CONSUMPTION]', {
              product: product.name,
              sku: product.sku,
              sizeMl,
              quantity,
              materialId,
              percentage,
              mlUsed: roundMl(mlUsed),
            });
          }
        }
      }
    }

    /* ====================================
       WASTAGE LOGS
    ==================================== */

    const [materialWastageLogs, bottleWastageLogs, productionLogs] =
      await Promise.all([
        InventoryLog.find({
          reason: 'wastage',
          material: { $ne: null },
        }).lean(),

        InventoryLog.find({
          reason: 'wastage',
          bottle: { $ne: null },
        }).lean(),

        InventoryLog.find({
          reason: 'production',
          bottle: { $ne: null },
          changeQuantity: { $gt: 0 },
        }).lean(),
      ]);

    const materialWastage = {};
    const bottleWastage = {};
    const bottleProduction = {};

    for (const log of materialWastageLogs) {
      const id = getId(log.material);
      if (!id) continue;

      materialWastage[id] =
        (materialWastage[id] || 0) +
        Number(log.changeQuantity || 0);
    }

    for (const log of bottleWastageLogs) {
      const id = getId(log.bottle);
      if (!id) continue;

      bottleWastage[id] =
        (bottleWastage[id] || 0) +
        Number(log.changeQuantity || 0);
    }

    for (const log of productionLogs) {
      const id = getId(log.bottle);
      if (!id) continue;

      bottleProduction[id] =
        (bottleProduction[id] || 0) +
        Number(log.changeQuantity || 0);
    }

    /* ====================================
       UPDATE RAW MATERIAL STOCK
    ==================================== */

    const allMaterials = await RawMaterial.find();

    let materialUpdatedCount = 0;
    const materialSummary = [];

    for (const material of allMaterials) {
      const id = getId(material._id);

      const purchased = Number(purchaseQty[id] || 0);
      const consumed = Number(rawConsumption[id] || 0);
      const wastedChange = Number(materialWastage[id] || 0);

      /*
       * Wastage logs are expected to be negative:
       * stock = purchases - sales consumption + wastage change.
       */
      let netStock = purchased - consumed + wastedChange;

      if (netStock < 0) {
        console.warn('[NEGATIVE RAW STOCK CLAMPED]', {
          material: material.name,
          purchased,
          consumed,
          wastedChange,
          calculatedStock: netStock,
        });

        netStock = 0;
      }

      const costData = purchaseCost[id];
      const avgCost =
        costData && costData.totalQty > 0
          ? costData.totalCost / costData.totalQty
          : 0;

      const previousStock = Number(material.currentStockMl || 0);
      let changed = false;

      if (Math.abs(previousStock - netStock) > 0.0001) {
        material.currentStockMl = roundMl(netStock);
        changed = true;
      }

      if (
        Math.abs(Number(material.avgCostPerMl || 0) - avgCost) >
        0.0001
      ) {
        material.avgCostPerMl = avgCost;
        changed = true;
      }

      const isStockOut = netStock === 0;

      if (material.isStockOut !== isStockOut) {
        material.isStockOut = isStockOut;
        changed = true;
      }

      if (changed) {
        await material.save();
        materialUpdatedCount++;
      }

      const row = {
        material: material.name,
        sku: material.sku,
        purchased: roundMl(purchased),
        consumed: roundMl(consumed),
        wastageChange: roundMl(wastedChange),
        calculatedStock: roundMl(netStock),
      };

      materialSummary.push(row);
      console.log('[RAW STOCK RESULT]', row);
    }

    /* ====================================
       UPDATE BOTTLE STOCK
    ==================================== */

    const allBottles = await Bottle.find();

    let bottleUpdatedCount = 0;
    const bottleSummary = [];

    for (const bottle of allBottles) {
      const id = getId(bottle._id);

      const purchased = Number(purchaseQty[id] || 0);
      const produced = Number(bottleProduction[id] || 0);
      const usedForPerfume = Number(perfumeBottleUsage[id] || 0);
      const soldDirectly = Number(directBottleSales[id] || 0);
      const wastedChange = Number(bottleWastage[id] || 0);

      const totalAvailable = purchased + produced;

      let netStock =
        totalAvailable -
        usedForPerfume -
        soldDirectly +
        wastedChange;

      if (netStock < 0) {
        console.warn('[NEGATIVE BOTTLE STOCK CLAMPED]', {
          sizeMl: bottle.sizeMl,
          type: bottle.type,
          calculatedStock: netStock,
        });

        netStock = 0;
      }

      const costData = purchaseCost[id];
      const avgCost =
        costData && costData.totalQty > 0
          ? costData.totalCost / costData.totalQty
          : 0;

      let changed = false;

      if (Number(bottle.currentStock || 0) !== netStock) {
        bottle.currentStock = netStock;
        changed = true;
      }

      if (
        Math.abs(Number(bottle.avgCostPerUnit || 0) - avgCost) >
        0.0001
      ) {
        bottle.avgCostPerUnit = avgCost;
        changed = true;
      }

      if (Number(bottle.totalPurchased || 0) !== totalAvailable) {
        bottle.totalPurchased = totalAvailable;
        changed = true;
      }

      const isStockOut = netStock === 0;

      if (bottle.isStockOut !== isStockOut) {
        bottle.isStockOut = isStockOut;
        changed = true;
      }

      if (changed) {
        await bottle.save();
        bottleUpdatedCount++;
      }

      const row = {
        bottleId: id,
        sizeMl: bottle.sizeMl,
        type: bottle.type,
        purchased,
        produced,
        usedForPerfume,
        soldDirectly,
        wastedChange,
        available: netStock,
      };

      bottleSummary.push(row);
      console.log('[BOTTLE STOCK RESULT]', row);
    }

    /* ====================================
       RESPONSE
    ==================================== */

    return res.json({
      message: 'Stock rebuilt successfully.',
      updatedMaterials: materialUpdatedCount,
      updatedBottles: bottleUpdatedCount,
      totalMaterials: allMaterials.length,
      totalBottles: allBottles.length,
      brokenProducts: Array.from(brokenProducts),
      materialSummary,
      bottleSummary,
    });
  } catch (error) {
    console.error('[REBUILD ERROR]', error);

    return res.status(500).json({
      message: error.message,
    });
  }
};