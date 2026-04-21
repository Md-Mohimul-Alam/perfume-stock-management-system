const Investor = require('../models/Investor');
const Transaction = require('../models/Transaction');

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
      name: inv.name,
      netContribution: inv.netContribution,
      sharePercentage: totalNet > 0 ? (inv.netContribution / totalNet) * 100 : 0,
    }));
    res.json(shares);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};