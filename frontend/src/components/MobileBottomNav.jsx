import { NavLink } from 'react-router-dom';
import {
  Home,
  Package,
  DollarSign,
  ShoppingBag,
  Menu,
} from 'lucide-react';

const MobileBottomNav = ({ onMore }) => {
  const baseClass =
    'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors duration-200';

  const getLinkClass = ({ isActive }) =>
    `${baseClass} ${
      isActive
        ? 'text-indigo-600 dark:text-indigo-400'
        : 'text-gray-500 dark:text-gray-400'
    }`;

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-40
        flex items-center
        border-t border-gray-200
        bg-white/95
        px-1
        pb-[env(safe-area-inset-bottom)]
        shadow-[0_-4px_18px_rgba(0,0,0,0.06)]
        backdrop-blur-xl

        dark:border-gray-800
        dark:bg-gray-950/95

        lg:hidden
      "
    >
      {/* Home */}
      <NavLink
        to="/"
        end
        className={getLinkClass}
      >
        <Home size={21} />
        <span>Home</span>
      </NavLink>

      {/* Products */}
      <NavLink
        to="/products"
        className={getLinkClass}
      >
        <Package size={21} />
        <span>Products</span>
      </NavLink>

      {/* Sales */}
      <NavLink
        to="/sales"
        className={getLinkClass}
      >
        <DollarSign size={21} />
        <span>Sales</span>
      </NavLink>

      {/* Orders */}
      <NavLink
        to="/orders"
        className={getLinkClass}
      >
        <ShoppingBag size={21} />
        <span>Orders</span>
      </NavLink>

      {/* More */}
      <button
        type="button"
        onClick={onMore}
        className={`${baseClass} text-gray-500 dark:text-gray-400`}
        aria-label="Open more navigation"
      >
        <Menu size={21} />
        <span>More</span>
      </button>
    </nav>
  );
};

export default MobileBottomNav;