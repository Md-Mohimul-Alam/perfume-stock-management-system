const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');

// ----- Helper: get the effective blend for a specific size of a product -----
function getSizeBlend(product, sizeMl) {
  const sizeVariant = product.sizes?.find(s => s.sizeMl === sizeMl);
  if (sizeVariant && sizeVariant.blendComponents && sizeVariant.blendComponents.length > 0) {
    return sizeVariant.blendComponents;
  }
  return product.blendComponents || [];
}

// ----- Helper: parse blend components (works for object or string form) -----
function parseBlendComponents(comps) {
  if (!comps) return [];
  if (Array.isArray(comps)) {
    return comps.filter(c => c.material && c.percentage);
  }
  if (typeof comps === 'string') {
    const parts = comps.split(';').map(s => s.trim());
    const parsed = [];
    for (const part of parts) {
      const match = part.match(/^(.*?)\s*\((\d+(?:\.\d+)?)%\)\s*$/);
      if (match) {
        parsed.push({ name: match[1].trim(), percentage: parseFloat(match[2]) });
      }
    }
    return parsed;
  }
  return [];
}

// ----- Helper: apply exact blends to all products (writes PER-SIZE blends) -----
async function applyExactBlends() {
  console.log('🔄 Applying exact product blends...');

  const fixatives = [
    { name: 'Ethanol', sku: 'ETH', type: 'ethanol' },
    { name: 'Iso E Super', sku: 'Iso', type: 'fixative' },
    { name: 'Galaxolide', sku: 'Glx', type: 'fixative' },
    { name: 'Ambroxan', sku: 'Ambx', type: 'fixative' },
  ];
  for (const f of fixatives) {
    let mat = await RawMaterial.findOne({ sku: f.sku });
    if (!mat) mat = await RawMaterial.findOne({ name: f.name });
    if (!mat) {
      console.log(`🆕 Creating material: ${f.name} (${f.sku})`);
      mat = new RawMaterial({ name: f.name, sku: f.sku, type: f.type, currentStockMl: 0, avgCostPerMl: 0 });
      await mat.save();
    } else if (mat.type !== f.type) {
      mat.type = f.type;
      await mat.save();
    }
  }

  const specialOils = [
    { name: 'Dunhill Icon', sku: 'DunIco', type: 'oil' },
    { name: 'Diptyque tam dao', sku: 'DipTam', type: 'oil' },
    { name: 'Gucci Flora', sku: 'GucFla', type: 'oil' },
    { name: 'Creed Aventus', sku: 'CreAve', type: 'oil' },
  ];
  for (const o of specialOils) {
    let mat = await RawMaterial.findOne({ sku: o.sku });
    if (!mat) mat = await RawMaterial.findOne({ name: o.name });
    if (!mat) {
      console.log(`🆕 Creating material: ${o.name} (${o.sku})`);
      mat = new RawMaterial({ name: o.name, sku: o.sku, type: o.type, currentStockMl: 0, avgCostPerMl: 0 });
      await mat.save();
    }
  }

  const materials = await RawMaterial.find();
  const matMap = {};
  materials.forEach(m => { matMap[m.sku] = m; });

  const products = await Product.find({ isActive: true });
  console.log(`📦 Applying blends to ${products.length} active products.`);

  // ✅ UPDATED: Regular spray rules — each size sums to exactly 100
  const sprayRules = {
    '6':   { oil: 45, ethanol: 52, iso: 1, glx: 1, ambx: 1 },
    '15':  { oil: 50, ethanol: 47, iso: 1, glx: 1, ambx: 1 },
    '30':  { oil: 52, ethanol: 45, iso: 1, glx: 1, ambx: 1 },
    '50':  { oil: 55, ethanol: 42, iso: 1, glx: 1, ambx: 1 },
    '100': { oil: 60, ethanol: 37, iso: 1, glx: 1, ambx: 1 },
  };

  // ✅ Special spray rules — used ONLY for SR_SP and LUXE1_SP
  const specialSprayRules = {
    '6':   { oil: 50, ethanol: 47, iso: 1, glx: 1, ambx: 1 },
    '15':  { oil: 55, ethanol: 42, iso: 1, glx: 1, ambx: 1 },
    '30':  { oil: 55, ethanol: 42, iso: 1, glx: 1, ambx: 1 },
    '50':  { oil: 55, ethanol: 42, iso: 1, glx: 1, ambx: 1 },
    '100': { oil: 60, ethanol: 37, iso: 1, glx: 1, ambx: 1 },
  };

  const specialSprays = {
    'SR_SP': {
      oilComponents: [
        { sku: 'DunIco', percentage: 52 },
        { sku: 'DipTam', percentage: 48 },
      ],
    },
    'LUXE1_SP': {
      oilComponents: [
        { sku: 'GucFla', percentage: 28 },
        { sku: 'CreAve', percentage: 72 },
      ],
    },
  };

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    try {
      // ---------- ROLL-ON ----------
      if (product.type === 'roll-on') {
        const oilSku = product.sku;
        const oilMat = matMap[oilSku];
        if (!oilMat) {
          console.warn(`⚠️ No oil material for roll‑on ${product.name} (SKU: ${product.sku})`);
          skipped++;
          continue;
        }
        if (!product.baseOil || product.baseOil.toString() !== oilMat._id.toString()) {
          product.baseOil = oilMat._id;
          for (const size of product.sizes) {
            size.oilMlUsed = size.sizeMl;
            size.ethanolMlUsed = 0;
            size.fixativeMlUsed = 0;
          }
          await product.save();
          updated++;
          console.log(`✅ Roll‑on ${product.name} → baseOil: ${oilMat.name}`);
        }
        continue;
      }

      // ---------- SPRAY ----------
      if (product.type === 'spray') {
        const isSpecialSpray = !!specialSprays[product.sku];
        const activeRules = isSpecialSpray ? specialSprayRules : sprayRules;
        const blendConfig = specialSprays[product.sku];

        const ethanolMat = matMap['ETH'];
        const isoMat = matMap['Iso'];
        const glxMat = matMap['Glx'];
        const ambxMat = matMap['Ambx'];

        let productChanged = false;

        for (const size of product.sizes) {
          const sizeMl = size.sizeMl;

          let sizeRule = null;
          for (const [ruleSize, rule] of Object.entries(activeRules)) {
            if (sizeMl <= parseInt(ruleSize)) {
              sizeRule = rule;
              break;
            }
          }
          if (!sizeRule) {
            const keys = Object.keys(activeRules).map(Number).sort((a, b) => a - b);
            sizeRule = activeRules[String(keys[keys.length - 1])];
          }
          if (!sizeRule) {
            console.warn(`⚠️ No blend rule for size ${sizeMl} of ${product.name}`);
            continue;
          }

          let oilComps = [];

          if (blendConfig) {
            const oilTotalPct = sizeRule.oil;
            for (const comp of blendConfig.oilComponents) {
              const mat = matMap[comp.sku];
              if (!mat) {
                console.warn(`⚠️ Material ${comp.sku} not found for ${product.sku}`);
                continue;
              }
              const pct = (comp.percentage / 100) * oilTotalPct;
              oilComps.push({ material: mat._id, percentage: parseFloat(pct.toFixed(2)) });
            }
          } else {
            const oilSku = product.sku.replace('_SP', '');
            let oilMat = matMap[oilSku];
            if (!oilMat) {
              const baseName = product.name.replace(' Spray', '');
              oilMat = await RawMaterial.findOne({ name: { $regex: new RegExp(`^${baseName}$`, 'i') } });
            }
            if (!oilMat) {
              console.warn(`⚠️ No oil material for spray ${product.name} (SKU: ${product.sku})`);
              break;
            }
            oilComps.push({ material: oilMat._id, percentage: sizeRule.oil });
          }

          if (ethanolMat) oilComps.push({ material: ethanolMat._id, percentage: sizeRule.ethanol });
          if (isoMat) oilComps.push({ material: isoMat._id, percentage: sizeRule.iso });
          if (glxMat) oilComps.push({ material: glxMat._id, percentage: sizeRule.glx });
          if (ambxMat) oilComps.push({ material: ambxMat._id, percentage: sizeRule.ambx });

          const total = oilComps.reduce((sum, c) => sum + c.percentage, 0);
          if (Math.abs(total - 100) > 0.01 && oilComps.length > 0) {
            const diff = 100 - total;
            oilComps[0].percentage = parseFloat((oilComps[0].percentage + diff).toFixed(2));
          }

          const current = size.blendComponents || [];
          const isCorrect = current.length === oilComps.length &&
            current.every((c, i) => {
              const matId = c.material?._id?.toString() || c.material?.toString();
              const newMatId = oilComps[i].material?.toString();
              return matId === newMatId && Math.abs(c.percentage - oilComps[i].percentage) < 0.01;
            });

          if (!isCorrect) {
            size.blendComponents = oilComps.map(c => ({
              material: c.material,
              percentage: c.percentage,
            }));
            productChanged = true;
          }
        }

        // Clear legacy product-level blend so nothing reads it
        if (product.blendComponents && product.blendComponents.length > 0) {
          product.blendComponents = [];
          productChanged = true;
        }
        product.baseOil = null;

        if (productChanged) {
          // ✅ Force mongoose to detect nested changes
          product.markModified('sizes');
          product.markModified('blendComponents');
          await product.save();
          updated++;
          console.log(`✅ Spray ${product.name} (${product.sku}) → per-size blends updated`);
        }
        continue;
      }

      skipped++;
    } catch (err) {
      console.error(`❌ Error processing ${product.name}:`, err.message);
    }
  }

  console.log(`📊 Blends applied: ${updated} products updated, ${skipped} skipped.`);
}

// ----- Main rebuild stock function -----
exports.rebuildStock = async (req, res) => {
  try {
    console.log('🔄 Rebuilding stock from purchases, sales, and wastage...');

    const purchases = await Purchase.find().lean();
    const purchaseQty = {};
    const purchaseCost = {};

    for (const purchase of purchases) {
      for (const item of purchase.items) {
        const entityId = item.item.toString();
        if (!purchaseQty[entityId]) purchaseQty[entityId] = 0;
        purchaseQty[entityId] += item.quantity;
        if (!purchaseCost[entityId]) purchaseCost[entityId] = { totalCost: 0, totalQty: 0 };
        purchaseCost[entityId].totalCost += item.totalCost;
        purchaseCost[entityId].totalQty += item.quantity;
      }
    }

    const sales = await Sale.find().populate('items.product');
    const rawConsumption = {};
    const bottleConsumption = {};
    const products = await Product.find();
    const productMap = {};
    products.forEach(p => productMap[p._id.toString()] = p);

    const materials = await RawMaterial.find();
    const materialNameMap = {};
    materials.forEach(m => materialNameMap[m.name.toLowerCase()] = m._id.toString());

    const brokenProducts = new Set();

    for (const sale of sales) {
      if (!sale.items) continue;
      for (const item of sale.items) {
        const productId = item.product?._id?.toString() || item.product?.toString();
        if (!productId) continue;
        const product = productMap[productId];
        if (!product) continue;

        const sizeMl = item.sizeMl || 0;
        const qty = item.quantity || 0;

        const sizeVariant = product.sizes.find(s => s.sizeMl === sizeMl);
        if (sizeVariant && sizeVariant.bottle) {
          const bottleId = sizeVariant.bottle.toString();
          if (!bottleConsumption[bottleId]) bottleConsumption[bottleId] = 0;
          bottleConsumption[bottleId] += qty;
        }

        if (product.type === 'roll-on') {
          if (product.baseOil) {
            const oilId = product.baseOil.toString();
            const oilMlUsed = sizeVariant?.oilMlUsed || sizeMl;
            const totalMl = oilMlUsed * qty;
            if (!rawConsumption[oilId]) rawConsumption[oilId] = 0;
            rawConsumption[oilId] += totalMl;
          } else {
            brokenProducts.add(`${product.name} (${product.sku})`);
          }
        } else if (product.type === 'spray') {
          const comps = getSizeBlend(product, sizeMl);
          if (comps.length === 0) {
            brokenProducts.add(`${product.name} @ ${sizeMl}ml (${product.sku})`);
            continue;
          }
          for (const comp of comps) {
            let materialId = comp.material?._id?.toString() || comp.material?.toString();
            if (!materialId && comp.name) {
              const lowerName = comp.name.toLowerCase();
              materialId = materialNameMap[lowerName];
            }
            if (!materialId) continue;
            const percentage = comp.percentage || 0;
            if (percentage === 0) continue;
            const mlUsed = (sizeMl * (percentage / 100)) * qty;
            if (!rawConsumption[materialId]) rawConsumption[materialId] = 0;
            rawConsumption[materialId] += mlUsed;
          }
        }
      }
    }

    if (brokenProducts.size > 0) {
      console.warn('⚠️ Products/sizes without a valid blend (their sales did NOT deduct raw material):');
      brokenProducts.forEach(p => console.warn(`   - ${p}`));
    }

    const wastageLogs = await InventoryLog.find({ reason: 'wastage', material: { $ne: null } });
    const wastageMap = {};
    for (const log of wastageLogs) {
      const matId = log.material.toString();
      if (!wastageMap[matId]) wastageMap[matId] = 0;
      wastageMap[matId] += log.changeQuantity;
    }

    const allMaterials = await RawMaterial.find();
    for (const mat of allMaterials) {
      const id = mat._id.toString();
      const purchased = purchaseQty[id] || 0;
      const consumed = rawConsumption[id] || 0;
      const wasted = wastageMap[id] || 0;
      let netStock = purchased - consumed + wasted;
      if (netStock < 0) netStock = 0;

      const costData = purchaseCost[id];
      let avgCost = 0;
      if (costData && costData.totalQty > 0) {
        avgCost = costData.totalCost / costData.totalQty;
      }

      if (mat.currentStockMl !== netStock || mat.avgCostPerMl !== avgCost || mat.isStockOut !== (netStock === 0)) {
        mat.currentStockMl = netStock;
        mat.avgCostPerMl = avgCost;
        mat.isStockOut = (netStock === 0);
        await mat.save();
        console.log(`✅ Material ${mat.name}: stock ${netStock}ml, isStockOut = ${mat.isStockOut}`);
      }
    }

    const allBottles = await Bottle.find();
    let bottleUpdatedCount = 0;
    for (const bottle of allBottles) {
      const id = bottle._id.toString();
      const purchased = purchaseQty[id] || 0;
      const consumed = bottleConsumption[id] || 0;
      let netStock = purchased - consumed;
      if (netStock < 0) netStock = 0;

      const costData = purchaseCost[id];
      let avgCost = 0;
      if (costData && costData.totalQty > 0) {
        avgCost = costData.totalCost / costData.totalQty;
      }

      let needsUpdate = false;
      if (bottle.currentStock !== netStock) { bottle.currentStock = netStock; needsUpdate = true; }
      if (bottle.avgCostPerUnit !== avgCost) { bottle.avgCostPerUnit = avgCost; needsUpdate = true; }
      if (bottle.totalPurchased !== undefined && bottle.totalPurchased !== purchased) {
        bottle.totalPurchased = purchased;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await bottle.save();
        bottleUpdatedCount++;
      }
    }

    await applyExactBlends();

    res.json({
      message: 'Stock rebuilt, product blends updated, and stock-out statuses refreshed.',
      updatedMaterials: allMaterials.filter(m => m.currentStockMl !== undefined).length,
      updatedBottles: bottleUpdatedCount,
      brokenProducts: Array.from(brokenProducts),
    });
  } catch (error) {
    console.error('Rebuild stock error:', error);
    res.status(500).json({ message: error.message });
  }
};