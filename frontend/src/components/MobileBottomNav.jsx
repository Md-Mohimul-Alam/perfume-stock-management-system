import { NavLink } from 'react-router-dom';

import {
  Home,
  Package,
  DollarSign,
  ShoppingBag,
  Menu,
} from 'lucide-react';

const MobileBottomNav = ({ onMore }) => {
  const baseClass = `
    relative

    flex
    min-w-0
    flex-col
    items-center
    justify-center

    gap-1

    rounded-xl

    px-1
    py-2

    text-[10px]
    font-medium
    leading-none

    transition-colors
    duration-200
  `;

  const getLinkClass = ({ isActive }) =>
    `${baseClass} ${
      isActive
        ? `
          bg-amber-50
          text-brand-primary

          dark:bg-amber-900/20
          dark:text-brand-secondary
        `
        : `
          text-gray-500
          hover:text-brand-primary

          dark:text-gray-400
          dark:hover:text-brand-secondary
        `
    }`;

  return (
    <nav
      className="
        mobile-bottom-safe

        fixed
        bottom-0
        left-0
        right-0
        z-40

        border-t
        border-gray-200/80

        bg-white/95
        backdrop-blur-xl

        shadow-[0_-6px_24px_rgba(0,0,0,0.06)]

        dark:border-slate-800
        dark:bg-slate-950/95

        lg:hidden
      "
      aria-label="Mobile navigation"
    >
      <div
        className="
          grid
          min-h-[58px]
          grid-cols-5
          items-center

          gap-1

          px-2
          pt-1
        "
      >
        {/* Home */}
        <NavLink
          to="/"
          end
          className={getLinkClass}
        >
          {({ isActive }) => (
            <>
              <Home
                size={21}
                strokeWidth={isActive ? 2.4 : 2}
              />

              <span className="truncate">
                Home
              </span>

              {isActive && (
                <span
                  className="
                    absolute
                    -bottom-1
                    left-1/2

                    h-1
                    w-1

                    -translate-x-1/2

                    rounded-full
                    bg-brand-primary
                  "
                />
              )}
            </>
          )}
        </NavLink>

        {/* Products */}
        <NavLink
          to="/products"
          className={getLinkClass}
        >
          {({ isActive }) => (
            <>
              <Package
                size={21}
                strokeWidth={isActive ? 2.4 : 2}
              />

              <span className="truncate">
                Products
              </span>

              {isActive && (
                <span
                  className="
                    absolute
                    -bottom-1
                    left-1/2

                    h-1
                    w-1

                    -translate-x-1/2

                    rounded-full
                    bg-brand-primary
                  "
                />
              )}
            </>
          )}
        </NavLink>

        {/* Sales */}
        <NavLink
          to="/sales"
          className={getLinkClass}
        >
          {({ isActive }) => (
            <>
              <DollarSign
                size={21}
                strokeWidth={isActive ? 2.4 : 2}
              />

              <span className="truncate">
                Sales
              </span>

              {isActive && (
                <span
                  className="
                    absolute
                    -bottom-1
                    left-1/2

                    h-1
                    w-1

                    -translate-x-1/2

                    rounded-full
                    bg-brand-primary
                  "
                />
              )}
            </>
          )}
        </NavLink>

        {/* Orders */}
        <NavLink
          to="/orders"
          className={getLinkClass}
        >
          {({ isActive }) => (
            <>
              <ShoppingBag
                size={21}
                strokeWidth={isActive ? 2.4 : 2}
              />

              <span className="truncate">
                Orders
              </span>

              {isActive && (
                <span
                  className="
                    absolute
                    -bottom-1
                    left-1/2

                    h-1
                    w-1

                    -translate-x-1/2

                    rounded-full
                    bg-brand-primary
                  "
                />
              )}
            </>
          )}
        </NavLink>

        {/* More */}
        <button
          type="button"
          onClick={onMore}
          className={`
            ${baseClass}

            text-gray-500

            hover:bg-amber-50
            hover:text-brand-primary

            dark:text-gray-400

            dark:hover:bg-amber-900/20
            dark:hover:text-brand-secondary
          `}
          aria-label="Open more navigation"
        >
          <Menu
            size={21}
            strokeWidth={2}
          />

          <span className="truncate">
            More
          </span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;