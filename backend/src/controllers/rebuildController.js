const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');

// ----- Helper: parse blend components for spray products -----
function parseBlendComponents(product) {
  const comps = product.blendComponents;
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

// ----- Helper: apply exact blends to all products -----
async function applyExactBlends() {
  console.log('🔄 Applying exact product blends...');

  // Ensure required materials exist
  const fixatives = [
    { name: 'Ethanol', sku: 'ETH', type: 'ethanol' },
    { name: 'Iso E Super', sku: 'Iso', type: 'fixative' },
    { name: 'Galaxolide', sku: 'Glx', type: 'fixative' },
    { name: 'Ambroxan', sku: 'Ambx', type: 'fixative' },
  ];
  for (const f of fixatives) {
    let mat = await RawMaterial.findOne({ sku: f.sku });
    if (!mat) {
      mat = await RawMaterial.findOne({ name: f.name });
    }
    if (!mat) {
      console.log(`🆕 Creating material: ${f.name} (${f.sku})`);
      mat = new RawMaterial({ name: f.name, sku: f.sku, type: f.type, currentStockMl: 0, avgCostPerMl: 0 });
      await mat.save();
    } else if (mat.type !== f.type) {
      mat.type = f.type;
      await mat.save();
    }
  }

  // Also ensure special oils exist
  const specialOils = [
    { name: 'Dunhill Icon', sku: 'DunIco', type: 'oil' },
    { name: 'Diptyque tam dao', sku: 'DipTam', type: 'oil' },
    { name: 'Gucci Flora', sku: 'GucFla', type: 'oil' },
    { name: 'Creed Aventus', sku: 'CreAve', type: 'oil' },
  ];
  for (const o of specialOils) {
    let mat = await RawMaterial.findOne({ sku: o.sku });
    if (!mat) {
      mat = await RawMaterial.findOne({ name: o.name });
    }
    if (!mat) {
      console.log(`🆕 Creating material: ${o.name} (${o.sku})`);
      mat = new RawMaterial({ name: o.name, sku: o.sku, type: o.type, currentStockMl: 0, avgCostPerMl: 0 });
      await mat.save();
    }
  }

  // Fetch all materials
  const materials = await RawMaterial.find();
  const matMap = {};
  materials.forEach(m => { matMap[m.sku] = m; });

  // Fetch all products
  const products = await Product.find({ isActive: true });
  console.log(`📦 Applying blends to ${products.length} active products.`);

  // Blend rules based on the chart
  const sprayRules = {
    '6': { oil: 45, ethanol: 52, iso: 1, glx: 1, ambx: 1 },
    '15': { oil: 45, ethanol: 52, iso: 1, glx: 1, ambx: 1 },
    '30': { oil: 45, ethanol: 52, iso: 1, glx: 1, ambx: 1 },
    '50': { oil: 50, ethanol: 47, iso: 1, glx: 1, ambx: 1 },
    '100': { oil: 55, ethanol: 42, iso: 1, glx: 1, ambx: 1 },
  };

  const specialSprays = {
    'SR_SP': {
      oilComponents: [
        { sku: 'DunIco', percentage: 60 },
        { sku: 'DipTam', percentage: 40 },
      ],
      ethanol: 52,
      iso: 1,
      glx: 1,
      ambx: 1,
    },
    'LUXE1_SP': {
      oilComponents: [
        { sku: 'GucFla', percentage: 50 },
        { sku: 'CreAve', percentage: 50 },
      ],
      ethanol: 52,
      iso: 1,
      glx: 1,
      ambx: 1,
    },
  };

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    try {
      if (product.type === 'roll-on') {
        // Roll‑on: 100% oil
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

      if (product.type === 'spray') {
        // Check special blend first
        let blendConfig = specialSprays[product.sku];
        let sizeRule = null;

        if (!blendConfig) {
          const maxSize = Math.max(...product.sizes.map(s => s.sizeMl));
          for (const [size, rule] of Object.entries(sprayRules)) {
            if (maxSize <= parseInt(size)) {
              sizeRule = rule;
              break;
            }
          }
          if (!sizeRule) {
            console.warn(`⚠️ No blend rule for ${product.name} (SKU: ${product.sku})`);
            skipped++;
            continue;
          }
        }

        let oilComps = [];
        const ethanolMat = matMap['ETH'];
        const isoMat = matMap['Iso'];
        const glxMat = matMap['Glx'];
        const ambxMat = matMap['Ambx'];

        if (blendConfig) {
          // Special blend: multiple oils
          for (const comp of blendConfig.oilComponents) {
            const mat = matMap[comp.sku];
            if (!mat) {
              console.warn(`⚠️ Material ${comp.sku} not found for special blend ${product.sku}`);
              skipped++;
              continue;
            }
            oilComps.push({ material: mat._id, percentage: comp.percentage });
          }
          const ethPct = blendConfig.ethanol;
          const isoPct = blendConfig.iso;
          const glxPct = blendConfig.glx;
          const ambxPct = blendConfig.ambx;
          if (ethanolMat) oilComps.push({ material: ethanolMat._id, percentage: ethPct });
          if (isoMat) oilComps.push({ material: isoMat._id, percentage: isoPct });
          if (glxMat) oilComps.push({ material: glxMat._id, percentage: glxPct });
          if (ambxMat) oilComps.push({ material: ambxMat._id, percentage: ambxPct });
        } else {
          // Standard spray
          const oilSku = product.sku.replace('_SP', '');
          let oilMat = matMap[oilSku];
          if (!oilMat) {
            const baseName = product.name.replace(' Spray', '');
            oilMat = await RawMaterial.findOne({ name: { $regex: new RegExp(`^${baseName}$`, 'i') } });
          }
          if (!oilMat) {
            console.warn(`⚠️ No oil material for spray ${product.name} (SKU: ${product.sku})`);
            skipped++;
            continue;
          }
          oilComps = [
            { material: oilMat._id, percentage: sizeRule.oil },
          ];
          if (ethanolMat) oilComps.push({ material: ethanolMat._id, percentage: sizeRule.ethanol });
          if (isoMat) oilComps.push({ material: isoMat._id, percentage: sizeRule.iso });
          if (glxMat) oilComps.push({ material: glxMat._id, percentage: sizeRule.glx });
          if (ambxMat) oilComps.push({ material: ambxMat._id, percentage: sizeRule.ambx });
        }

        // Ensure total 100%
        const total = oilComps.reduce((sum, c) => sum + c.percentage, 0);
        if (Math.abs(total - 100) > 0.01) {
          const diff = 100 - total;
          oilComps[0].percentage += diff;
          oilComps[0].percentage = parseFloat(oilComps[0].percentage.toFixed(2));
        }

        const current = product.blendComponents || [];
        const isCorrect = current.length === oilComps.length &&
          current.every((c, i) => {
            const matId = c.material?._id?.toString() || c.material?.toString();
            const newMatId = oilComps[i].material?.toString();
            return matId === newMatId && Math.abs(c.percentage - oilComps[i].percentage) < 0.01;
          });

        if (!isCorrect) {
          product.blendComponents = oilComps.map(c => ({
            material: c.material,
            percentage: c.percentage,
          }));
          product.baseOil = null;
          await product.save();
          updated++;
          console.log(`✅ Spray ${product.name} (${product.sku}) → blend updated`);
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
    // ====== 1. Rebuild Raw Materials and Bottles from purchases and sales ======
    console.log('🔄 Rebuilding stock from purchases and sales...');

    // 1a. Aggregate purchases
    const purchases = await Purchase.find().lean();
    const purchaseQty = {};
    const purchaseCost = {};

    for (const purchase of purchases) {
      for (const item of purchase.items) {
        const entityId = item.item.toString();
        const qty = item.quantity;
        const totalCost = item.totalCost;
        if (!purchaseQty[entityId]) purchaseQty[entityId] = 0;
        purchaseQty[entityId] += qty;
        if (!purchaseCost[entityId]) purchaseCost[entityId] = { totalCost: 0, totalQty: 0 };
        purchaseCost[entityId].totalCost += totalCost;
        purchaseCost[entityId].totalQty += qty;
      }
    }

    // 1b. Aggregate consumption from sales
    const sales = await Sale.find().populate('items.product');
    const rawConsumption = {};
    const bottleConsumption = {};
    const products = await Product.find();
    const productMap = {};
    products.forEach(p => productMap[p._id.toString()] = p);

    const materials = await RawMaterial.find();
    const materialNameMap = {};
    materials.forEach(m => materialNameMap[m.name.toLowerCase()] = m._id.toString());

    for (const sale of sales) {
      if (!sale.items) continue;
      for (const item of sale.items) {
        const productId = item.product?._id?.toString() || item.product?.toString();
        if (!productId) continue;
        const product = productMap[productId];
        if (!product) continue;

        const sizeMl = item.sizeMl || 0;
        const qty = item.quantity || 0;

        // Bottle consumption
        const sizeVariant = product.sizes.find(s => s.sizeMl === sizeMl);
        if (sizeVariant && sizeVariant.bottle) {
          const bottleId = sizeVariant.bottle.toString();
          if (!bottleConsumption[bottleId]) bottleConsumption[bottleId] = 0;
          bottleConsumption[bottleId] += qty;
        }

        // Raw material consumption
        if (product.type === 'roll-on') {
          if (product.baseOil) {
            const oilId = product.baseOil.toString();
            const oilMlUsed = sizeVariant?.oilMlUsed || sizeMl;
            const totalMl = oilMlUsed * qty;
            if (!rawConsumption[oilId]) rawConsumption[oilId] = 0;
            rawConsumption[oilId] += totalMl;
          }
        } else if (product.type === 'spray') {
          const comps = parseBlendComponents(product);
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

    // 1c. Update Raw Materials
    const allMaterials = await RawMaterial.find();
    for (const mat of allMaterials) {
      const id = mat._id.toString();
      const purchased = purchaseQty[id] || 0;
      const consumed = rawConsumption[id] || 0;
      let netStock = purchased - consumed;
      if (netStock < 0) netStock = 0;

      const costData = purchaseCost[id];
      let avgCost = 0;
      if (costData && costData.totalQty > 0) {
        avgCost = costData.totalCost / costData.totalQty;
      }

      if (mat.currentStockMl !== netStock || mat.avgCostPerMl !== avgCost) {
        mat.currentStockMl = netStock;
        mat.avgCostPerMl = avgCost;
        await mat.save();
      }
    }

    // 1d. Update Bottles
    const allBottles = await Bottle.find();
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

      if (bottle.currentStock !== netStock || bottle.avgCostPerUnit !== avgCost) {
        bottle.currentStock = netStock;
        bottle.avgCostPerUnit = avgCost;
        bottle.totalPurchased = purchased;
        await bottle.save();
      }
    }

    console.log('✅ Stock rebuilt successfully.');

    // ====== 2. Apply exact product blends ======
    await applyExactBlends();

    // ====== 3. Return response ======
    res.json({
      message: 'Stock rebuilt and product blends updated successfully',
      updatedMaterials: allMaterials.filter(m => m.currentStockMl !== undefined).length,
      updatedBottles: allBottles.filter(b => b.currentStock !== undefined).length,
    });
  } catch (error) {
    console.error('Rebuild stock error:', error);
    res.status(500).json({ message: error.message });
  }
};