import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user } = useAuth();

  const linkClass =
    'flex items-center px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition-colors duration-150';
  const activeClass = 'bg-gray-200 font-semibold text-blue-600';

  return (
    <div className="w-64 bg-white shadow-md h-screen overflow-y-auto">
      <div className="p-4 text-xl font-bold text-blue-600 border-b">LuxePerfume</div>
      <nav className="mt-4 space-y-1 px-2">
        <NavLink
          to="/"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          end
        >
          <span className="mr-3">📊</span>
          Dashboard
        </NavLink>

        <NavLink
          to="/inventory/materials"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
        >
          <span className="mr-3">🧴</span>
          Raw Materials
        </NavLink>

        {/* Bottles group */}
        <NavLink
          to="/inventory/bottles"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
        >
          <span className="mr-3">🧪</span>
          Bottles
        </NavLink>

        {/* Batches now under Bottles */}
        <NavLink
          to="/production/batches"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''} ml-6 text-sm`}
        >
          <span className="mr-3">📋</span>
          Batches
        </NavLink>

        <NavLink
          to="/products"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
        >
          <span className="mr-3">✨</span>
          Products
        </NavLink>

        <NavLink
          to="/products/new"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''} ml-6 text-sm`}
        >
          <span className="mr-3">➕</span>
          New Product
        </NavLink>

        <NavLink
          to="/sales"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
        >
          <span className="mr-3">💰</span>
          Sales
        </NavLink>

        <NavLink
          to="/sales/new"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''} ml-6 text-sm`}
        >
          <span className="mr-3">➕</span>
          New Sale
        </NavLink>

        <NavLink
          to="/purchases"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
        >
          <span className="mr-3">📦</span>
          Purchases
        </NavLink>

        <NavLink
          to="/expenses"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
        >
          <span className="mr-3">🧾</span>
          Expenses
        </NavLink>

        <NavLink
          to="/investors"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
        >
          <span className="mr-3">👥</span>
          Investors
        </NavLink>

        <NavLink
          to="/reports"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
        >
          <span className="mr-3">📈</span>
          Reports
        </NavLink>

        {/* Admin-only registration link */}
        {user?.role === 'admin' && (
          <NavLink
            to="/register"
            className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          >
            <span className="mr-3">👤</span>
            Register User
          </NavLink>
        )}
      </nav>
    </div>
  );
};

export default Sidebar;