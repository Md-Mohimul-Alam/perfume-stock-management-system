const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');
const RawMaterial = require('../models/RawMaterial');

/* ========================================
   HELPERS
======================================== */

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const roundMl = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const syncExpenseTransaction = async (expense, session = null) => {
  const filter = {
    reference: expense._id,
    refModel: 'Expense',
    category: 'Expense',
  };

  // Update one existing transaction where possible, instead of deleting and
  // recreating it on every edit. Remove any accidental duplicates afterwards.
  let query = Transaction.findOne(filter);
  if (session) query = query.session(session);
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
      { ...filter, _id: { $ne: existing._id } },
      session ? { session } : {}
    );
  } else {
    await Transaction.create(
      [transactionData],
      session ? { session } : undefined
    );
  }
};

const validateWastageFields = async ({
  category,
  material,
  quantityMl,
  session,
}) => {
  if (category !== 'Wastage') {
    return { material: null, quantityMl: null };
  }

  // Legacy/manual wastage expenses may remain unlinked. New API-created
  // wastage entries should provide both fields together.
  if (!material && (quantityMl === undefined || quantityMl === null || quantityMl === '')) {
    return { material: null, quantityMl: null };
  }

  if (!material || quantityMl === undefined || quantityMl === null || quantityMl === '') {
    const error = new Error(
      'For a linked wastage expense, both material and quantityMl are required.'
    );
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(material)) {
    const error = new Error('Invalid raw material ID.');
    error.statusCode = 400;
    throw error;
  }

  const quantity = Number(quantityMl);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error('quantityMl must be greater than zero.');
    error.statusCode = 400;
    throw error;
  }

  let query = RawMaterial.findById(material);
  if (session) query = query.session(session);
  const foundMaterial = await query;

  if (!foundMaterial) {
    const error = new Error('Raw material not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    material: foundMaterial._id,
    quantityMl: roundMl(quantity),
  };
};

/* ========================================
   GET EXPENSES
======================================== */

exports.getExpenses = async (req, res) => {
  try {
    const { category, startDate, endDate, type } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (type) filter.type = type;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter)
      .populate('material', 'name sku type')
      .sort({ date: -1, createdAt: -1 });

    return res.json(expenses);
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
      let finalEventTotal = 0;

      if (cleanType === 'event') {
        finalEventTotal = finalStallRent + finalOtherCosts;
        finalAmount = finalEventTotal;
      }

      if (finalAmount < 0) {
        const error = new Error('Expense amount cannot be negative.');
        error.statusCode = 400;
        throw error;
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
        session,
      });

      const [expense] = await Expense.create(
        [{
          type: cleanType,
          category: finalCategory,
          amount: finalAmount,
          date: date ? new Date(date) : new Date(),
          description: description || '',
          reference: reference || '',
          term: term || '',
          stallRent: cleanType === 'event' ? finalStallRent : 0,
          otherCosts: cleanType === 'event' ? finalOtherCosts : 0,
          eventTotal: cleanType === 'event' ? finalEventTotal : 0,
          notes: notes || '',
          material: wastageFields.material,
          quantityMl: wastageFields.quantityMl,
        }],
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

      const finalCategory = category !== undefined ? category : expense.category;
      const finalAmountInput =
        amount !== undefined ? toNumber(amount, expense.amount) : expense.amount;

      const finalStallRent =
        stallRent !== undefined ? toNumber(stallRent) : toNumber(expense.stallRent);

      const finalOtherCosts =
        otherCosts !== undefined ? toNumber(otherCosts) : toNumber(expense.otherCosts);

      let finalAmount = finalAmountInput;
      let finalEventTotal = 0;

      if (finalType === 'event') {
        finalEventTotal = finalStallRent + finalOtherCosts;
        finalAmount = finalEventTotal;
      }

      if (finalAmount < 0) {
        const error = new Error('Expense amount cannot be negative.');
        error.statusCode = 400;
        throw error;
      }

      // A linked stock event is immutable through the generic expense editor.
      // Changing its amount/material/quantity/category would desynchronize stock.
      if (linkedLogs.length > 0) {
        const stockSensitiveChange =
          (category !== undefined && category !== expense.category) ||
          (amount !== undefined && Number(amount) !== Number(expense.amount)) ||
          (material !== undefined && String(material) !== String(expense.material || '')) ||
          (quantityMl !== undefined && Number(quantityMl) !== Number(expense.quantityMl));

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
        material: material !== undefined ? material : expense.material,
        quantityMl: quantityMl !== undefined ? quantityMl : expense.quantityMl,
        session,
      });

      expense.type = finalType;
      expense.category = finalCategory;
      expense.amount = finalAmount;
      expense.date = date !== undefined ? new Date(date) : expense.date;
      expense.description =
        description !== undefined ? description : expense.description;
      expense.reference =
        reference !== undefined ? reference : expense.reference;
      expense.term = term !== undefined ? term : expense.term;
      expense.stallRent = finalType === 'event' ? finalStallRent : 0;
      expense.otherCosts = finalType === 'event' ? finalOtherCosts : 0;
      expense.eventTotal = finalType === 'event' ? finalEventTotal : 0;
      expense.notes = notes !== undefined ? notes : expense.notes;
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

      response = { message: 'Expense deleted successfully.' };
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
    return res.status(400).json({ message: 'No expenses provided.' });
  }

  const created = [];
  const errors = [];

  for (let index = 0; index < expenses.length; index += 1) {
    const input = expenses[index];

    try {
      const cleanType = input.type === 'event' ? 'event' : 'regular';

      if (!input.category && cleanType !== 'event') {
        errors.push(`Row ${index + 1}: Missing category`);
        continue;
      }

      if (cleanType === 'event' && !input.term) {
        errors.push(`Row ${index + 1}: Missing term for event`);
        continue;
      }

      const finalStallRent = toNumber(input.stallRent);
      const finalOtherCosts = toNumber(input.otherCosts);
      let finalAmount = toNumber(input.amount);
      let finalEventTotal = 0;

      if (cleanType === 'event') {
        const calculated = finalStallRent + finalOtherCosts;
        finalEventTotal = calculated > 0 ? calculated : finalAmount;
        finalAmount = finalEventTotal;
      }

      if (finalAmount < 0) {
        errors.push(`Row ${index + 1}: Amount cannot be negative`);
        continue;
      }

      const finalCategory =
        input.category || (cleanType === 'event' ? 'Stall Rent + Others' : '');

      if (!finalCategory) {
        errors.push(`Row ${index + 1}: Missing category`);
        continue;
      }

      // Bulk imports can import historical expense data, but they must not
      // create stock-linked wastage implicitly. Use the dedicated stock-out
      // or stock-adjustment endpoint for linked inventory events.
      if (finalCategory === 'Wastage' && (input.material || input.quantityMl)) {
        errors.push(
          `Row ${index + 1}: Linked wastage must be recorded through the inventory stock-out/adjustment endpoint.`
        );
        continue;
      }

      const expense = await Expense.create({
        type: cleanType,
        category: finalCategory,
        amount: finalAmount,
        date: input.date ? new Date(input.date) : new Date(),
        description: input.description || '',
        reference: input.reference || '',
        term: input.term || '',
        stallRent: cleanType === 'event' ? finalStallRent : 0,
        otherCosts: cleanType === 'event' ? finalOtherCosts : 0,
        eventTotal: cleanType === 'event' ? finalEventTotal : 0,
        notes: input.notes || '',
      });

      try {
        await syncExpenseTransaction(expense);
        created.push(expense);
      } catch (transactionError) {
        await Expense.findByIdAndDelete(expense._id);
        throw transactionError;
      }
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