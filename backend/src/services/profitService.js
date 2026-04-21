const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Purchase = require('../models/Purchase');
const Investor = require('../models/Investor');

exports.calculateProfit = async (startDate, endDate) => {
  const sales = await Sale.find({
    saleDate: { $gte: startDate, $lte: endDate },
    paymentStatus: 'paid',
  });
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);

  const purchases = await Purchase.find({
    purchaseDate: { $gte: startDate, $lte: endDate },
  });
  const totalPurchaseCost = purchases.reduce((sum, p) => sum + p.totalAmount, 0);

  const expenses = await Expense.find({
    date: { $gte: startDate, $lte: endDate },
  });
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const netProfit = totalRevenue - totalPurchaseCost - totalExpense;
  return { totalRevenue, totalPurchaseCost, totalExpense, netProfit };
};

exports.distributeProfit = async (netProfit) => {
  const investors = await Investor.find();
  const totalNet = investors.reduce((sum, inv) => sum + inv.netContribution, 0);
  return investors.map(inv => ({
    name: inv.name,
    sharePercentage: totalNet > 0 ? (inv.netContribution / totalNet) * 100 : 0,
    amount: totalNet > 0 ? (inv.netContribution / totalNet) * netProfit : 0,
  }));
};