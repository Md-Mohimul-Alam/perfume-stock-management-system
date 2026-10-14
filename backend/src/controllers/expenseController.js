const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');

/* ========================================
   HELPERS
======================================== */

const toNumber = (value, fallback = 0) => {
  const num = Number(value);

  return Number.isFinite(num)
    ? num
    : fallback;
};

const syncExpenseTransaction = async (
  expense
) => {
  await Transaction.deleteMany({
    reference: expense._id,
    refModel: 'Expense',
    category: 'Expense',
  });

  await Transaction.create({
    type: 'cash_out',

    amount: expense.amount,

    category: 'Expense',

    reference: expense._id,

    refModel: 'Expense',

    date: expense.date,

    description:
      `${expense.category} - ${
        expense.description ||
        expense.reference ||
        ''
      }`.trim(),
  });
};

/* ========================================
   GET EXPENSES
======================================== */

// @desc    Get all expenses with filters
// @route   GET /api/expenses
exports.getExpenses = async (
  req,
  res
) => {
  try {
    const {
      category,
      startDate,
      endDate,
      type,
    } = req.query;

    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (type) {
      filter.type = type;
    }

    if (
      startDate ||
      endDate
    ) {
      filter.date = {};

      if (startDate) {
        filter.date.$gte =
          new Date(startDate);
      }

      if (endDate) {
        filter.date.$lte =
          new Date(endDate);
      }
    }

    const expenses =
      await Expense.find(
        filter
      ).sort({
        date: -1,
        createdAt: -1,
      });

    return res.json(
      expenses
    );
  } catch (error) {
    return res.status(500).json({
      message:
        error.message,
    });
  }
};

/* ========================================
   CREATE EXPENSE
======================================== */

// @desc    Create a single expense
// @route   POST /api/expenses
exports.createExpense = async (
  req,
  res
) => {
  try {
    const {
      type,
      category,
      amount,
      date,
      description,
      reference,
      term,
      stallRent,
      otherCosts,
      notes,
    } = req.body;

    const cleanType =
      type === 'event'
        ? 'event'
        : 'regular';

    let finalAmount =
      toNumber(amount);

    let finalEventTotal =
      0;

    let finalStallRent =
      toNumber(stallRent);

    let finalOtherCosts =
      toNumber(otherCosts);

    if (
      cleanType ===
      'event'
    ) {
      finalEventTotal =
        finalStallRent +
        finalOtherCosts;

      finalAmount =
        finalEventTotal;
    }

    if (
      finalAmount < 0
    ) {
      return res
        .status(400)
        .json({
          message:
            'Expense amount cannot be negative',
        });
    }

    const expenseData = {
      type: cleanType,

      category:
        category ||
        (cleanType ===
        'event'
          ? 'Stall Rent + Others'
          : undefined),

      amount:
        finalAmount,

      date:
        date
          ? new Date(date)
          : new Date(),

      description:
        description || '',

      reference:
        reference || '',

      term:
        term || '',

      stallRent:
        cleanType ===
        'event'
          ? finalStallRent
          : 0,

      otherCosts:
        cleanType ===
        'event'
          ? finalOtherCosts
          : 0,

      eventTotal:
        cleanType ===
        'event'
          ? finalEventTotal
          : 0,

      notes:
        notes || '',
    };

    const expense =
      await Expense.create(
        expenseData
      );

    try {
      await syncExpenseTransaction(
        expense
      );
    } catch (transactionError) {
      /*
        If transaction creation fails,
        remove the expense so Expense
        and Transaction stay consistent.
      */

      await Expense.findByIdAndDelete(
        expense._id
      );

      throw transactionError;
    }

    return res
      .status(201)
      .json(expense);
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
   UPDATE EXPENSE
======================================== */

// @desc    Update an expense
// @route   PUT /api/expenses/:id
exports.updateExpense = async (
  req,
  res
) => {
  try {
    const expense =
      await Expense.findById(
        req.params.id
      );

    if (!expense) {
      return res
        .status(404)
        .json({
          message:
            'Expense not found',
        });
    }

    const {
      category,
      amount,
      date,
      description,
      reference,
      term,
      stallRent,
      otherCosts,
      notes,
      type,
    } = req.body;

    const finalType =
      type !== undefined
        ? type
        : expense.type;

    if (
      ![
        'regular',
        'event',
      ].includes(
        finalType
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            'Invalid expense type',
        });
    }

    let finalAmount =
      amount !== undefined
        ? toNumber(
            amount,
            expense.amount
          )
        : expense.amount;

    let finalStallRent =
      stallRent !==
      undefined
        ? toNumber(
            stallRent
          )
        : toNumber(
            expense.stallRent
          );

    let finalOtherCosts =
      otherCosts !==
      undefined
        ? toNumber(
            otherCosts
          )
        : toNumber(
            expense.otherCosts
          );

    let finalEventTotal =
      expense.eventTotal ||
      0;

    if (
      finalType ===
      'event'
    ) {
      finalEventTotal =
        finalStallRent +
        finalOtherCosts;

      finalAmount =
        finalEventTotal;
    } else {
      finalStallRent = 0;
      finalOtherCosts = 0;
      finalEventTotal = 0;
    }

    if (
      finalAmount < 0
    ) {
      return res
        .status(400)
        .json({
          message:
            'Expense amount cannot be negative',
        });
    }

    expense.type =
      finalType;

    expense.category =
      category !==
      undefined
        ? category
        : expense.category;

    expense.amount =
      finalAmount;

    expense.date =
      date !== undefined
        ? new Date(date)
        : expense.date;

    expense.description =
      description !==
      undefined
        ? description
        : expense.description;

    expense.reference =
      reference !==
      undefined
        ? reference
        : expense.reference;

    expense.term =
      term !== undefined
        ? term
        : expense.term;

    expense.stallRent =
      finalStallRent;

    expense.otherCosts =
      finalOtherCosts;

    expense.eventTotal =
      finalEventTotal;

    expense.notes =
      notes !== undefined
        ? notes
        : expense.notes;

    await expense.save();

    /*
      IMPORTANT:
      Always sync the transaction.

      Old code checked:

      if (finalAmount !== expense.amount)

      But expense.amount had already
      been changed to finalAmount,
      so the condition was false.
    */

    await syncExpenseTransaction(
      expense
    );

    return res.json(
      expense
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
   DELETE EXPENSE
======================================== */

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
exports.deleteExpense = async (
  req,
  res
) => {
  try {
    const expense =
      await Expense.findById(
        req.params.id
      );

    if (!expense) {
      return res
        .status(404)
        .json({
          message:
            'Expense not found',
        });
    }

    await Transaction.deleteMany({
      reference:
        expense._id,

      refModel:
        'Expense',

      category:
        'Expense',
    });

    await expense.deleteOne();

    return res.json({
      message:
        'Expense deleted',
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

/* ========================================
   BULK CREATE EXPENSES
======================================== */

// @desc    Bulk create expenses from CSV/Excel
// @route   POST /api/expenses/bulk
exports.bulkCreateExpenses =
  async (
    req,
    res
  ) => {
    try {
      const {
        expenses,
      } = req.body;

      if (
        !Array.isArray(
          expenses
        ) ||
        expenses.length ===
          0
      ) {
        return res
          .status(400)
          .json({
            message:
              'No expenses provided',
          });
      }

      const created = [];

      const errors = [];

      for (
        let index = 0;
        index <
        expenses.length;
        index += 1
      ) {
        const input =
          expenses[index];

        try {
          const cleanType =
            input.type ===
            'event'
              ? 'event'
              : 'regular';

          if (
            !input.category &&
            cleanType !==
              'event'
          ) {
            errors.push(
              `Row ${
                index + 1
              }: Missing category`
            );

            continue;
          }

          if (
            cleanType ===
              'event' &&
            !input.term
          ) {
            errors.push(
              `Row ${
                index + 1
              }: Missing term for event`
            );

            continue;
          }

          let finalStallRent =
            toNumber(
              input.stallRent
            );

          let finalOtherCosts =
            toNumber(
              input.otherCosts
            );

          let finalAmount =
            toNumber(
              input.amount
            );

          let finalEventTotal =
            0;

          if (
            cleanType ===
            'event'
          ) {
            /*
              Prefer stallRent +
              otherCosts when supplied.

              If old import files only
              have amount, keep amount.
            */

            const calculated =
              finalStallRent +
              finalOtherCosts;

            if (
              calculated > 0
            ) {
              finalEventTotal =
                calculated;

              finalAmount =
                calculated;
            } else {
              finalEventTotal =
                finalAmount;
            }
          }

          if (
            finalAmount < 0
          ) {
            errors.push(
              `Row ${
                index + 1
              }: Amount cannot be negative`
            );

            continue;
          }

          const expense =
            await Expense.create({
              type:
                cleanType,

              category:
                input.category ||
                'Stall Rent + Others',

              amount:
                finalAmount,

              date:
                input.date
                  ? new Date(
                      input.date
                    )
                  : new Date(),

              description:
                input.description ||
                '',

              reference:
                input.reference ||
                '',

              term:
                input.term ||
                '',

              stallRent:
                cleanType ===
                'event'
                  ? finalStallRent
                  : 0,

              otherCosts:
                cleanType ===
                'event'
                  ? finalOtherCosts
                  : 0,

              eventTotal:
                cleanType ===
                'event'
                  ? finalEventTotal
                  : 0,

              notes:
                input.notes ||
                '',
            });

          try {
            await syncExpenseTransaction(
              expense
            );
          } catch (
            transactionError
          ) {
            await Expense.findByIdAndDelete(
              expense._id
            );

            throw transactionError;
          }

          created.push(
            expense
          );
        } catch (error) {
          errors.push(
            `Row ${
              index + 1
            }: ${
              error.message
            }`
          );
        }
      }

      return res
        .status(201)
        .json({
          message:
            `Created ${
              created.length
            } expenses, ${
              errors.length
            } errors`,

          created,

          errors,
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