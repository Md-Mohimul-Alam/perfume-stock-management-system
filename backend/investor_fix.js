// scripts/fixInvestorWithdrawals.js
const mongoose = require('mongoose');
const Investor = require('./src/models/Investor');
const Transaction = require('./src/models/Transaction');
require('dotenv').config();

async function fixWithdrawals() {
  await mongoose.connect(process.env.MONGO_URI);

  // Find the investors
  const mohim = await Investor.findOne({ name: /Mohim/i });
  const rafin = await Investor.findOne({ name: /Rafin/i });
  const mahir = await Investor.findOne({ name: /Mahir/i });

  const withdrawals = [
    { investor: mohim, amount: 3915, date: new Date('2026-08-01'), notes: 'Invested amount return' },
    { investor: rafin, amount: 1500, date: new Date('2026-08-01'), notes: 'Invested amount return' },
    { investor: mahir, amount: 1000, date: new Date('2026-08-20'), notes: 'Invested amount return' },
  ];

  for (const w of withdrawals) {
    if (!w.investor) continue;
    // Check if withdrawal already exists
    const exists = w.investor.contributions.some(c =>
      c.type === 'withdrawal' &&
      Math.abs(c.amount - w.amount) < 0.01 &&
      c.notes === w.notes
    );
    if (!exists) {
      w.investor.contributions.push({
        amount: w.amount,
        type: 'withdrawal',
        date: w.date,
        notes: w.notes,
      });
      await w.investor.save();
      console.log(`✅ Added withdrawal for ${w.investor.name}: ৳${w.amount}`);
    } else {
      console.log(`ℹ️ Withdrawal for ${w.investor.name} already exists`);
    }
  }

  mongoose.disconnect();
  console.log('🔌 Disconnected');
}

fixWithdrawals().catch(console.error);