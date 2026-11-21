
const express = require('express');
const router = express.Router();

const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  bulkCreateExpenses,
} = require('../controllers/expenseController');

const {
  protect,
  admin,
} = require('../middlewares/authMiddleware');

// All expense endpoints require authentication.
router.use(protect);

// Read expense records.
router.get('/', getExpenses);

// Only administrators can modify financial records.
router.post('/', admin, createExpense);
router.post('/bulk', admin, bulkCreateExpenses);

router.put('/:id', admin, updateExpense);
router.delete('/:id', admin, deleteExpense);

module.exports = router;
