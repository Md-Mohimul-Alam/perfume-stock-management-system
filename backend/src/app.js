const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Body parser middleware
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/production', require('./routes/productionRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/investors', require('./routes/investorRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;