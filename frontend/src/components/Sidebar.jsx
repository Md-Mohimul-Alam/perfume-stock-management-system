import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';

const Sidebar = ({ closeDrawer, isDrawer = false }) => {
  const { user } = useAuth();

  const linkClass =
    'flex items-center px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition-colors duration-150';
  const activeClass = 'bg-gray-200 font-semibold text-blue-600';

  const handleLinkClick = () => {
    if (isDrawer && closeDrawer) closeDrawer();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Logo & close button (only in drawer) */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center">
          <img src="/logo.jpg" alt="LuxePerfume Logo" className="h-10 w-10" />
          <span className="ml-2 text-lg font-bold text-blue-800">LuxePerfume</span>
        </div>
        {isDrawer && (
          <button
            onClick={closeDrawer}
            className="p-1 rounded hover:bg-gray-100"
            aria-label="Close sidebar"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto mt-4 space-y-1 px-2">
        <NavLink
          to="/"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          end
          onClick={handleLinkClick}
        >
          <span className="mr-3">📊</span>
          Dashboard
        </NavLink>

        <NavLink
          to="/inventory/materials"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">🧴</span>
          Raw Materials
        </NavLink>

        <NavLink
          to="/inventory/bottles"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">🧪</span>
          Bottles
        </NavLink>

        <NavLink
          to="/production/batches"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''} ml-6 text-sm`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">📋</span>
          Batches
        </NavLink>

        <NavLink
          to="/products"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">✨</span>
          Products
        </NavLink>

        <NavLink
          to="/products/new"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''} ml-6 text-sm`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">➕</span>
          New Product
        </NavLink>

        <NavLink
          to="/sales"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">💰</span>
          Sales
        </NavLink>

        <NavLink
          to="/sales/new"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''} ml-6 text-sm`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">➕</span>
          New Sale
        </NavLink>

        <NavLink
          to="/purchases"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">📦</span>
          Purchases
        </NavLink>

        <NavLink
          to="/expenses"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">🧾</span>
          Expenses
        </NavLink>

        <NavLink
          to="/investors"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">👥</span>
          Investors
        </NavLink>

        <NavLink
          to="/reports"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className="mr-3">📈</span>
          Reports
        </NavLink>

        {user?.role === 'admin' && (
          <NavLink
            to="/register"
            className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
            onClick={handleLinkClick}
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