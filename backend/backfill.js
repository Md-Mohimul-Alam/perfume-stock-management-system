const mongoose = require('mongoose');
const Bottle = require('./src/models/Bottle');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mohimreza1234_db_user:0yEyB17V2u0fCQGB@cluster0.vk0e7ts.mongodb.net/LuxePerfume?retryWrites=true&w=majority&appName=Cluster0';

// Map of size (as number) + type to total purchased
const purchaseTotals = {
  '3-roll-on': 1,
  '3.5-roll-on': 373,
  '6-roll-on': 72,
  '15-roll-on': 0,
  '30-roll-on': 0,
  '6-spray': 87,
  '15-spray': 21,
  '30-spray': 13,
  '50-spray': 3,
  '100-spray': 1,
};

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Fetch all bottles
    const bottles = await Bottle.find();
    console.log(`📦 Found ${bottles.length} bottle types in database.`);

    let updated = 0;
    for (const bottle of bottles) {
      const size = bottle.sizeMl; // number
      const type = bottle.type;   // string 'roll-on' or 'spray'
      // Build key matching map
      const key = `${size}-${type}`;
      const total = purchaseTotals[key];
      if (total !== undefined) {
        if (bottle.totalPurchased !== total) {
          bottle.totalPurchased = total;
          await bottle.save();
          updated++;
          console.log(`✅ ${size}ml ${type}: totalPurchased = ${total}`);
        } else {
          console.log(`ℹ️ ${size}ml ${type}: already ${total}`);
        }
      } else {
        console.log(`⚠️ No purchase total for ${size}ml ${type}`);
      }
    }

    console.log(`✅ Update complete. Updated ${updated} bottles.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });