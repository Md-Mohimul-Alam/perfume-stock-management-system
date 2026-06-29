import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
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
import ProductList from './pages/Products/ProductList';
import NewProduct from './pages/Products/NewProduct';
import ExpensePage from './pages/Expenses/Expenses';
import NewPurchase from './pages/Purchases/NewPurchase';
import PurchaseList from './pages/Purchases/PurchaseList';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Public registration */}
          <Route path="/register" element={<Register />} />

          {/* Admin-only routes */}
          <Route path="/admin/*" element={<AdminRoute><div>Admin area</div></AdminRoute>} />

          {/* Protected routes */}
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="inventory/materials" element={<Materials />} />
            <Route path="inventory/bottles" element={<Bottles />} />
            <Route path="production/batches" element={<Batches />} />
            <Route path="products" element={<ProductList />} />
            <Route path="products/new" element={<NewProduct />} />
            <Route path="sales" element={<SaleList />} />          
            <Route path="sales/new" element={<NewSale />} />   
            <Route path="purchases" element={<PurchaseList />} />
            <Route path="purchases/new" element={<NewPurchase />} />
            <Route path="expenses" element={<ExpensePage />} />
            <Route path="investors" element={<div>Investors Page</div>} />
            <Route path="reports" element={<div>Reports Page</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;