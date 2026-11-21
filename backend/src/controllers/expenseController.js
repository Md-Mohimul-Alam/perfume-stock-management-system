
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');

/* ========================================
   HELPERS
======================================== */

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    const error = new Error(
      'Expense amount and cost fields must contain valid numbers.'
    );
    error.statusCode = 400;
    throw error;
  }

  return num;
};

const parseExpenseDate = (value, fallback = new Date()) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('Invalid expense date.');
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const validateNonNegativeCosts = (values) => {
  for (const value of values) {
    if (value < 0) {
      const error = new Error(
        'Expense amounts and costs cannot be negative.'
      );
      error.statusCode = 400;
      throw error;
    }
  }
};

const syncExpenseTransaction = async (expense, session = null) => {
  const filter = {
    reference: expense._id,
    refModel: 'Expense',
    category: 'Expense',
  };

  let query = Transaction.findOne(filter);

  if (session) {
    query = query.session(session);
  }

  const existing = await query;

  const transactionData = {
    type: 'cash_out',
    amount: expense.amount,
    category: 'Expense',
    reference: expense._id,
    refModel: 'Expense',
    date: expense.date,
    description: `${expense.category} - ${
      expense.description || expense.reference || ''
    }`.trim(),
  };

  if (existing) {
    Object.assign(existing, transactionData);

    await existing.save(session ? { session } : {});

    await Transaction.deleteMany(
      {
        ...filter,
        _id: { $ne: existing._id },
      },
      session ? { session } : {}
    );
  } else if (session) {
    await Transaction.create([transactionData], { session });
  } else {
    await Transaction.create(transactionData);
  }
};

const validateWastageFields = async ({
  category,
  material,
  quantityMl,
}) => {
  if (category !== 'Wastage') {
    return {
      material: null,
      quantityMl: null,
    };
  }

  const hasMaterial =
    material !== undefined &&
    material !== null &&
    material !== '';

  const hasQuantity =
    quantityMl !== undefined &&
    quantityMl !== null &&
    quantityMl !== '';

  if (hasMaterial || hasQuantity) {
    const error = new Error(
      'For material wastage, use the inventory stock-out or stock-adjustment feature. Do not create it through the general expense form.'
    );

    error.statusCode = 400;
    throw error;
  }

  return {
    material: null,
    quantityMl: null,
  };
};

/* ========================================
   GET EXPENSES
======================================== */

exports.getExpenses = async (req, res) => {
  try {
    const { category, startDate, endDate, type } = req.query;
    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (type) {
      if (!['regular', 'event'].includes(type)) {
        return res.status(400).json({
          message: 'Invalid expense type.',
        });
      }

      filter.type = type;
    }

    if (startDate || endDate) {
      filter.date = {};

      if (startDate) {
        filter.date.$gte = parseExpenseDate(startDate);
      }

      if (endDate) {
        const parsedEndDate = parseExpenseDate(endDate);

        // Include the entire selected end date
        // when the frontend sends YYYY-MM-DD.
        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          parsedEndDate.setUTCHours(23, 59, 59, 999);
        }

        filter.date.$lte = parsedEndDate;
      }

      if (
        filter.date.$gte &&
        filter.date.$lte &&
        filter.date.$gte > filter.date.$lte
      ) {
        return res.status(400).json({
          message: 'Start date cannot be later than end date.',
        });
      }
    }

    const expenses = await Expense.find(filter)
      .populate('material', 'name sku type')
      .sort({ date: -1, createdAt: -1 });

    return res.json(expenses);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message,
    });
  }
};

/* ========================================
   CREATE EXPENSE
======================================== */

exports.createExpense = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let createdExpense;

    await session.withTransaction(async () => {
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
        material,
        quantityMl,
      } = req.body;

      const cleanType = type === 'event' ? 'event' : 'regular';

      let finalAmount = toNumber(amount);
      const finalStallRent = toNumber(stallRent);
      const finalOtherCosts = toNumber(otherCosts);

      validateNonNegativeCosts([
        finalAmount,
        finalStallRent,
        finalOtherCosts,
      ]);

      let finalEventTotal = 0;

      if (cleanType === 'event') {
        finalEventTotal = finalStallRent + finalOtherCosts;
        finalAmount = finalEventTotal;
      }

      const finalCategory =
        category || (cleanType === 'event' ? 'Stall Rent + Others' : '');

      if (!finalCategory) {
        const error = new Error('Expense category is required.');
        error.statusCode = 400;
        throw error;
      }

      const wastageFields = await validateWastageFields({
        category: finalCategory,
        material,
        quantityMl,
      });

      const [expense] = await Expense.create(
        [
          {
            type: cleanType,
            category: finalCategory,
            amount: finalAmount,
            date: parseExpenseDate(date),
            description: description || '',
            reference: reference || '',
            term: term || '',
            stallRent: cleanType === 'event' ? finalStallRent : 0,
            otherCosts: cleanType === 'event' ? finalOtherCosts : 0,
            eventTotal: cleanType === 'event' ? finalEventTotal : 0,
            notes: notes || '',
            material: wastageFields.material,
            quantityMl: wastageFields.quantityMl,
          },
        ],
        { session }
      );

      await syncExpenseTransaction(expense, session);

      createdExpense = expense;
    });

    await createdExpense.populate('material', 'name sku type');

    return res.status(201).json(createdExpense);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

/* ========================================
   UPDATE EXPENSE
======================================== */

exports.updateExpense = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let updatedExpense;

    await session.withTransaction(async () => {
      const expense = await Expense.findById(req.params.id).session(session);

      if (!expense) {
        const error = new Error('Expense not found.');
        error.statusCode = 404;
        throw error;
      }

      const linkedLogs = await InventoryLog.find({
        reference: expense._id,
        refModel: 'Expense',
      }).session(session);

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
        material,
        quantityMl,
      } = req.body;

      const finalType = type !== undefined ? type : expense.type;

      if (!['regular', 'event'].includes(finalType)) {
        const error = new Error('Invalid expense type.');
        error.statusCode = 400;
        throw error;
      }

      const finalCategory =
        category !== undefined ? category : expense.category;

      const finalAmountInput =
        amount !== undefined
          ? toNumber(amount, expense.amount)
          : expense.amount;

      const finalStallRent =
        stallRent !== undefined
          ? toNumber(stallRent)
          : toNumber(expense.stallRent);

      const finalOtherCosts =
        otherCosts !== undefined
          ? toNumber(otherCosts)
          : toNumber(expense.otherCosts);

      validateNonNegativeCosts([
        finalAmountInput,
        finalStallRent,
        finalOtherCosts,
      ]);

      let finalAmount = finalAmountInput;
      let finalEventTotal = 0;

      if (finalType === 'event') {
        finalEventTotal = finalStallRent + finalOtherCosts;
        finalAmount = finalEventTotal;
      }

      if (!finalCategory) {
        const error = new Error('Expense category is required.');
        error.statusCode = 400;
        throw error;
      }

      // Prevent generic edits from changing stock-linked expenses.
      if (linkedLogs.length > 0) {
        const stockSensitiveChange =
          (category !== undefined &&
            category !== expense.category) ||
          (amount !== undefined &&
            Number(amount) !== Number(expense.amount)) ||
          (material !== undefined &&
            String(material) !== String(expense.material || '')) ||
          (quantityMl !== undefined &&
            Number(quantityMl) !== Number(expense.quantityMl));

        if (stockSensitiveChange) {
          const error = new Error(
            'This expense is linked to an inventory log. Its category, amount, material, and quantity cannot be changed here. Use a separate correction workflow.'
          );

          error.statusCode = 409;
          throw error;
        }
      }

      const wastageFields = await validateWastageFields({
        category: finalCategory,
        material:
          material !== undefined ? material : expense.material,
        quantityMl:
          quantityMl !== undefined ? quantityMl : expense.quantityMl,
      });

      expense.type = finalType;
      expense.category = finalCategory;
      expense.amount = finalAmount;

      expense.date =
        date !== undefined
          ? parseExpenseDate(date, expense.date)
          : expense.date;

      expense.description =
        description !== undefined
          ? description
          : expense.description;

      expense.reference =
        reference !== undefined
          ? reference
          : expense.reference;

      expense.term =
        term !== undefined ? term : expense.term;

      expense.stallRent =
        finalType === 'event' ? finalStallRent : 0;

      expense.otherCosts =
        finalType === 'event' ? finalOtherCosts : 0;

      expense.eventTotal =
        finalType === 'event' ? finalEventTotal : 0;

      expense.notes =
        notes !== undefined ? notes : expense.notes;

      expense.material = wastageFields.material;
      expense.quantityMl = wastageFields.quantityMl;

      await expense.save({ session });

      await syncExpenseTransaction(expense, session);

      updatedExpense = expense;
    });

    await updatedExpense.populate('material', 'name sku type');

    return res.json(updatedExpense);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

/* ========================================
   DELETE EXPENSE
======================================== */

exports.deleteExpense = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      const expense = await Expense.findById(req.params.id).session(session);

      if (!expense) {
        const error = new Error('Expense not found.');
        error.statusCode = 404;
        throw error;
      }

      const linkedLogs = await InventoryLog.find({
        reference: expense._id,
        refModel: 'Expense',
      }).session(session);

      if (linkedLogs.length > 0) {
        const error = new Error(
          'This expense is linked to inventory history and cannot be deleted. Create a compensating stock adjustment or use a dedicated wastage reversal workflow.'
        );

        error.statusCode = 409;
        throw error;
      }

      await Transaction.deleteMany(
        {
          reference: expense._id,
          refModel: 'Expense',
          category: 'Expense',
        },
        { session }
      );

      await expense.deleteOne({ session });

      response = {
        message: 'Expense deleted successfully.',
      };
    });

    return res.json(response);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

/* ========================================
   BULK CREATE EXPENSES
======================================== */

exports.bulkCreateExpenses = async (req, res) => {
  const { expenses } = req.body;

  if (!Array.isArray(expenses) || expenses.length === 0) {
    return res.status(400).json({
      message: 'No expenses provided.',
    });
  }

  const created = [];
  const errors = [];

  for (let index = 0; index < expenses.length; index += 1) {
    const input = expenses[index];

    try {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Invalid expense row.');
      }

      const cleanType = input.type === 'event' ? 'event' : 'regular';

      if (!input.category && cleanType !== 'event') {
        throw new Error('Missing category.');
      }

      if (cleanType === 'event' && !input.term) {
        throw new Error('Missing term for event.');
      }

      const finalStallRent = toNumber(input.stallRent);
      const finalOtherCosts = toNumber(input.otherCosts);
      let finalAmount = toNumber(input.amount);
      let finalEventTotal = 0;

      validateNonNegativeCosts([
        finalAmount,
        finalStallRent,
        finalOtherCosts,
      ]);

      if (cleanType === 'event') {
        const calculated = finalStallRent + finalOtherCosts;

        finalEventTotal = calculated > 0 ? calculated : finalAmount;
        finalAmount = finalEventTotal;
      }

      const finalCategory =
        input.category ||
        (cleanType === 'event' ? 'Stall Rent + Others' : '');

      if (!finalCategory) {
        throw new Error('Missing category.');
      }

      if (
        finalCategory === 'Wastage' &&
        (input.material ||
          (input.quantityMl !== undefined &&
            input.quantityMl !== null &&
            input.quantityMl !== ''))
      ) {
        throw new Error(
          'Linked wastage must be recorded through the inventory stock-out/adjustment endpoint.'
        );
      }

      const expenseDate = parseExpenseDate(input.date);

      // Each row has its own transaction.
      // Expense and cash transaction either both commit or both roll back.
      const session = await mongoose.startSession();

      let createdExpense;

      try {
        await session.withTransaction(async () => {
          const [expense] = await Expense.create(
            [
              {
                type: cleanType,
                category: finalCategory,
                amount: finalAmount,
                date: expenseDate,
                description: input.description || '',
                reference: input.reference || '',
                term: input.term || '',
                stallRent:
                  cleanType === 'event' ? finalStallRent : 0,
                otherCosts:
                  cleanType === 'event' ? finalOtherCosts : 0,
                eventTotal:
                  cleanType === 'event' ? finalEventTotal : 0,
                notes: input.notes || '',
              },
            ],
            { session }
          );

          await syncExpenseTransaction(expense, session);

          createdExpense = expense;
        });
      } finally {
        await session.endSession();
      }

      created.push(createdExpense);
    } catch (error) {
      errors.push(`Row ${index + 1}: ${error.message}`);
    }
  }

  return res.status(201).json({
    message: `Created ${created.length} expenses, ${errors.length} errors`,
    created,
    errors,
  });
};
