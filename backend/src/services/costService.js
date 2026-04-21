const Bottle = require('../models/Bottle');
const RawMaterial = require('../models/RawMaterial');

exports.calculateMakingCost = async (product, size) => {
  let oilCost = 0, ethanolCost = 0, fixativeCost = 0;

  if (product.type === 'roll-on') {
    const oil = await RawMaterial.findById(product.baseOil);
    oilCost = oil.avgCostPerMl * size.oilMlUsed;
  } else {
    for (const comp of product.blendComponents) {
      const material = await RawMaterial.findById(comp.material);
      const mlUsed = (size.sizeMl * comp.percentage) / 100;
      if (material.type === 'oil') oilCost += material.avgCostPerMl * mlUsed;
      else if (material.type === 'ethanol') ethanolCost += material.avgCostPerMl * mlUsed;
      else if (material.type === 'fixative') fixativeCost += material.avgCostPerMl * mlUsed;
    }
  }

  const bottle = await Bottle.findById(size.bottle);
  const bottleCost = bottle.avgCostPerUnit;
  const overhead = 85;

  return oilCost + ethanolCost + fixativeCost + bottleCost + overhead;
};