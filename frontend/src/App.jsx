import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

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
      <Toaster position="top-right" />

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Admin-only routes */}
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <div>Admin area</div>
            </AdminRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />

          {/* Inventory */}
          <Route path="inventory/materials" element={<Materials />} />
          <Route path="inventory/bottles" element={<Bottles />} />

          {/* Production */}
          <Route path="production/batches" element={<Batches />} />

          {/* Products */}
          <Route path="products" element={<ProductList />} />
          <Route path="products/new" element={<NewProduct />} />

          {/* Sales */}
          <Route path="sales" element={<SaleList />} />
          <Route path="sales/new" element={<NewSale />} />
          <Route path="sales/count" element={<SalesCount />} />
          <Route path="sales/by-product" element={<SalesByProduct />} />

          {/* Orders */}
          <Route path="orders" element={<Orders />} />

          {/* Purchases */}
          <Route path="purchases" element={<PurchaseList />} />
          <Route path="purchases/new" element={<NewPurchase />} />

          {/* Expenses */}
          <Route path="expenses" element={<ExpensePage />} />

          {/* Investors */}
          <Route path="investors" element={<Investors />} />

          {/* Reports */}
          <Route path="reports" element={<Reports />} />

          {/* Wastage */}
          <Route path="wastage" element={<WastageList />} />
          <Route path="wastage/new" element={<WastageForm />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;