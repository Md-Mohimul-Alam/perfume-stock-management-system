import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, ChevronLeft, ChevronRight, LogOut, User } from 'lucide-react';

const Sidebar = ({
  closeDrawer,
  isDrawer = false,
  collapsed = false,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();

  const linkClass =
    'flex items-center px-4 py-2.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200 group relative';
  const activeClass = 'bg-indigo-50 text-indigo-700 font-medium shadow-sm';

  const handleLinkClick = () => {
    if (isDrawer && closeDrawer) closeDrawer();
  };

  const linkTextClass = collapsed ? 'hidden' : 'ml-3 text-sm';
  const iconClass = 'flex-shrink-0 w-5 h-5';

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-100 shadow-sm transition-all duration-300">
      {/* Logo */}
      <div
        className={`flex items-center ${isDrawer ? 'justify-between' : 'justify-center'} px-4 py-4 border-b border-gray-100`}
      >
        {!collapsed || isDrawer ? (
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="LuxePerfume Logo" className="h-10 w-10 rounded-full object-cover border border-indigo-100" />
            {!collapsed && !isDrawer && (
              <span className="text-lg font-serif font-bold text-indigo-800 tracking-wide">LuxePerfume</span>
            )}
          </div>
        ) : (
          <img src="/logo.jpg" alt="LuxePerfume Logo" className="h-10 w-10 rounded-full object-cover border border-indigo-100" />
        )}
        {isDrawer && (
          <button
            onClick={closeDrawer}
            className="p-1 rounded-lg hover:bg-gray-100 transition"
            aria-label="Close sidebar"
          >
            <X size={22} className="text-gray-500" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''}`
          }
          end
          onClick={handleLinkClick}
        >
          <span className={iconClass}>📊</span>
          <span className={linkTextClass}>Dashboard</span>
        </NavLink>

        <NavLink
          to="/inventory/materials"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>🧴</span>
          <span className={linkTextClass}>Raw Materials</span>
        </NavLink>

        <NavLink
          to="/inventory/bottles"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>🧪</span>
          <span className={linkTextClass}>Bottles</span>
        </NavLink>

        <NavLink
          to="/production/batches"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''} ${!collapsed ? 'pl-9' : 'pl-4'}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>📋</span>
          <span className={linkTextClass}>Batches</span>
        </NavLink>

        <NavLink
          to="/products"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>✨</span>
          <span className={linkTextClass}>Products</span>
        </NavLink>

        <NavLink
          to="/products/new"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''} ${!collapsed ? 'pl-9' : 'pl-4'}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>➕</span>
          <span className={linkTextClass}>New Product</span>
        </NavLink>

        <NavLink
          to="/sales"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>💰</span>
          <span className={linkTextClass}>Sales</span>
        </NavLink>

        <NavLink
          to="/sales/new"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''} ${!collapsed ? 'pl-9' : 'pl-4'}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>➕</span>
          <span className={linkTextClass}>New Sale</span>
        </NavLink>

        <NavLink
          to="/purchases"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>📦</span>
          <span className={linkTextClass}>Purchases</span>
        </NavLink>

        <NavLink
          to="/expenses"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>🧾</span>
          <span className={linkTextClass}>Expenses</span>
        </NavLink>

        <NavLink
          to="/investors"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>👥</span>
          <span className={linkTextClass}>Investors</span>
        </NavLink>

        <NavLink
          to="/reports"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>📈</span>
          <span className={linkTextClass}>Reports</span>
        </NavLink>

        {/* Wastage section */}
        <div className="my-2 border-t border-gray-100" />
        <NavLink
          to="/wastage"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>🗑️</span>
          <span className={linkTextClass}>Wastage History</span>
        </NavLink>

        <NavLink
          to="/wastage/new"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ''} ${!collapsed ? 'pl-9' : 'pl-4'}`
          }
          onClick={handleLinkClick}
        >
          <span className={iconClass}>➕</span>
          <span className={linkTextClass}>Record Wastage</span>
        </NavLink>

        {user?.role === 'admin' && (
          <>
            <div className="my-2 border-t border-gray-100" />
            <NavLink
              to="/register"
              className={({ isActive }) =>
                `${linkClass} ${isActive ? activeClass : ''}`
              }
              onClick={handleLinkClick}
            >
              <span className={iconClass}>👤</span>
              <span className={linkTextClass}>Register User</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Bottom section: user profile & toggle */}
      <div className="border-t border-gray-100 p-3 space-y-2">
        {user && !collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.role || 'Staff'}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        {!isDrawer && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center py-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span className="ml-2 text-xs font-medium">Collapse</span>}
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;