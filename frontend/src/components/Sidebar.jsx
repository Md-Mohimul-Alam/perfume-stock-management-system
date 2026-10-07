import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import {
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  BarChart3,
  FlaskRound,
  Beaker,
  ClipboardList,
  Sparkles,
  Plus,
  DollarSign,
  ShoppingCart,
  Receipt,
  Users,
  FileText,
  Trash2,
  UserPlus,
  Package,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react';

const Sidebar = ({
  closeDrawer,
  isDrawer = false,
  collapsed = false,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();

  const linkClass = `
    flex items-center
    min-h-[44px]
    px-4
    py-2.5
    rounded-lg
    text-gray-600
    dark:text-gray-300
    hover:text-indigo-600
    dark:hover:text-indigo-400
    hover:bg-indigo-50
    dark:hover:bg-indigo-900/30
    transition-all
    duration-200
    group
    relative
  `;

  const activeClass = `
    bg-indigo-50
    dark:bg-indigo-900/40
    text-indigo-700
    dark:text-indigo-300
    font-medium
    shadow-sm
  `;

  const iconClass = 'w-5 h-5 flex-shrink-0';

  const linkTextClass = collapsed
    ? 'hidden'
    : 'ml-3 text-sm leading-none whitespace-nowrap';

  const handleLinkClick = () => {
    if (isDrawer && closeDrawer) {
      closeDrawer();
    }
  };

  const getLinkClass = ({ isActive }) =>
    `${linkClass} ${isActive ? activeClass : ''}`;

  return (
    <div
      className="
        h-full
        flex
        flex-col
        bg-white
        dark:bg-gray-900
        border-r
        border-gray-100
        dark:border-gray-800
        shadow-sm
      "
    >
      {/* Header / Logo */}
      <div
        className={`
          flex
          items-center
          h-[72px]
          px-4
          border-b
          border-gray-100
          dark:border-gray-800

          ${
            collapsed && !isDrawer
              ? 'justify-center'
              : 'justify-between'
          }
        `}
      >
        <div className="flex items-center min-w-0">
          <img
            src="/logo.png"
            alt="LuxePerfume Logo"
            className="
              h-10
              w-10
              flex-shrink-0
              rounded-full
              object-cover
              border
              border-indigo-100
              dark:border-indigo-800/40
            "
          />

          {!collapsed && (
            <span
              className="
                ml-3
                truncate
                text-lg
                font-serif
                font-bold
                tracking-wide
                text-indigo-800
                dark:text-indigo-400
              "
            >
              LuxePerfume
            </span>
          )}
        </div>

        {isDrawer && (
          <button
            type="button"
            onClick={closeDrawer}
            className="
              ml-3
              flex
              h-9
              w-9
              flex-shrink-0
              items-center
              justify-center
              rounded-lg
              text-gray-500
              hover:bg-gray-100
              dark:text-gray-400
              dark:hover:bg-gray-800
            "
            aria-label="Close sidebar"
          >
            <X size={21} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavLink
          to="/"
          end
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <BarChart3 className={iconClass} />
          <span className={linkTextClass}>Dashboard</span>
        </NavLink>

        <NavLink
          to="/inventory/materials"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <FlaskRound className={iconClass} />
          <span className={linkTextClass}>Raw Materials</span>
        </NavLink>

        <NavLink
          to="/inventory/bottles"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Beaker className={iconClass} />
          <span className={linkTextClass}>Bottles</span>
        </NavLink>

        <NavLink
          to="/production/batches"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <ClipboardList className={iconClass} />
          <span className={linkTextClass}>Batches</span>
        </NavLink>

        <NavLink
          to="/products"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Sparkles className={iconClass} />
          <span className={linkTextClass}>Products</span>
        </NavLink>

        <NavLink
          to="/products/new"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Plus className={iconClass} />
          <span className={linkTextClass}>New Product</span>
        </NavLink>

        <NavLink
          to="/sales"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <DollarSign className={iconClass} />
          <span className={linkTextClass}>Sales</span>
        </NavLink>

        <NavLink
          to="/sales/new"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Plus className={iconClass} />
          <span className={linkTextClass}>New Sale</span>
        </NavLink>

        <NavLink
          to="/sales/count"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <TrendingUp className={iconClass} />
          <span className={linkTextClass}>Sales Count</span>
        </NavLink>

        <NavLink
          to="/sales/by-product"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Package className={iconClass} />
          <span className={linkTextClass}>Sales by Product</span>
        </NavLink>

        <NavLink
          to="/orders"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <ShoppingBag className={iconClass} />
          <span className={linkTextClass}>Orders</span>
        </NavLink>

        <NavLink
          to="/purchases"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <ShoppingCart className={iconClass} />
          <span className={linkTextClass}>Purchases</span>
        </NavLink>

        <NavLink
          to="/expenses"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Receipt className={iconClass} />
          <span className={linkTextClass}>Expenses</span>
        </NavLink>

        <NavLink
          to="/investors"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Users className={iconClass} />
          <span className={linkTextClass}>Investors</span>
        </NavLink>

        <NavLink
          to="/reports"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <FileText className={iconClass} />
          <span className={linkTextClass}>Reports</span>
        </NavLink>

        <div className="my-2 border-t border-gray-100 dark:border-gray-800" />

        <NavLink
          to="/wastage"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Trash2 className={iconClass} />
          <span className={linkTextClass}>Wastage History</span>
        </NavLink>

        <NavLink
          to="/wastage/new"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Plus className={iconClass} />
          <span className={linkTextClass}>Record Wastage</span>
        </NavLink>

        {user?.role === 'admin' && (
          <>
            <div className="my-2 border-t border-gray-100 dark:border-gray-800" />

            <NavLink
              to="/register"
              className={getLinkClass}
              onClick={handleLinkClick}
            >
              <UserPlus className={iconClass} />
              <span className={linkTextClass}>Register User</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-3">
        {user && !collapsed && (
          <div
            className="
              flex
              items-center
              gap-3
              rounded-lg
              px-2
              py-2
              hover:bg-gray-50
              dark:hover:bg-gray-800/60
            "
          >
            <div
              className="
                flex
                h-9
                w-9
                flex-shrink-0
                items-center
                justify-center
                rounded-full
                bg-indigo-100
                font-semibold
                text-indigo-700
                dark:bg-indigo-900/40
                dark:text-indigo-300
              "
            >
              {user.name?.charAt(0) || 'U'}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                {user.name}
              </p>

              <p className="truncate text-xs capitalize text-gray-400 dark:text-gray-500">
                {user.role || 'staff'}
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              className="
                flex
                h-9
                w-9
                flex-shrink-0
                items-center
                justify-center
                rounded-lg
                text-gray-400
                hover:bg-red-50
                hover:text-red-600
                dark:text-gray-500
                dark:hover:bg-red-900/30
                dark:hover:text-red-400
              "
              aria-label="Logout"
            >
              <LogOut size={17} />
            </button>
          </div>
        )}

        {!isDrawer && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="
              mt-2
              flex
              w-full
              items-center
              justify-center
              rounded-lg
              py-2
              text-gray-400
              hover:bg-indigo-50
              hover:text-indigo-600
              dark:text-gray-500
              dark:hover:bg-indigo-900/30
              dark:hover:text-indigo-400
            "
            aria-label={
              collapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
          >
            {collapsed ? (
              <ChevronRight size={18} />
            ) : (
              <>
                <ChevronLeft size={18} />
                <span className="ml-2 text-xs font-medium">
                  Collapse
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;