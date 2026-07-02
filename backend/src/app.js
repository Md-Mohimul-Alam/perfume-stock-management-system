const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

dotenv.config();
connectDB();

const app = express();

// ------------------- CORS (proper) -------------------
const allowedOrigins = [
  'http://localhost:5173',
  'https://perfume-stock-management-system-545.vercel.app',
  'https://luxeperfume.netlify.app/'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ------------------- Routes -------------------
// Root route – welcome message
app.get('/', (req, res) => {
  res.json({ message: 'Luxe Perfume API is running' });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/production', require('./routes/productionRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/investors', require('./routes/investorRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// ------------------- Error handling -------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;