const RawMaterial = require('../models/RawMaterial');
const Bottle = require('../models/Bottle');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Product = require('../models/Product');

// Helper to parse blend components (for spray products)
function parseBlendComponents(product) {
  const comps = product.blendComponents;
  if (!comps) return [];
  if (Array.isArray(comps)) {
    return comps.filter(c => c.material && c.percentage);
  }
  // If it's a string, try to parse it
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

// Main rebuild function
exports.rebuildStock = async (req, res) => {
  try {
    // 1. Fetch all purchases and group by item ID
    const purchases = await Purchase.find().lean();
    const purchaseQty = {};   // { entityId: totalQuantity }
    const purchaseCost = {};  // { entityId: { totalCost, totalQty } }

    for (const purchase of purchases) {
      for (const item of purchase.items) {
        const entityId = item.item.toString();
        const qty = item.quantity;
        const cost = item.costPerUnit;
        const totalCost = item.totalCost;
        if (!purchaseQty[entityId]) purchaseQty[entityId] = 0;
        purchaseQty[entityId] += qty;
        if (!purchaseCost[entityId]) purchaseCost[entityId] = { totalCost: 0, totalQty: 0 };
        purchaseCost[entityId].totalCost += totalCost;
        purchaseCost[entityId].totalQty += qty;
      }
    }

    // 2. Fetch all sales and compute consumption per raw material and bottle
    const sales = await Sale.find().populate('items.product');
    const rawConsumption = {}; // { materialId: totalMlUsed }
    const bottleConsumption = {}; // { bottleId: totalQuantity }

    // Build product map for quick lookup
    const products = await Product.find();
    const productMap = {};
    products.forEach(p => productMap[p._id.toString()] = p);

    // Build material name -> id map (for string blends)
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

    // 3. Update RawMaterials
    const allMaterials = await RawMaterial.find();
    let updatedMaterials = 0;
    for (const mat of allMaterials) {
      const id = mat._id.toString();
      const purchased = purchaseQty[id] || 0;
      const consumed = rawConsumption[id] || 0;
      let netStock = purchased - consumed;
      if (netStock < 0) netStock = 0; // cap at zero

      // Recalculate avg cost from purchases
      const costData = purchaseCost[id];
      let avgCost = 0;
      if (costData && costData.totalQty > 0) {
        avgCost = costData.totalCost / costData.totalQty;
      }

      if (mat.currentStockMl !== netStock || mat.avgCostPerMl !== avgCost) {
        mat.currentStockMl = netStock;
        mat.avgCostPerMl = avgCost;
        await mat.save();
        updatedMaterials++;
      }
    }

    // 4. Update Bottles
    const allBottles = await Bottle.find();
    let updatedBottles = 0;
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
        bottle.totalPurchased = purchased; // update from purchases
        await bottle.save();
        updatedBottles++;
      }
    }

    // 5. Return summary
    res.json({
      message: 'Stock rebuilt successfully',
      updatedMaterials,
      updatedBottles,
    });
  } catch (error) {
    console.error('Rebuild stock error:', error);
    res.status(500).json({ message: error.message });
  }
};