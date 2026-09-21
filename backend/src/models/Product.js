const mongoose = require('mongoose');

// For sprays: defines blend percentages
const blendComponentSchema = mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
  percentage: { type: Number, required: true, min: 0, max: 100 },
});

// Each product can be sold in different sizes
const sizeVariantSchema = mongoose.Schema({
  sizeMl: { type: Number, required: true },
  bottle: { type: mongoose.Schema.Types.ObjectId, ref: 'Bottle', required: true },
  oilMlUsed: { type: Number, required: true },
  ethanolMlUsed: { type: Number, default: 0 },
  fixativeMlUsed: { type: Number, default: 0 },
  makingCost: { type: Number, default: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  image: { type: String, default: '' },

  // ✅ NEW: per-size blend. If present, overrides product.blendComponents.
  blendComponents: [blendComponentSchema],
});

const productSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    type: { type: String, enum: ['roll-on', 'spray'], required: true },
    baseOil: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },

    // Legacy fallback – still used if no per-size blend exists
    blendComponents: [blendComponentSchema],

    sizes: [sizeVariantSchema],
    isActive: { type: Boolean, default: true },

    showOnClient: { type: Boolean, default: false },
    isStockOut: { type: Boolean, default: false },

    description: { type: String, default: '' },
    intensity: { type: String, enum: ['light', 'medium', 'strong'], default: 'medium' },
    bestFor: { type: [String], default: ['all'] },
    notes: { type: [String], default: [] },
    isBestseller: { type: Boolean, default: false },
    images: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Pre-save hook — computes oilMlUsed etc. per size, using per-size blend if present, else product blend
productSchema.pre('save', async function () {
  if (!this.sizes || this.sizes.length === 0) return;

  if (this.type === 'spray') {
    // Collect all material IDs across all size blends + product fallback
    const materialIds = new Set();
    for (const size of this.sizes) {
      const comps = (size.blendComponents && size.blendComponents.length > 0)
        ? size.blendComponents
        : (this.blendComponents || []);
      comps.forEach(c => c.material && materialIds.add(c.material.toString()));
    }
    if (materialIds.size === 0) return;

    const materials = await mongoose.model('RawMaterial').find({ _id: { $in: [...materialIds] } });
    const materialMap = {};
    materials.forEach(m => { materialMap[m._id.toString()] = m; });

    for (const size of this.sizes) {
      const comps = (size.blendComponents && size.blendComponents.length > 0)
        ? size.blendComponents
        : (this.blendComponents || []);

      let oilMl = 0, ethanolMl = 0, fixativeMl = 0;
      for (const comp of comps) {
        const material = materialMap[comp.material.toString()];
        if (!material) {
          throw new Error(`Material ${comp.material} not found for blend component`);
        }
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
    for (const size of this.sizes) {
      size.oilMlUsed = size.sizeMl;
      size.ethanolMlUsed = 0;
      size.fixativeMlUsed = 0;
    }
  } else {
    for (const size of this.sizes) {
      size.oilMlUsed = 0;
      size.ethanolMlUsed = 0;
      size.fixativeMlUsed = 0;
    }
  }
});

// Method to calculate making cost — per-size blend aware
productSchema.methods.calculateMakingCost = async function (sizeIndex) {
  const size = this.sizes[sizeIndex];
  const bottle = await mongoose.model('Bottle').findById(size.bottle);
  if (!bottle) throw new Error('Bottle not found');

  let materialCost = 0;
  if (this.type === 'roll-on' && this.baseOil) {
    const oil = await mongoose.model('RawMaterial').findById(this.baseOil);
    materialCost = oil.avgCostPerMl * size.oilMlUsed;
  } else {
    const comps = (size.blendComponents && size.blendComponents.length > 0)
      ? size.blendComponents
      : (this.blendComponents || []);

    for (const comp of comps) {
      const material = await mongoose.model('RawMaterial').findById(comp.material);
      if (!material) continue;
      const mlUsed = (size.sizeMl * comp.percentage) / 100;
      materialCost += material.avgCostPerMl * mlUsed;
    }
  }

  const overhead = 85;
  size.makingCost = materialCost + bottle.avgCostPerUnit + overhead;
  return size.makingCost;
};

module.exports = mongoose.model('Product', productSchema);