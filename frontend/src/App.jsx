import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { Toaster } from 'react-hot-toast';

import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

import Materials from './pages/Inventory/Materials';
import Bottles from './pages/Inventory/Bottles';

import Batches from './pages/Production/Batches';

import SaleList from './pages/Sales/SaleList';
import NewSale from './pages/Sales/NewSale';
import SalesCount from './pages/Sales/SalesCount';
import SalesByProduct from './pages/Sales/SalesByProduct';

import ProductList from './pages/Products/ProductList';
import NewProduct from './pages/Products/NewProduct';

import ExpensePage from './pages/Expenses/Expenses';

import NewPurchase from './pages/Purchases/NewPurchase';
import PurchaseList from './pages/Purchases/PurchaseList';

import Investors from './pages/Investors/Investors';
import Reports from './pages/Reports/Reports';

import WastageList from './pages/Wastage/WastageList';
import WastageForm from './pages/Wastage/WastageForm';

import Orders from './pages/Orders/Orders';

function App() {
  return (
    <BrowserRouter>
      {/* ========================================
          TOASTS
      ======================================== */}

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
        }}
      />

      <Routes>
        {/* ========================================
            PUBLIC ROUTES
        ======================================== */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        <Route
          path="/reset-password/:token"
          element={<ResetPassword />}
        />
        {/* ========================================
            ADMIN ROUTES
        ======================================== */}

        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <div
                className="
                  flex
                  min-h-screen
                  min-h-[100dvh]
                  items-center
                  justify-center
                  bg-gray-50
                  p-6
                  dark:bg-slate-900
                "
              >
                <div
                  className="
                    rounded-2xl
                    border
                    border-gray-200
                    bg-white
                    p-6
                    text-center
                    shadow-sm
                    dark:border-slate-700
                    dark:bg-slate-800
                  "
                >
                  <h1
                    className="
                      text-xl
                      font-bold
                      text-gray-900
                      dark:text-white
                    "
                  >
                    Admin Area
                  </h1>

                  <p
                    className="
                      mt-2
                      text-sm
                      text-gray-500
                      dark:text-gray-400
                    "
                  >
                    Admin-only pages can be added here.
                  </p>
                </div>
              </div>
            </AdminRoute>
          }
        />

        {/* ========================================
            PROTECTED APPLICATION
        ======================================== */}

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* Dashboard */}

          <Route
            index
            element={<Dashboard />}
          />

          {/* ====================================
              INVENTORY
          ===================================== */}

          <Route
            path="inventory/materials"
            element={<Materials />}
          />

          <Route
            path="inventory/bottles"
            element={<Bottles />}
          />

          {/* ====================================
              PRODUCTION
          ===================================== */}

          <Route
            path="production/batches"
            element={<Batches />}
          />

          {/* ====================================
              PRODUCTS
          ===================================== */}

          <Route
            path="products"
            element={<ProductList />}
          />

          <Route
            path="products/new"
            element={<NewProduct />}
          />

          {/* ====================================
              SALES
          ===================================== */}

          <Route
            path="sales"
            element={<SaleList />}
          />

          <Route
            path="sales/new"
            element={<NewSale />}
          />

          <Route
            path="sales/count"
            element={<SalesCount />}
          />

          <Route
            path="sales/by-product"
            element={<SalesByProduct />}
          />

          {/* ====================================
              ORDERS
          ===================================== */}

          <Route
            path="orders"
            element={<Orders />}
          />

          {/* ====================================
              PURCHASES
          ===================================== */}

          <Route
            path="purchases"
            element={<PurchaseList />}
          />

          <Route
            path="purchases/new"
            element={<NewPurchase />}
          />

          {/* ====================================
              EXPENSES
          ===================================== */}

          <Route
            path="expenses"
            element={<ExpensePage />}
          />

          {/* ====================================
              INVESTORS
          ===================================== */}

          <Route
            path="investors"
            element={<Investors />}
          />

          {/* ====================================
              REPORTS
          ===================================== */}

          <Route
            path="reports"
            element={<Reports />}
          />

          {/* ====================================
              WASTAGE
          ===================================== */}

          <Route
            path="wastage"
            element={<WastageList />}
          />

          <Route
            path="wastage/new"
            element={<WastageForm />}
          />
        </Route>

        {/* ========================================
            UNKNOWN ROUTE
        ======================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;