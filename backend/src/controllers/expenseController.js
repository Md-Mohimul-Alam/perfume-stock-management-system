const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');

// @desc    Get all expenses (with filters)
// @route   GET /api/expenses
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
    const expenses = await Expense.find(filter).sort('-date');
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a single expense
// @route   POST /api/expenses
exports.createExpense = async (req, res) => {
  try {
    const { type, category, amount, date, description, reference, term, stallRent, otherCosts, notes } = req.body;

    // If it's an event, compute amount from stallRent + otherCosts if not provided
    let finalAmount = amount;
    let finalEventTotal = 0;
    if (type === 'event') {
      const rent = parseFloat(stallRent) || 0;
      const other = parseFloat(otherCosts) || 0;
      finalEventTotal = rent + other;
      finalAmount = finalEventTotal;
    }

    const expenseData = {
      type: type || 'regular',
      category,
      amount: finalAmount,
      date: date || new Date(),
      description,
      reference,
      term,
      stallRent: stallRent || 0,
      otherCosts: otherCosts || 0,
      eventTotal: finalEventTotal,
      notes,
    };

    const expense = await Expense.create(expenseData);

    // Create transaction record
    await Transaction.create({
      type: 'cash_out',
      amount: expense.amount,
      category: 'Expense',
      reference: expense._id,
      refModel: 'Expense',
      description: `${category} - ${description || reference || ''}`,
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an expense
// @route   PUT /api/expenses/:id
exports.updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const { category, amount, date, description, reference, term, stallRent, otherCosts, notes, type } = req.body;

    let finalAmount = amount;
    let finalEventTotal = 0;
    if (type === 'event') {
      const rent = parseFloat(stallRent) || expense.stallRent || 0;
      const other = parseFloat(otherCosts) || expense.otherCosts || 0;
      finalEventTotal = rent + other;
      finalAmount = finalEventTotal;
    } else {
      finalAmount = amount !== undefined ? amount : expense.amount;
    }

    expense.category = category || expense.category;
    expense.amount = finalAmount;
    expense.date = date || expense.date;
    expense.description = description !== undefined ? description : expense.description;
    expense.reference = reference !== undefined ? reference : expense.reference;
    expense.term = term !== undefined ? term : expense.term;
    expense.stallRent = stallRent !== undefined ? stallRent : expense.stallRent;
    expense.otherCosts = otherCosts !== undefined ? otherCosts : expense.otherCosts;
    expense.eventTotal = finalEventTotal || expense.eventTotal;
    expense.notes = notes !== undefined ? notes : expense.notes;
    expense.type = type || expense.type;

    await expense.save();

    // Update transaction if amount changed
    if (finalAmount !== expense.amount) {
      await Transaction.findOneAndUpdate(
        { reference: expense._id, refModel: 'Expense' },
        { amount: finalAmount }
      );
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    // Delete associated transaction
    await Transaction.deleteOne({ reference: expense._id, refModel: 'Expense' });
    await expense.deleteOne();

    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================
// BULK CREATE (for sheet upload)
// =============================================
// @desc    Bulk create expenses from CSV/Excel
// @route   POST /api/expenses/bulk
exports.bulkCreateExpenses = async (req, res) => {
  try {
    const { expenses } = req.body;
    if (!expenses || !expenses.length) {
      return res.status(400).json({ message: 'No expenses provided' });
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < expenses.length; i++) {
      const expData = expenses[i];
      try {
        // Ensure required fields
        if (!expData.category && expData.type !== 'event') {
          errors.push(`Row ${i+1}: Missing category`);
          continue;
        }
        if (expData.amount === undefined || expData.amount === null) {
          errors.push(`Row ${i+1}: Missing amount`);
          continue;
        }
        if (expData.type === 'event' && !expData.term) {
          errors.push(`Row ${i+1}: Missing term for event`);
          continue;
        }

        // For event, compute eventTotal
        if (expData.type === 'event') {
          expData.eventTotal = expData.amount;
          expData.category = expData.category || 'Stall Rent + Others';
        }

        const expense = await Expense.create(expData);
        created.push(expense);

        // Create transaction
        await Transaction.create({
          type: 'cash_out',
          amount: expense.amount,
          category: 'Expense',
          reference: expense._id,
          refModel: 'Expense',
          description: `${expense.category} - ${expense.description || expense.reference || ''}`,
        });
      } catch (err) {
        errors.push(`Row ${i+1}: ${err.message}`);
      }
    }

    res.status(201).json({
      message: `Created ${created.length} expenses, ${errors.length} errors`,
      created,
      errors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};