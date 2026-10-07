import { NavLink } from 'react-router-dom';

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

import { useAuth } from '../context/AuthContext';

const Sidebar = ({
  closeDrawer,
  isDrawer = false,
  collapsed = false,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();

  const linkBase = `
    group
    relative

    flex
    min-h-[44px]
    items-center

    rounded-xl

    px-3
    py-2.5

    text-sm
    font-medium

    transition-all
    duration-200
  `;

  const getLinkClass = ({ isActive }) =>
    `${linkBase} ${
      isActive
        ? `
          bg-amber-50
          text-brand-primary

          dark:bg-amber-900/20
          dark:text-brand-secondary
        `
        : `
          text-gray-600

          hover:bg-gray-100
          hover:text-brand-primary

          dark:text-gray-300
          dark:hover:bg-slate-800
          dark:hover:text-brand-secondary
        `
    }`;

  const iconClass = `
    h-5
    w-5
    flex-shrink-0
  `;

  const textClass = collapsed
    ? 'hidden'
    : 'ml-3 truncate';

  const handleLinkClick = () => {
    if (isDrawer && closeDrawer) {
      closeDrawer();
    }
  };

  const handleLogout = () => {
    if (isDrawer && closeDrawer) {
      closeDrawer();
    }

    logout();
  };

  return (
    <div
      className="
        flex
        h-full
        flex-col

        border-r
        border-gray-200

        bg-white

        dark:border-slate-800
        dark:bg-slate-900
      "
    >
      {/* ========================================
          LOGO
      ======================================== */}

      <div
        className={`
          flex
          min-h-[72px]
          items-center

          border-b
          border-gray-200

          px-3

          dark:border-slate-800

          ${
            collapsed && !isDrawer
              ? 'justify-center'
              : 'justify-between'
          }
        `}
      >
        <div
          className={`
            flex
            min-w-0
            items-center

            ${
              collapsed && !isDrawer
                ? 'justify-center'
                : ''
            }
          `}
        >
          <img
            src="/logo.png"
            alt="LUXE"
            className="
              h-11
              w-11
              flex-shrink-0

              rounded-xl

              object-cover

              shadow-sm
            "
          />

          {!collapsed && (
            <div className="ml-3 min-w-0">
              <p
                className="
                  truncate
                  font-serif
                  text-lg
                  font-bold
                  tracking-wide

                  text-brand-primary

                  dark:text-brand-secondary
                "
              >
                LUXE
              </p>

              <p
                className="
                  truncate
                  text-[10px]
                  uppercase
                  tracking-[0.15em]

                  text-gray-400

                  dark:text-gray-500
                "
              >
                Perfume Management
              </p>
            </div>
          )}
        </div>

        {isDrawer && (
          <button
            type="button"
            onClick={closeDrawer}
            className="
              ml-2

              flex
              h-9
              w-9
              flex-shrink-0
              items-center
              justify-center

              rounded-xl

              text-gray-500

              transition-colors

              hover:bg-gray-100
              hover:text-gray-800

              dark:text-gray-400
              dark:hover:bg-slate-800
              dark:hover:text-white
            "
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* ========================================
          NAVIGATION
      ======================================== */}

      <nav
        className="
          flex-1
          overflow-y-auto

          px-3
          py-4

          space-y-1
        "
      >
        <NavLink
          to="/"
          end
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <BarChart3 className={iconClass} />
          <span className={textClass}>
            Dashboard
          </span>
        </NavLink>

        {/* Inventory */}

        {!collapsed && (
          <p
            className="
              px-3
              pb-1
              pt-4

              text-[10px]
              font-semibold
              uppercase
              tracking-wider

              text-gray-400

              dark:text-gray-500
            "
          >
            Inventory
          </p>
        )}

        <NavLink
          to="/inventory/materials"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <FlaskRound className={iconClass} />
          <span className={textClass}>
            Raw Materials
          </span>
        </NavLink>

        <NavLink
          to="/inventory/bottles"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Beaker className={iconClass} />
          <span className={textClass}>
            Bottles
          </span>
        </NavLink>

        {/* Production */}

        {!collapsed && (
          <p
            className="
              px-3
              pb-1
              pt-4

              text-[10px]
              font-semibold
              uppercase
              tracking-wider

              text-gray-400

              dark:text-gray-500
            "
          >
            Production
          </p>
        )}

        <NavLink
          to="/production/batches"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <ClipboardList className={iconClass} />
          <span className={textClass}>
            Batches
          </span>
        </NavLink>

        <NavLink
          to="/products"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Sparkles className={iconClass} />
          <span className={textClass}>
            Products
          </span>
        </NavLink>

        <NavLink
          to="/products/new"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Plus className={iconClass} />
          <span className={textClass}>
            New Product
          </span>
        </NavLink>

        {/* Sales */}

        {!collapsed && (
          <p
            className="
              px-3
              pb-1
              pt-4

              text-[10px]
              font-semibold
              uppercase
              tracking-wider

              text-gray-400

              dark:text-gray-500
            "
          >
            Sales
          </p>
        )}

        <NavLink
          to="/sales"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <DollarSign className={iconClass} />
          <span className={textClass}>
            Sales
          </span>
        </NavLink>

        <NavLink
          to="/sales/new"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Plus className={iconClass} />
          <span className={textClass}>
            New Sale
          </span>
        </NavLink>

        <NavLink
          to="/sales/count"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <TrendingUp className={iconClass} />
          <span className={textClass}>
            Sales Count
          </span>
        </NavLink>

        <NavLink
          to="/sales/by-product"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Package className={iconClass} />
          <span className={textClass}>
            Sales by Product
          </span>
        </NavLink>

        <NavLink
          to="/orders"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <ShoppingBag className={iconClass} />
          <span className={textClass}>
            Orders
          </span>
        </NavLink>

        {/* Finance */}

        {!collapsed && (
          <p
            className="
              px-3
              pb-1
              pt-4

              text-[10px]
              font-semibold
              uppercase
              tracking-wider

              text-gray-400

              dark:text-gray-500
            "
          >
            Finance
          </p>
        )}

        <NavLink
          to="/purchases"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <ShoppingCart className={iconClass} />
          <span className={textClass}>
            Purchases
          </span>
        </NavLink>

        <NavLink
          to="/expenses"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Receipt className={iconClass} />
          <span className={textClass}>
            Expenses
          </span>
        </NavLink>

        <NavLink
          to="/investors"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Users className={iconClass} />
          <span className={textClass}>
            Investors
          </span>
        </NavLink>

        <NavLink
          to="/reports"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <FileText className={iconClass} />
          <span className={textClass}>
            Reports
          </span>
        </NavLink>

        {/* Wastage */}

        {!collapsed && (
          <p
            className="
              px-3
              pb-1
              pt-4

              text-[10px]
              font-semibold
              uppercase
              tracking-wider

              text-gray-400

              dark:text-gray-500
            "
          >
            Wastage
          </p>
        )}

        <NavLink
          to="/wastage"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Trash2 className={iconClass} />
          <span className={textClass}>
            Wastage History
          </span>
        </NavLink>

        <NavLink
          to="/wastage/new"
          className={getLinkClass}
          onClick={handleLinkClick}
        >
          <Plus className={iconClass} />
          <span className={textClass}>
            Record Wastage
          </span>
        </NavLink>

        {/* Admin */}

        {user?.role === 'admin' && (
          <>
            {!collapsed && (
              <p
                className="
                  px-3
                  pb-1
                  pt-4

                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wider

                  text-gray-400

                  dark:text-gray-500
                "
              >
                Administration
              </p>
            )}

            <NavLink
              to="/register"
              className={getLinkClass}
              onClick={handleLinkClick}
            >
              <UserPlus className={iconClass} />

              <span className={textClass}>
                Register User
              </span>
            </NavLink>
          </>
        )}
      </nav>

      {/* ========================================
          USER / FOOTER
      ======================================== */}

      <div
        className="
          border-t
          border-gray-200

          p-3

          dark:border-slate-800
        "
      >
        {user && !collapsed && (
          <div
            className="
              mb-2

              flex
              items-center
              gap-3

              rounded-xl

              bg-gray-50

              p-2.5

              dark:bg-slate-800/60
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

                bg-amber-100

                font-bold
                text-brand-primary

                dark:bg-amber-900/30
                dark:text-brand-secondary
              "
            >
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>

            <div className="min-w-0 flex-1">
              <p
                className="
                  truncate
                  text-sm
                  font-semibold

                  text-gray-700

                  dark:text-gray-200
                "
              >
                {user.name}
              </p>

              <p
                className="
                  truncate
                  text-xs
                  capitalize

                  text-gray-400

                  dark:text-gray-500
                "
              >
                {user.role || 'staff'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="
                flex
                h-9
                w-9
                flex-shrink-0
                items-center
                justify-center

                rounded-xl

                text-gray-400

                transition-colors

                hover:bg-red-50
                hover:text-red-600

                dark:text-gray-500
                dark:hover:bg-red-900/20
                dark:hover:text-red-400
              "
              aria-label="Logout"
              title="Logout"
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
              flex
              h-10
              w-full
              items-center
              justify-center

              rounded-xl

              text-gray-400

              transition-colors

              hover:bg-amber-50
              hover:text-brand-primary

              dark:text-gray-500
              dark:hover:bg-amber-900/20
              dark:hover:text-brand-secondary
            "
            aria-label={
              collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
          >
            {collapsed ? (
              <ChevronRight size={19} />
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