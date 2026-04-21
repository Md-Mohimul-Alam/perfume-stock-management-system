const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');

// @desc    Get all expenses
// @route   GET /api/expenses
exports.getExpenses = async (req, res) => {
  try {
    const { category, startDate, endDate } = req.query;
    const filter = {};
    if (category) filter.category = category;
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

// @desc    Create expense
// @route   POST /api/expenses
exports.createExpense = async (req, res) => {
  try {
    const { category, amount, date, description, reference } = req.body;
    const expense = await Expense.create({ category, amount, date, description, reference });

    await Transaction.create({
      type: 'cash_out',
      amount,
      category: 'Expense',
      reference: expense._id,
      refModel: 'Expense',
      description: `${category} - ${description || ''}`,
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
exports.updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const oldAmount = expense.amount;
    const { category, amount, date, description, reference } = req.body;
    expense.category = category || expense.category;
    expense.amount = amount !== undefined ? amount : expense.amount;
    expense.date = date || expense.date;
    expense.description = description || expense.description;
    expense.reference = reference || expense.reference;
    await expense.save();

    // Update transaction if amount changed
    if (amount && amount !== oldAmount) {
      await Transaction.findOneAndUpdate(
        { reference: expense._id, refModel: 'Expense' },
        { amount }
      );
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    await Transaction.deleteOne({ reference: expense._id, refModel: 'Expense' });
    await expense.remove();
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};