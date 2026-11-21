
const mongoose = require('mongoose');

const Investor = require('../models/Investor');
const Transaction = require('../models/Transaction');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');

/* ========================================
   HELPERS
======================================== */

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

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

const assertNonNegativeNetContribution = (investor) => {
  const netContribution = roundMoney(
    getNetContribution(investor)
  );

  if (netContribution < -0.001) {
    throw createError(
      `This operation would make ${investor.name}'s net contribution negative. Withdrawals cannot exceed the remaining contribution.`
    );
  }

  return netContribution;
};

const getContributionTransactionDetails = (contribution) => {
  const isInvestment = contribution.type === 'investment';

  return {
    type: isInvestment ? 'cash_in' : 'cash_out',
    category: isInvestment ? 'Investment' : 'Withdrawal',
  };
};

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
        }`.trim(),
      },
    ],
    { session }
  );
};

const deleteContributionTransaction = async ({
  investor,
  contribution,
  session,
}) => {
  const { category } =
    getContributionTransactionDetails(contribution);

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

  // Compatibility with older transactions that do not have contributionId.
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

/*
  Cash position is calculated from the actual transaction ledger.

  This includes:
  - Paid sales
  - Actual supplier payments
  - Regular expenses
  - Investor investments
  - Investor withdrawals
  - Previous investor settlements

  Wastage is excluded from cash out because writing off inventory
  does not mean that cash was paid at the time of wastage.
*/
const getCashPosition = async (session = null) => {
  let wastageQuery = Expense.find({
    category: 'Wastage',
  }).select('_id');

  if (session) {
    wastageQuery = wastageQuery.session(session);
  }

  const wastageExpenses = await wastageQuery;
  const wastageExpenseIds = wastageExpenses.map(
    (expense) => expense._id
  );

  const pipeline = [
    {
      $match: {
        $or: [
          { refModel: { $ne: 'Expense' } },
          { reference: { $nin: wastageExpenseIds } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        totalCashIn: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'cash_in'] },
              '$amount',
              0,
            ],
          },
        },
        totalCashOut: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'cash_out'] },
              '$amount',
              0,
            ],
          },
        },
      },
    },
  ];

  let aggregate = Transaction.aggregate(pipeline);

  if (session) {
    aggregate = aggregate.session(session);
  }

  const [result] = await aggregate;

  const totalCashIn = roundMoney(
    toNumber(result?.totalCashIn)
  );

  const totalCashOut = roundMoney(
    toNumber(result?.totalCashOut)
  );

  return {
    totalCashIn,
    totalCashOut,
    availableCash: roundMoney(totalCashIn - totalCashOut),
  };
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
    let createdInvestor;

    await session.withTransaction(async () => {
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
          amount: roundMoney(initialAmount),
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

      createdInvestor = investor;
    });

    return res.status(201).json(createdInvestor);
  } catch (error) {
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
    let updatedInvestor;

    await session.withTransaction(async () => {
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
        amount: roundMoney(cleanAmount),
        type: cleanType,
        date: cleanDate,
        notes: String(notes || '').trim(),
      });

      assertNonNegativeNetContribution(investor);

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

      updatedInvestor = investor;
    });

    return res.json(updatedInvestor);
  } catch (error) {
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
    let updatedInvestor;

    await session.withTransaction(async () => {
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

      const { amount, type, date, notes } = req.body;

      if (amount !== undefined) {
        const cleanAmount = Number(amount);

        if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
          throw createError('Amount must be greater than 0');
        }

        contribution.amount = roundMoney(cleanAmount);
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

      assertNonNegativeNetContribution(investor);

      await investor.save({ session });

      await createContributionTransaction({
        investor,
        contribution,
        session,
      });

      updatedInvestor = investor;
    });

    return res.json(updatedInvestor);
  } catch (error) {
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
    let updatedInvestor;

    await session.withTransaction(async () => {
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

      assertNonNegativeNetContribution(investor);

      await investor.save({ session });

      updatedInvestor = investor;
    });

    return res.json(updatedInvestor);
  } catch (error) {
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
      const netContribution = roundMoney(
        getNetContribution(investor)
      );

      return {
        _id: investor._id,
        name: investor.name,
        netContribution,
        sharePercentage:
          totalNet > 0
            ? roundMoney((netContribution / totalNet) * 100)
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
    let settlementResult;

    await session.withTransaction(async () => {
      validateObjectId(req.params.id, 'investor ID');

      const investor = await Investor.findById(
        req.params.id
      ).session(session);

      if (!investor) {
        throw createError('Investor not found', 404);
      }

      const investorNetContribution = roundMoney(
        getNetContribution(investor)
      );

      if (investorNetContribution < -0.001) {
        throw createError(
          'This investor has a negative net contribution. Review the contribution history before closing the account.'
        );
      }

      const allInvestors = await Investor.find({})
        .session(session);

      const totalNetContributions = allInvestors.reduce(
        (total, item) =>
          total + getNetContribution(item),
        0
      );

      if (totalNetContributions <= 0) {
        throw createError(
          'Cannot calculate ownership because total net investor contributions are zero or negative.'
        );
      }

      const sharePercentage =
        investorNetContribution / totalNetContributions;

      const cashPosition = await getCashPosition(session);

      /*
        Settlement is the investor's ownership share of the
        actual available cash balance.

        Investor contributions are already included in the cash
        ledger. Do not add the original capital a second time.
      */
      const settlementAmount = roundMoney(
        sharePercentage * cashPosition.availableCash
      );

      if (
        !Number.isFinite(settlementAmount) ||
        settlementAmount < -0.001
      ) {
        throw createError(
          'Available cash is negative. Review sales, supplier payments, expenses, and investor transactions before closing this investor.'
        );
      }

      const finalSettlement = Math.max(
        0,
        settlementAmount
      );

      if (finalSettlement > 0) {
        await Transaction.create(
          [
            {
              type: 'cash_out',
              amount: finalSettlement,
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

      /*
        IMPORTANT:
        Keep Investment and Withdrawal transactions.

        They are part of the permanent cash ledger and must not
        be deleted when the investor document is closed.
      */
      await Investor.deleteOne(
        { _id: investor._id },
        { session }
      );

      settlementResult = {
        investorId: investor._id,
        investorName: investor.name,
        sharePercentage: roundMoney(sharePercentage * 100),
        availableCashBeforeSettlement: cashPosition.availableCash,
        amount: finalSettlement,
      };
    });

    return res.json({
      message: 'Investor settled and removed successfully',
      ...settlementResult,
    });
  } catch (error) {
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
    }).sort({
      date: -1,
      createdAt: -1,
    });

    const total = roundMoney(
      transactions.reduce(
        (sum, transaction) =>
          sum + toNumber(transaction.amount),
        0
      )
    );

    return res.json({
      total,
      transactions,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
