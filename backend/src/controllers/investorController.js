
const mongoose = require('mongoose');

const Investor = require('../models/Investor');
const Transaction = require('../models/Transaction');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Purchase = require('../models/Purchase');

/* ========================================
   HELPERS
======================================== */

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const validateObjectId = (value, label = 'ID') => {
  if (!mongoose.isValidObjectId(value)) {
    throw createError(`Invalid ${label}`);
  }

  return value;
};

const validateContributionType = (type) => {
  if (!['investment', 'withdrawal'].includes(type)) {
    throw createError(
      'Contribution type must be investment or withdrawal'
    );
  }

  return type;
};

const parseContributionDate = (value, fallback = new Date()) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError('Invalid contribution date');
  }

  return date;
};

// Calculate net contribution directly from contribution records.
const getNetContribution = (investor) => {
  return (investor.contributions || []).reduce(
    (total, contribution) => {
      const amount = toNumber(contribution.amount);

      return total + (
        contribution.type === 'investment'
          ? amount
          : -amount
      );
    },
    0
  );
};

const getContributionTransactionDetails = (contribution) => {
  const isInvestment = contribution.type === 'investment';

  return {
    type: isInvestment ? 'cash_in' : 'cash_out',
    category: isInvestment ? 'Investment' : 'Withdrawal',
  };
};

// Create a transaction linked to its exact contribution.
const createContributionTransaction = async ({
  investor,
  contribution,
  session,
}) => {
  const { type, category } =
    getContributionTransactionDetails(contribution);

  await Transaction.create(
    [
      {
        type,
        amount: contribution.amount,
        category,
        reference: investor._id,
        contributionId: contribution._id,
        refModel: 'Investor',
        date: contribution.date,
        description: `${contribution.type} - ${investor.name} - ${
          contribution.notes || ''
        }`,
      },
    ],
    { session }
  );
};

// Delete the transaction for one contribution.
// Supports older transactions that do not have contributionId.
const deleteContributionTransaction = async ({
  investor,
  contribution,
  session,
}) => {
  const { category } =
    getContributionTransactionDetails(contribution);

  // New transactions: exact contribution ID.
  const linkedTransaction = await Transaction.findOneAndDelete(
    {
      reference: investor._id,
      refModel: 'Investor',
      contributionId: contribution._id,
    },
    { session }
  );

  if (linkedTransaction) {
    return;
  }

  // Legacy transaction fallback: delete only one matching record.
  const startDate = new Date(contribution.date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(contribution.date);
  endDate.setHours(23, 59, 59, 999);

  await Transaction.findOneAndDelete(
    {
      reference: investor._id,
      refModel: 'Investor',
      category,
      amount: contribution.amount,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    },
    { session }
  );
};

const sendError = (res, error) => {
  console.error('Investor controller error:', error);

  if (error.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid ID',
    });
  }

  return res.status(error.statusCode || 500).json({
    message: error.message || 'Investor operation failed',
  });
};

/* ========================================
   GET INVESTORS
======================================== */

exports.getInvestors = async (req, res) => {
  try {
    const investors = await Investor.find().sort({
      createdAt: 1,
    });

    return res.json(investors);
  } catch (error) {
    return sendError(res, error);
  }
};

/* ========================================
   CREATE INVESTOR
======================================== */

exports.createInvestor = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { name, initialInvestment } = req.body;

    const cleanName = String(name || '').trim();

    if (!cleanName) {
      throw createError('Investor name is required');
    }

    const initialAmount =
      initialInvestment === undefined ||
      initialInvestment === null ||
      initialInvestment === ''
        ? 0
        : Number(initialInvestment);

    if (
      !Number.isFinite(initialAmount) ||
      initialAmount < 0
    ) {
      throw createError(
        'Initial investment must be a valid non-negative amount'
      );
    }

    const [investor] = await Investor.create(
      [
        {
          name: cleanName,
        },
      ],
      { session }
    );

    if (initialAmount > 0) {
      investor.contributions.push({
        amount: initialAmount,
        type: 'investment',
        date: new Date(),
        notes: 'Initial investment',
      });

      await investor.save({ session });

      const contribution =
        investor.contributions[
          investor.contributions.length - 1
        ];

      await createContributionTransaction({
        investor,
        contribution,
        session,
      });
    }

    await session.commitTransaction();

    return res.status(201).json(investor);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return sendError(res, error);
  } finally {
    await session.endSession();
  }
};

/* ========================================
   ADD CONTRIBUTION
======================================== */

exports.addContribution = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    validateObjectId(req.params.id, 'investor ID');

    const investor = await Investor.findById(
      req.params.id
    ).session(session);

    if (!investor) {
      throw createError('Investor not found', 404);
    }

    const { amount, type, date, notes } = req.body;

    const cleanAmount = Number(amount);

    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      throw createError('Amount must be greater than 0');
    }

    const cleanType = validateContributionType(type);
    const cleanDate = parseContributionDate(date);

    investor.contributions.push({
      amount: cleanAmount,
      type: cleanType,
      date: cleanDate,
      notes: String(notes || '').trim(),
    });

    await investor.save({ session });

    const contribution =
      investor.contributions[
        investor.contributions.length - 1
      ];

    await createContributionTransaction({
      investor,
      contribution,
      session,
    });

    await session.commitTransaction();

    return res.json(investor);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return sendError(res, error);
  } finally {
    await session.endSession();
  }
};

/* ========================================
   UPDATE CONTRIBUTION
======================================== */

exports.updateContribution = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    validateObjectId(req.params.id, 'investor ID');
    validateObjectId(
      req.params.contributionId,
      'contribution ID'
    );

    const investor = await Investor.findById(
      req.params.id
    ).session(session);

    if (!investor) {
      throw createError('Investor not found', 404);
    }

    const contribution = investor.contributions.id(
      req.params.contributionId
    );

    if (!contribution) {
      throw createError('Contribution not found', 404);
    }

    // Remove the old transaction before modifying the contribution.
    await deleteContributionTransaction({
      investor,
      contribution,
      session,
    });

    const { amount, type, date, notes } = req.body;

    if (amount !== undefined) {
      const cleanAmount = Number(amount);

      if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
        throw createError('Amount must be greater than 0');
      }

      contribution.amount = cleanAmount;
    }

    if (type !== undefined) {
      contribution.type = validateContributionType(type);
    }

    if (date !== undefined) {
      contribution.date = parseContributionDate(date);
    }

    if (notes !== undefined) {
      contribution.notes = String(notes || '').trim();
    }

    await investor.save({ session });

    // Create the updated transaction with the same contribution ID.
    await createContributionTransaction({
      investor,
      contribution,
      session,
    });

    await session.commitTransaction();

    return res.json(investor);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return sendError(res, error);
  } finally {
    await session.endSession();
  }
};

/* ========================================
   DELETE CONTRIBUTION
======================================== */

exports.deleteContribution = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    validateObjectId(req.params.id, 'investor ID');
    validateObjectId(
      req.params.contributionId,
      'contribution ID'
    );

    const investor = await Investor.findById(
      req.params.id
    ).session(session);

    if (!investor) {
      throw createError('Investor not found', 404);
    }

    const contribution = investor.contributions.id(
      req.params.contributionId
    );

    if (!contribution) {
      throw createError('Contribution not found', 404);
    }

    await deleteContributionTransaction({
      investor,
      contribution,
      session,
    });

    contribution.deleteOne();

    await investor.save({ session });

    await session.commitTransaction();

    return res.json(investor);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return sendError(res, error);
  } finally {
    await session.endSession();
  }
};

/* ========================================
   GET SHARES
======================================== */

exports.getShares = async (req, res) => {
  try {
    const investors = await Investor.find();

    const totalNet = investors.reduce(
      (sum, investor) =>
        sum + getNetContribution(investor),
      0
    );

    const shares = investors.map((investor) => {
      const netContribution =
        getNetContribution(investor);

      return {
        _id: investor._id,
        name: investor.name,
        netContribution,
        sharePercentage:
          totalNet > 0
            ? (netContribution / totalNet) * 100
            : 0,
      };
    });

    return res.json(shares);
  } catch (error) {
    return sendError(res, error);
  }
};

/* ========================================
   DELETE / CLOSE INVESTOR
======================================== */

exports.deleteInvestor = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    validateObjectId(req.params.id, 'investor ID');

    const investor = await Investor.findById(
      req.params.id
    ).session(session);

    if (!investor) {
      throw createError('Investor not found', 404);
    }

    // Calculate this investor's net contribution.
    const investorNetContribution =
      getNetContribution(investor);

    // Get all investors.
    const allInvestors = await Investor.find({}).session(session);

    // Calculate total net contributions.
    const totalNetContributions = allInvestors.reduce(
      (total, item) =>
        total + getNetContribution(item),
      0
    );

    // Calculate ownership percentage.
    const share =
      totalNetContributions > 0
        ? (
            investorNetContribution /
            totalNetContributions
          ) * 100
        : 0;

    const [
      allSales,
      allExpenses,
      allPurchases,
      allSettlements,
    ] = await Promise.all([
      Sale.find({}).session(session),
      Expense.find({}).session(session),
      Purchase.find({}).session(session),
      Transaction.find({
        type: 'cash_out',
        category: 'Investor Settlement',
      }).session(session),
    ]);

    // Calculate recorded sales revenue.
    const totalRevenue = allSales.reduce(
      (total, sale) =>
        total + toNumber(sale.totalAmount),
      0
    );

    // Existing sale logic: exclude sales marked as due.
    const dueAmount = allSales.reduce(
      (total, sale) =>
        sale.paymentStatus === 'due'
          ? total + toNumber(sale.totalAmount)
          : total,
      0
    );

    const paidRevenue = totalRevenue - dueAmount;

    // Calculate expenses.
    const totalExpenses = allExpenses.reduce(
      (total, expense) =>
        total + toNumber(expense.amount),
      0
    );

    /*
      IMPORTANT:
      The current Purchase model does not contain payment tracking.
      Therefore, this calculation deducts the full purchase amount.
      This must be updated when supplier-credit tracking is implemented.
    */
    const totalPurchases = allPurchases.reduce(
      (total, purchase) =>
        total + toNumber(purchase.totalAmount),
      0
    );

    // Calculate other investors' net contributions.
    const investorNetOther = allInvestors.reduce(
      (total, item) => {
        if (
          item._id.toString() === investor._id.toString()
        ) {
          return total;
        }

        return total + getNetContribution(item);
      },
      0
    );

    // Calculate previous investor settlements.
    const totalSettlements = allSettlements.reduce(
      (total, settlement) =>
        total + toNumber(settlement.amount),
      0
    );

    // Calculate available cash.
    const availableCash =
      paidRevenue -
      totalExpenses -
      totalPurchases +
      investorNetOther -
      totalSettlements;

    // Calculate profit share.
    const profitShare =
      (share / 100) * availableCash;

    // Calculate final settlement.
    const settlementAmount =
      investorNetContribution + profitShare;

    if (
      !Number.isFinite(settlementAmount) ||
      settlementAmount < 0
    ) {
      throw createError(
        'Settlement amount cannot be negative. Please review the accounts before closing this investor.'
      );
    }

    // Record settlement only when the amount is positive.
    if (settlementAmount > 0) {
      await Transaction.create(
        [
          {
            type: 'cash_out',
            amount: settlementAmount,
            category: 'Investor Settlement',
            reference: investor._id,
            refModel: 'Investor',
            date: new Date(),
            description: `Settlement for ${investor.name}`,
          },
        ],
        { session }
      );
    }

    // Remove ordinary contribution transactions.
    await Transaction.deleteMany(
      {
        reference: investor._id,
        refModel: 'Investor',
        category: {
          $in: ['Investment', 'Withdrawal'],
        },
      },
      { session }
    );

    // Delete investor in the same database transaction.
    await Investor.deleteOne(
      { _id: investor._id },
      { session }
    );

    await session.commitTransaction();

    return res.json({
      message: 'Investor settled and removed',
      amount: settlementAmount,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return sendError(res, error);
  } finally {
    await session.endSession();
  }
};

/* ========================================
   GET SETTLEMENTS
======================================== */

exports.getSettlements = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      type: 'cash_out',
      category: 'Investor Settlement',
    });

    const total = transactions.reduce(
      (sum, transaction) =>
        sum + toNumber(transaction.amount),
      0
    );

    return res.json({
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
