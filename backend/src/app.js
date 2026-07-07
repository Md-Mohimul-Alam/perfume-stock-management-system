const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');
const path = require('path');
const fs = require('fs');

dotenv.config();
connectDB();

const app = express();

// ------------------- CORS -------------------
const allowedOrigins = [
  'http://localhost:5173',
  'https://perfume-stock-management-system-545.vercel.app',
  'https://luxeperfume.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
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

// ------------------- Upload directory and static serving -------------------
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ Uploads directory created');
}
app.use('/uploads', express.static(uploadDir));

// ------------------- Routes -------------------
app.get('/', (req, res) => {
  res.json({ message: 'Luxe Perfume API is running' });
});

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
app.use('/api/upload', require('./routes/uploadRoutes'));   // ✅ added

// ------------------- Error handling -------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;