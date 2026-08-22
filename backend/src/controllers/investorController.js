const Investor = require('../models/Investor');
const Transaction = require('../models/Transaction');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Purchase = require('../models/Purchase');

// @desc    Get all investors
// @route   GET /api/investors
exports.getInvestors = async (req, res) => {
  try {
    const investors = await Investor.find();
    res.json(investors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add new investor
// @route   POST /api/investors
exports.createInvestor = async (req, res) => {
  try {
    const { name, initialInvestment } = req.body;
    const investor = await Investor.create({ name });
    if (initialInvestment && initialInvestment > 0) {
      investor.contributions.push({
        amount: initialInvestment,
        type: 'investment',
        date: new Date(),
        notes: 'Initial investment',
      });
      await investor.save();

      await Transaction.create({
        type: 'cash_in',
        amount: initialInvestment,
        category: 'Investment',
        reference: investor._id,
        refModel: 'Investor',
        description: `Investment from ${name}`,
      });
    }
    res.status(201).json(investor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add contribution (investment or withdrawal)
// @route   POST /api/investors/:id/contribute
exports.addContribution = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id);
    if (!investor) return res.status(404).json({ message: 'Investor not found' });

    const { amount, type, date, notes } = req.body;
    investor.contributions.push({ amount, type, date: date || new Date(), notes });
    await investor.save();

    const transactionType = type === 'investment' ? 'cash_in' : 'cash_out';
    await Transaction.create({
      type: transactionType,
      amount,
      category: type === 'investment' ? 'Investment' : 'Withdrawal',
      reference: investor._id,
      refModel: 'Investor',
      description: `${type} - ${investor.name} - ${notes || ''}`,
    });

    res.json(investor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current share percentages
// @route   GET /api/investors/shares
exports.getShares = async (req, res) => {
  try {
    const investors = await Investor.find();
    const totalNet = investors.reduce((sum, inv) => sum + inv.netContribution, 0);
    const shares = investors.map(inv => ({
      _id: inv._id,
      name: inv.name,
      netContribution: inv.netContribution,
      sharePercentage: totalNet > 0 ? (inv.netContribution / totalNet) * 100 : 0,
    }));
    res.json(shares);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete/close an investor (creates settlement transaction)
// @route   DELETE /api/investors/:id
exports.deleteInvestor = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id);
    if (!investor) return res.status(404).json({ message: 'Investor not found' });

    // Compute total invested by this investor
    const totalInvested = investor.contributions
      .filter(c => c.type === 'investment')
      .reduce((sum, c) => sum + c.amount, 0);

    // Compute total invested across all investors
    const allInvestors = await Investor.find({});
    let totalAllInvested = 0;
    allInvestors.forEach(inv => {
      inv.contributions.forEach(c => {
        if (c.type === 'investment') totalAllInvested += c.amount;
      });
    });
    const share = totalAllInvested > 0 ? (totalInvested / totalAllInvested) * 100 : 0;

    // --- Compute cash available before settling this investor ---
    const [allSales, allExpenses, allPurchases, allSettlements] = await Promise.all([
      Sale.find(),
      Expense.find(),
      Purchase.find(),
      Transaction.find({ type: 'cash_out', category: 'Investor Settlement' }),
    ]);

    let totalRevenue = 0;
    let dueAmount = 0;
    allSales.forEach(s => {
      const amt = s.totalAmount || 0;
      totalRevenue += amt;
      if (s.paymentStatus === 'due') dueAmount += amt;
    });
    const paidRevenue = totalRevenue - dueAmount;
    const totalExpenses = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalPurchases = allPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    // Investor net (excluding this investor)
    let totalInvestedOther = 0;
    let totalWithdrawnOther = 0;
    allInvestors.forEach(inv => {
      if (inv._id.toString() === investor._id.toString()) return;
      inv.contributions.forEach(c => {
        if (c.type === 'investment') totalInvestedOther += c.amount;
        else totalWithdrawnOther += c.amount;
      });
    });
    const investorNetOther = totalInvestedOther - totalWithdrawnOther;

    // Total settlements (excluding the one we are about to create)
    const totalSettlements = allSettlements.reduce((sum, t) => sum + t.amount, 0);

    const availableCash = (paidRevenue - totalExpenses - totalPurchases) + investorNetOther - totalSettlements;

    // Profit share for this investor
    const profitShare = (share / 100) * availableCash;
    const settlementAmount = totalInvested + profitShare;

    // Record withdrawal contribution for settlement
    investor.contributions.push({
      amount: settlementAmount,
      type: 'withdrawal',
      date: new Date(),
      notes: `Settlement - investor closed`,
    });
    await investor.save();

    // Create settlement transaction
    await Transaction.create({
      type: 'cash_out',
      amount: settlementAmount,
      category: 'Investor Settlement',
      reference: investor._id,
      refModel: 'Investor',
      description: `Settlement for ${investor.name}`,
    });

    // Delete investor
    await investor.deleteOne();

    res.json({ message: 'Investor settled and removed', amount: settlementAmount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get total settlements (investor payouts)
// @route   GET /api/investors/settlements
exports.getSettlements = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      type: 'cash_out',
      category: 'Investor Settlement',
    });
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    res.json({ total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};