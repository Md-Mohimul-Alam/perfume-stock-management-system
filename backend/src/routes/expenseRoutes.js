const express = require('express');
const router = express.Router();
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  bulkCreateExpenses,
} = require('../controllers/expenseController');

router.route('/')
  .get(getExpenses)
  .post(createExpense);

router.route('/bulk')
  .post(bulkCreateExpenses);

router.route('/:id')
  .put(updateExpense)
  .delete(deleteExpense);

module.exports = router;