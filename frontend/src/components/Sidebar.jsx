import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = ({ 
  closeDrawer, 
  isDrawer = false, 
  collapsed = false, 
  onToggleCollapse 
}) => {
  const { user } = useAuth();

  const linkClass =
    'flex items-center px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition-colors duration-150';
  const activeClass = 'bg-gray-200 font-semibold text-blue-600';

  const handleLinkClick = () => {
    if (isDrawer && closeDrawer) closeDrawer();
  };

  // When collapsed, hide the text and reduce padding
  const linkTextClass = collapsed ? 'hidden' : 'ml-3';
  const iconClass = 'flex-shrink-0';

  return (
    <div className="h-full flex flex-col bg-white transition-all duration-300">
      {/* Logo & close button (drawer only) */}
      <div className={`flex items-center ${isDrawer ? 'justify-between' : 'justify-center'} px-4 py-3 border-b border-gray-200`}>
        {!collapsed || isDrawer ? (
          <div className="flex items-center">
            <img src="/logo.jpg" alt="LuxePerfume Logo" className="h-10 w-10" />
            {!collapsed && !isDrawer && (
              <span className="ml-2 text-lg font-bold text-blue-800">LuxePerfume</span>
            )}
          </div>
        ) : (
          <img src="/logo.jpg" alt="LuxePerfume Logo" className="h-10 w-10" />
        )}
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
          <span className={iconClass}>📊</span>
          <span className={linkTextClass}>Dashboard</span>
        </NavLink>

        <NavLink
          to="/inventory/materials"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>🧴</span>
          <span className={linkTextClass}>Raw Materials</span>
        </NavLink>

        <NavLink
          to="/inventory/bottles"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>🧪</span>
          <span className={linkTextClass}>Bottles</span>
        </NavLink>

        <NavLink
          to="/production/batches"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''} ${!collapsed ? 'ml-6' : ''} text-sm`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>📋</span>
          <span className={linkTextClass}>Batches</span>
        </NavLink>

        <NavLink
          to="/products"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>✨</span>
          <span className={linkTextClass}>Products</span>
        </NavLink>

        <NavLink
          to="/products/new"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''} ${!collapsed ? 'ml-6' : ''} text-sm`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>➕</span>
          <span className={linkTextClass}>New Product</span>
        </NavLink>

        <NavLink
          to="/sales"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>💰</span>
          <span className={linkTextClass}>Sales</span>
        </NavLink>

        <NavLink
          to="/sales/new"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''} ${!collapsed ? 'ml-6' : ''} text-sm`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>➕</span>
          <span className={linkTextClass}>New Sale</span>
        </NavLink>

        <NavLink
          to="/purchases"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>📦</span>
          <span className={linkTextClass}>Purchases</span>
        </NavLink>

        <NavLink
          to="/expenses"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>🧾</span>
          <span className={linkTextClass}>Expenses</span>
        </NavLink>

        <NavLink
          to="/investors"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>👥</span>
          <span className={linkTextClass}>Investors</span>
        </NavLink>

        <NavLink
          to="/reports"
          className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
          onClick={handleLinkClick}
        >
          <span className={iconClass}>📈</span>
          <span className={linkTextClass}>Reports</span>
        </NavLink>

        {user?.role === 'admin' && (
          <NavLink
            to="/register"
            className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
            onClick={handleLinkClick}
          >
            <span className={iconClass}>👤</span>
            <span className={linkTextClass}>Register User</span>
          </NavLink>
        )}
      </nav>

      {/* Toggle button – only visible on desktop (not in drawer) */}
      {!isDrawer && onToggleCollapse && (
        <div className="border-t border-gray-200 p-2">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center py-2 text-gray-500 hover:bg-gray-100 rounded transition"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;