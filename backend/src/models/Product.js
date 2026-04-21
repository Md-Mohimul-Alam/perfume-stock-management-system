const mongoose = require('mongoose');

// For sprays: defines blend percentages
const blendComponentSchema = mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
  percentage: { type: Number, required: true, min: 0, max: 100 },
});

// Each product can be sold in different sizes
const sizeVariantSchema = mongoose.Schema({
  sizeMl: { type: Number, required: true }, // e.g., 6, 15, 30, 50, 100
  bottle: { type: mongoose.Schema.Types.ObjectId, ref: 'Bottle', required: true },
  // Material consumption (calculated from blend or fixed for roll-ons)
  oilMlUsed: { type: Number, required: true },
  ethanolMlUsed: { type: Number, default: 0 },
  fixativeMlUsed: { type: Number, default: 0 },
  makingCost: { type: Number, default: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
});

const productSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    type: { type: String, enum: ['roll-on', 'spray'], required: true },
    // For roll-ons: which oil is used
    baseOil: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
    // For sprays: blend percentages (e.g., 50% oil, 45% ethanol, 5% fixative)
    blendComponents: [blendComponentSchema],
    sizes: [sizeVariantSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Pre-save hook to auto-calculate material consumption for each size based on blend
productSchema.pre('save', async function (next) {
  if (this.type === 'spray' && this.blendComponents.length > 0) {
    // Fetch material details to know their types
    const materialIds = this.blendComponents.map(c => c.material);
    const materials = await mongoose.model('RawMaterial').find({ _id: { $in: materialIds } });
    const materialMap = {};
    materials.forEach(m => { materialMap[m._id.toString()] = m; });

    for (const size of this.sizes) {
      let oilMl = 0, ethanolMl = 0, fixativeMl = 0;
      for (const comp of this.blendComponents) {
        const material = materialMap[comp.material.toString()];
        const mlForThisComp = (size.sizeMl * comp.percentage) / 100;
        if (material.type === 'oil') oilMl += mlForThisComp;
        else if (material.type === 'ethanol') ethanolMl += mlForThisComp;
        else if (material.type === 'fixative') fixativeMl += mlForThisComp;
      }
      size.oilMlUsed = oilMl;
      size.ethanolMlUsed = ethanolMl;
      size.fixativeMlUsed = fixativeMl;
    }
  } else if (this.type === 'roll-on' && this.baseOil) {
    // Roll-on: 100% oil
    for (const size of this.sizes) {
      size.oilMlUsed = size.sizeMl;
      size.ethanolMlUsed = 0;
      size.fixativeMlUsed = 0;
    }
  }
  next();
});

// Method to calculate making cost for a specific size (requires material and bottle costs)
productSchema.methods.calculateMakingCost = async function (sizeIndex) {
  const size = this.sizes[sizeIndex];
  const bottle = await mongoose.model('Bottle').findById(size.bottle);
  if (!bottle) throw new Error('Bottle not found');

  let materialCost = 0;
  if (this.type === 'roll-on' && this.baseOil) {
    const oil = await mongoose.model('RawMaterial').findById(this.baseOil);
    materialCost = oil.avgCostPerMl * size.oilMlUsed;
  } else {
    for (const comp of this.blendComponents) {
      const material = await mongoose.model('RawMaterial').findById(comp.material);
      const mlUsed = (size.sizeMl * comp.percentage) / 100;
      materialCost += material.avgCostPerMl * mlUsed;
    }
  }

  const overhead = 85; // rent + other fixed cost per unit (configurable)
  size.makingCost = materialCost + bottle.avgCostPerUnit + overhead;
  return size.makingCost;
};

module.exports = mongoose.model('Product', productSchema);