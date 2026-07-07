// download-products.js – Export all product data to CSV/JSON
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ---------- IMPORT MODELS ----------
const Product = require('./src/models/Product');
const RawMaterial = require('./src/models/RawMaterial'); // optional for populating names

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const format = args[0] || 'csv'; // 'csv' or 'json'
const outputDir = args[1] || './exports';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create timestamp for filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const baseFileName = `products_${timestamp}`;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Fetch all products (populate material references for readability)
    const products = await Product.find({})
      .populate('baseOil', 'name sku')
      .populate('blendComponents.material', 'name sku')
      .sort({ name: 1 });

    console.log(`📊 Found ${products.length} products.`);

    if (products.length === 0) {
      console.log('⚠️ No products found. Export cancelled.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Transform data for export
    const exportData = products.map(product => {
      // Build sizes array with bottle info (if available)
      const sizes = (product.sizes || []).map(size => ({
        sizeMl: size.sizeMl,
        bottleType: size.bottle?.type || '',
        sellingPrice: size.sellingPrice || 0,
        oilMlUsed: size.oilMlUsed || 0,
        ethanolMlUsed: size.ethanolMlUsed || 0,
        fixativeMlUsed: size.fixativeMlUsed || 0,
        makingCost: size.makingCost || 0,
        bottleId: size.bottle?._id || '',
      }));

      // Get base oil name (if roll-on)
      const baseOilName = product.baseOil ? product.baseOil.name : '';

      // Get blend component names (for spray)
      const blendComponents = (product.blendComponents || []).map(comp => ({
        materialName: comp.material ? comp.material.name : 'Unknown',
        percentage: comp.percentage || 0,
      }));

      return {
        _id: product._id.toString(),
        name: product.name,
        sku: product.sku,
        type: product.type, // 'roll-on' or 'spray'
        description: product.description || '',
        intensity: product.intensity || 'medium',
        bestFor: (product.bestFor || []).join(', '),
        notes: (product.notes || []).join(', '),
        isBestseller: product.isBestseller || false,
        isActive: product.isActive !== false,
        createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : '',
        updatedAt: product.updatedAt ? new Date(product.updatedAt).toISOString() : '',
        // Roll‑on specific
        baseOil: baseOilName,
        // Spray specific
        blendComponents: blendComponents.map(c => `${c.materialName} (${c.percentage}%)`).join('; '),
        // Sizes (as JSON string for CSV)
        sizes: sizes,
        // Price range (min/max selling price)
        minPrice: sizes.length ? Math.min(...sizes.map(s => s.sellingPrice)) : 0,
        maxPrice: sizes.length ? Math.max(...sizes.map(s => s.sellingPrice)) : 0,
      };
    });

    // ----- Export as JSON (full data) -----
    const jsonFile = path.join(outputDir, `${baseFileName}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(exportData, null, 2));
    console.log(`✅ JSON exported: ${jsonFile}`);

    // ----- Export as CSV (flattened) -----
    if (format === 'csv') {
      // Flatten data for CSV – keep sizes as JSON string, blendComponents as string
      const flatData = exportData.map(row => ({
        name: row.name,
        sku: row.sku,
        type: row.type,
        description: row.description,
        intensity: row.intensity,
        bestFor: row.bestFor,
        notes: row.notes,
        isBestseller: row.isBestseller,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        baseOil: row.baseOil,
        blendComponents: row.blendComponents,
        minPrice: row.minPrice,
        maxPrice: row.maxPrice,
        sizes: JSON.stringify(row.sizes), // Keep as JSON for CSV
      }));

      if (flatData.length === 0) {
        console.log('⚠️ No data to export as CSV');
      } else {
        const csvHeaders = Object.keys(flatData[0]);
        const csvRows = [];
        csvRows.push(csvHeaders.join(','));

        for (const row of flatData) {
          const values = csvHeaders.map(header => {
            let val = row[header];
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
              val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          });
          csvRows.push(values.join(','));
        }

        const csvFile = path.join(outputDir, `${baseFileName}.csv`);
        fs.writeFileSync(csvFile, csvRows.join('\n'));
        console.log(`✅ CSV exported: ${csvFile}`);
      }
    }

    // ----- Summary report -----
    const summaryFile = path.join(outputDir, `${baseFileName}_summary.json`);
    const summary = {
      totalProducts: products.length,
      byType: {
        rollOn: products.filter(p => p.type === 'roll-on').length,
        spray: products.filter(p => p.type === 'spray').length,
      },
      byIntensity: {},
      byBestseller: {
        true: products.filter(p => p.isBestseller).length,
        false: products.filter(p => !p.isBestseller).length,
      },
      byActive: {
        true: products.filter(p => p.isActive !== false).length,
        false: products.filter(p => p.isActive === false).length,
      },
      priceRange: {
        min: 0,
        max: 0,
      },
      hasImages: products.filter(p => p.images && p.images.length > 0).length,
    };

    // Intensity breakdown
    products.forEach(p => {
      const intensity = p.intensity || 'unknown';
      summary.byIntensity[intensity] = (summary.byIntensity[intensity] || 0) + 1;
    });

    // Overall price range across all sizes
    let allPrices = [];
    products.forEach(p => {
      (p.sizes || []).forEach(s => {
        if (s.sellingPrice) allPrices.push(s.sellingPrice);
      });
    });
    if (allPrices.length) {
      summary.priceRange.min = Math.min(...allPrices);
      summary.priceRange.max = Math.max(...allPrices);
    }

    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`✅ Summary exported: ${summaryFile}`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    console.log(`\n📁 All files saved in: ${outputDir}/`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });