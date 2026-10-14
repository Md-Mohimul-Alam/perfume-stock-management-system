const mongoose = require('mongoose');

const Investor = require('../models/Investor');
const Transaction = require('../models/Transaction');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Purchase = require('../models/Purchase');

/* ========================================
   HELPERS
======================================== */

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const validateContributionType = (type) => {
  if (
    ![
      'investment',
      'withdrawal',
    ].includes(type)
  ) {
    const error =
      new Error(
        'Contribution type must be investment or withdrawal'
      );

    error.statusCode = 400;

    throw error;
  }

  return type;
};

const syncInvestorContributionTransaction =
  async ({
    investor,
    contribution,
  }) => {
    /*
      Delete only the matching generated
      investor transaction.

      Because old transactions did not
      store contributionId, we match by
      investor + amount + date + category
      as a fallback.
    */

    const category =
      contribution.type ===
      'investment'
        ? 'Investment'
        : 'Withdrawal';

    const transactionType =
      contribution.type ===
      'investment'
        ? 'cash_in'
        : 'cash_out';

    await Transaction.deleteMany({
      reference:
        investor._id,

      refModel:
        'Investor',

      category,

      amount:
        contribution.amount,

      date: {
        $gte:
          new Date(
            new Date(
              contribution.date
            ).setHours(
              0,
              0,
              0,
              0
            )
          ),

        $lte:
          new Date(
            new Date(
              contribution.date
            ).setHours(
              23,
              59,
              59,
              999
            )
          ),
      },
    });

    await Transaction.create({
      type:
        transactionType,

      amount:
        contribution.amount,

      category,

      reference:
        investor._id,

      refModel:
        'Investor',

      date:
        contribution.date,

      description:
        `${
          contribution.type
        } - ${
          investor.name
        } - ${
          contribution.notes ||
          ''
        }`,
    });
  };

/* ========================================
   GET INVESTORS
======================================== */

// @desc    Get all investors
// @route   GET /api/investors
exports.getInvestors =
  async (
    req,
    res
  ) => {
    try {
      const investors =
        await Investor.find().sort({
          createdAt: 1,
        });

      return res.json(
        investors
      );
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   CREATE INVESTOR
======================================== */

// @desc    Add new investor
// @route   POST /api/investors
exports.createInvestor =
  async (
    req,
    res
  ) => {
    try {
      const {
        name,
        initialInvestment,
      } = req.body;

      const cleanName =
        String(
          name || ''
        ).trim();

      if (!cleanName) {
        return res
          .status(400)
          .json({
            message:
              'Investor name is required',
          });
      }

      const initialAmount =
        toNumber(
          initialInvestment
        );

      if (
        initialAmount < 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'Initial investment cannot be negative',
          });
      }

      const investor =
        await Investor.create({
          name:
            cleanName,
        });

      if (
        initialAmount >
        0
      ) {
        investor.contributions.push(
          {
            amount:
              initialAmount,

            type:
              'investment',

            date:
              new Date(),

            notes:
              'Initial investment',
          }
        );

        await investor.save();

        const contribution =
          investor
            .contributions[
            investor
              .contributions
              .length - 1
          ];

        await syncInvestorContributionTransaction(
          {
            investor,

            contribution,
          }
        );
      }

      return res
        .status(201)
        .json(investor);
    } catch (error) {
      return res
        .status(
          error.statusCode ||
            500
        )
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   ADD CONTRIBUTION
======================================== */

// @desc    Add contribution
// @route   POST /api/investors/:id/contribute
exports.addContribution =
  async (
    req,
    res
  ) => {
    try {
      const investor =
        await Investor.findById(
          req.params.id
        );

      if (!investor) {
        return res
          .status(404)
          .json({
            message:
              'Investor not found',
          });
      }

      const {
        amount,
        type,
        date,
        notes,
      } = req.body;

      const cleanAmount =
        toNumber(amount);

      if (
        cleanAmount <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'Amount must be greater than 0',
          });
      }

      const cleanType =
        validateContributionType(
          type
        );

      investor.contributions.push(
        {
          amount:
            cleanAmount,

          type:
            cleanType,

          date:
            date
              ? new Date(
                  date
                )
              : new Date(),

          notes:
            String(
              notes || ''
            ).trim(),
        }
      );

      await investor.save();

      const contribution =
        investor
          .contributions[
          investor
            .contributions
            .length - 1
        ];

      await syncInvestorContributionTransaction(
        {
          investor,

          contribution,
        }
      );

      return res.json(
        investor
      );
    } catch (error) {
      return res
        .status(
          error.statusCode ||
            500
        )
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   UPDATE CONTRIBUTION
======================================== */

// @desc    Update investor contribution
// @route   PUT /api/investors/:id/contributions/:contributionId
exports.updateContribution =
  async (
    req,
    res
  ) => {
    const session =
      await mongoose.startSession();

    try {
      session.startTransaction();

      const investor =
        await Investor.findById(
          req.params.id
        ).session(
          session
        );

      if (!investor) {
        const error =
          new Error(
            'Investor not found'
          );

        error.statusCode =
          404;

        throw error;
      }

      const contribution =
        investor.contributions.id(
          req.params
            .contributionId
        );

      if (!contribution) {
        const error =
          new Error(
            'Contribution not found'
          );

        error.statusCode =
          404;

        throw error;
      }

      /*
        Remove old matching transaction
        before changing contribution.
      */

      const oldCategory =
        contribution.type ===
        'investment'
          ? 'Investment'
          : 'Withdrawal';

      await Transaction.deleteMany(
        {
          reference:
            investor._id,

          refModel:
            'Investor',

          category:
            oldCategory,

          amount:
            contribution.amount,

          date: {
            $gte:
              new Date(
                new Date(
                  contribution.date
                ).setHours(
                  0,
                  0,
                  0,
                  0
                )
              ),

            $lte:
              new Date(
                new Date(
                  contribution.date
                ).setHours(
                  23,
                  59,
                  59,
                  999
                )
              ),
          },
        }
      ).session(
        session
      );

      const {
        amount,
        type,
        date,
        notes,
      } = req.body;

      if (
        amount !==
        undefined
      ) {
        const cleanAmount =
          toNumber(
            amount
          );

        if (
          cleanAmount <=
          0
        ) {
          const error =
            new Error(
              'Amount must be greater than 0'
            );

          error.statusCode =
            400;

          throw error;
        }

        contribution.amount =
          cleanAmount;
      }

      if (
        type !==
        undefined
      ) {
        contribution.type =
          validateContributionType(
            type
          );
      }

      if (
        date !==
        undefined
      ) {
        contribution.date =
          new Date(
            date
          );
      }

      if (
        notes !==
        undefined
      ) {
        contribution.notes =
          String(
            notes || ''
          ).trim();
      }

      await investor.save({
        session,
      });

      const transactionType =
        contribution.type ===
        'investment'
          ? 'cash_in'
          : 'cash_out';

      const category =
        contribution.type ===
        'investment'
          ? 'Investment'
          : 'Withdrawal';

      await Transaction.create(
        [
          {
            type:
              transactionType,

            amount:
              contribution.amount,

            category,

            reference:
              investor._id,

            refModel:
              'Investor',

            date:
              contribution.date,

            description:
              `${
                contribution.type
              } - ${
                investor.name
              } - ${
                contribution.notes ||
                ''
              }`,
          },
        ],
        {
          session,
        }
      );

      await session.commitTransaction();

      return res.json(
        investor
      );
    } catch (error) {
      await session.abortTransaction();

      return res
        .status(
          error.statusCode ||
            500
        )
        .json({
          message:
            error.message,
        });
    } finally {
      session.endSession();
    }
  };

/* ========================================
   DELETE CONTRIBUTION
======================================== */

// @desc    Delete investor contribution
// @route   DELETE /api/investors/:id/contributions/:contributionId
exports.deleteContribution =
  async (
    req,
    res
  ) => {
    const session =
      await mongoose.startSession();

    try {
      session.startTransaction();

      const investor =
        await Investor.findById(
          req.params.id
        ).session(
          session
        );

      if (!investor) {
        const error =
          new Error(
            'Investor not found'
          );

        error.statusCode =
          404;

        throw error;
      }

      const contribution =
        investor.contributions.id(
          req.params
            .contributionId
        );

      if (!contribution) {
        const error =
          new Error(
            'Contribution not found'
          );

        error.statusCode =
          404;

        throw error;
      }

      const category =
        contribution.type ===
        'investment'
          ? 'Investment'
          : 'Withdrawal';

      await Transaction.deleteMany(
        {
          reference:
            investor._id,

          refModel:
            'Investor',

          category,

          amount:
            contribution.amount,

          date: {
            $gte:
              new Date(
                new Date(
                  contribution.date
                ).setHours(
                  0,
                  0,
                  0,
                  0
                )
              ),

            $lte:
              new Date(
                new Date(
                  contribution.date
                ).setHours(
                  23,
                  59,
                  59,
                  999
                )
              ),
          },
        }
      ).session(
        session
      );

      contribution.deleteOne();

      await investor.save({
        session,
      });

      await session.commitTransaction();

      return res.json(
        investor
      );
    } catch (error) {
      await session.abortTransaction();

      return res
        .status(
          error.statusCode ||
            500
        )
        .json({
          message:
            error.message,
        });
    } finally {
      session.endSession();
    }
  };

/* ========================================
   GET SHARES
======================================== */

// @desc    Get current share percentages
// @route   GET /api/investors/shares
exports.getShares =
  async (
    req,
    res
  ) => {
    try {
      const investors =
        await Investor.find();

      const totalNet =
        investors.reduce(
          (
            sum,
            investor
          ) =>
            sum +
            investor.netContribution,
          0
        );

      const shares =
        investors.map(
          (
            investor
          ) => ({
            _id:
              investor._id,

            name:
              investor.name,

            netContribution:
              investor.netContribution,

            sharePercentage:
              totalNet > 0
                ? (
                    investor.netContribution /
                    totalNet
                  ) *
                  100
                : 0,
          })
        );

      return res.json(
        shares
      );
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   DELETE / CLOSE INVESTOR
======================================== */

// @desc    Close investor and create settlement
// @route   DELETE /api/investors/:id
exports.deleteInvestor =
  async (
    req,
    res
  ) => {
    try {
      const investor =
        await Investor.findById(
          req.params.id
        );

      if (!investor) {
        return res
          .status(404)
          .json({
            message:
              'Investor not found',
          });
      }

      const totalInvested =
        investor.contributions
          .filter(
            (contribution) =>
              contribution.type ===
              'investment'
          )
          .reduce(
            (
              sum,
              contribution
            ) =>
              sum +
              contribution.amount,
            0
          );

      const allInvestors =
        await Investor.find({});

      let totalAllInvested =
        0;

      allInvestors.forEach(
        (
          item
        ) => {
          item.contributions.forEach(
            (
              contribution
            ) => {
              if (
                contribution.type ===
                'investment'
              ) {
                totalAllInvested +=
                  contribution.amount;
              }
            }
          );
        }
      );

      const share =
        totalAllInvested >
        0
          ? (
              totalInvested /
              totalAllInvested
            ) *
            100
          : 0;

      const [
        allSales,
        allExpenses,
        allPurchases,
        allSettlements,
      ] =
        await Promise.all([
          Sale.find(),

          Expense.find(),

          Purchase.find(),

          Transaction.find(
            {
              type:
                'cash_out',

              category:
                'Investor Settlement',
            }
          ),
        ]);

      const totalRevenue =
        allSales.reduce(
          (
            total,
            sale
          ) =>
            total +
            toNumber(
              sale.totalAmount
            ),
          0
        );

      const dueAmount =
        allSales.reduce(
          (
            total,
            sale
          ) =>
            sale.paymentStatus ===
            'due'
              ? total +
                toNumber(
                  sale.totalAmount
                )
              : total,
          0
        );

      const paidRevenue =
        totalRevenue -
        dueAmount;

      const totalExpenses =
        allExpenses.reduce(
          (
            total,
            expense
          ) =>
            total +
            toNumber(
              expense.amount
            ),
          0
        );

      const totalPurchases =
        allPurchases.reduce(
          (
            total,
            purchase
          ) =>
            total +
            toNumber(
              purchase.totalAmount
            ),
          0
        );

      let totalInvestedOther =
        0;

      let totalWithdrawnOther =
        0;

      allInvestors.forEach(
        (
          item
        ) => {
          if (
            item._id.toString() ===
            investor._id.toString()
          ) {
            return;
          }

          item.contributions.forEach(
            (
              contribution
            ) => {
              if (
                contribution.type ===
                'investment'
              ) {
                totalInvestedOther +=
                  contribution.amount;
              }

              if (
                contribution.type ===
                'withdrawal'
              ) {
                totalWithdrawnOther +=
                  contribution.amount;
              }
            }
          );
        }
      );

      const investorNetOther =
        totalInvestedOther -
        totalWithdrawnOther;

      const totalSettlements =
        allSettlements.reduce(
          (
            total,
            settlement
          ) =>
            total +
            settlement.amount,
          0
        );

      const availableCash =
        paidRevenue -
        totalExpenses -
        totalPurchases +
        investorNetOther -
        totalSettlements;

      const profitShare =
        (
          share /
          100
        ) *
        availableCash;

      const settlementAmount =
        totalInvested +
        profitShare;

      /*
        Keep settlement transaction.

        We do not create another normal
        Withdrawal transaction here,
        because settlement itself is
        already a cash_out transaction.
      */

      await Transaction.create(
        {
          type:
            'cash_out',

          amount:
            settlementAmount,

          category:
            'Investor Settlement',

          reference:
            investor._id,

          refModel:
            'Investor',

          date:
            new Date(),

          description:
            `Settlement for ${
              investor.name
            }`,
        }
      );

      /*
        Remove ordinary investor
        contribution transactions because
        investor is being closed.
      */

      await Transaction.deleteMany(
        {
          reference:
            investor._id,

          refModel:
            'Investor',

          category: {
            $in: [
              'Investment',
              'Withdrawal',
            ],
          },
        }
      );

      await investor.deleteOne();

      return res.json(
        {
          message:
            'Investor settled and removed',

          amount:
            settlementAmount,
        }
      );
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };

/* ========================================
   GET SETTLEMENTS
======================================== */

// @desc    Get total settlements
// @route   GET /api/investors/settlements
exports.getSettlements =
  async (
    req,
    res
  ) => {
    try {
      const transactions =
        await Transaction.find(
          {
            type:
              'cash_out',

            category:
              'Investor Settlement',
          }
        );

      const total =
        transactions.reduce(
          (
            sum,
            transaction
          ) =>
            sum +
            transaction.amount,
          0
        );

      return res.json({
        total,
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          message:
            error.message,
        });
    }
  };