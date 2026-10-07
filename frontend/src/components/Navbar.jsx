import {
  Menu,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import NotificationBell from './NotificationBell';

const Navbar = ({ onToggle }) => {
  const {
    user,
    logout,
  } = useAuth();

  const {
    theme,
    toggleTheme,
  } = useTheme();

  const navigate =
    useNavigate();

  /* ========================================
     LOGOUT
  ======================================== */

  const handleLogout = () => {
    logout();

    navigate('/login', {
      replace: true,
    });
  };

  return (
    <header
      className="
        safe-top

        sticky
        top-0
        z-30

        flex-shrink-0

        border-b
        border-gray-200/80

        bg-white/90

        shadow-sm

        backdrop-blur-xl

        dark:border-slate-800
        dark:bg-slate-900/90
      "
    >
      <div
        className="
          flex
          min-h-[62px]

          items-center
          justify-between

          gap-2

          px-3

          sm:min-h-[68px]
          sm:px-6

          lg:px-8

          xl:px-10
        "
      >
        {/* ====================================
            LEFT SECTION
        ===================================== */}

        <div
          className="
            flex
            min-w-0

            items-center

            gap-2

            sm:gap-3
          "
        >
          {/* Sidebar Toggle */}

          <button
            type="button"
            onClick={onToggle}
            className="
              flex
              h-10
              w-10

              flex-shrink-0

              items-center
              justify-center

              rounded-xl

              text-gray-600

              transition-all

              hover:bg-amber-50
              hover:text-brand-primary

              active:scale-95

              dark:text-gray-300
              dark:hover:bg-slate-800
              dark:hover:text-brand-secondary
            "
            aria-label="Toggle navigation"
          >
            <Menu size={22} />
          </button>

          {/* User */}

          <div
            className="
              flex
              min-w-0

              items-center

              gap-2

              sm:gap-3
            "
          >
            {/* Avatar */}

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

                text-sm
                font-bold
                uppercase

                text-brand-primary

                dark:bg-amber-900/30
                dark:text-brand-secondary

                sm:h-10
                sm:w-10
              "
            >
              {user?.name
                ?.charAt(0)
                ?.toUpperCase() || 'U'}
            </div>

            {/* User Info */}

            <div
              className="
                hidden
                min-w-0

                sm:block
              "
            >
              <p
                className="
                  max-w-[220px]

                  truncate

                  text-sm
                  font-medium
                  leading-tight

                  text-gray-700

                  dark:text-gray-200

                  lg:text-base
                "
              >
                Welcome back,{' '}

                <span
                  className="
                    text-brand-primary

                    dark:text-brand-secondary
                  "
                >
                  {user?.name || 'User'}
                </span>
              </p>

              <p
                className="
                  mt-0.5

                  truncate

                  text-xs
                  capitalize
                  leading-tight

                  text-gray-400

                  dark:text-gray-500
                "
              >
                {user?.role || 'staff'}
              </p>
            </div>
          </div>
        </div>

        {/* ====================================
            RIGHT SECTION
        ===================================== */}

        <div
          className="
            flex
            flex-shrink-0

            items-center

            gap-1

            sm:gap-2
          "
        >
          {/* Notification */}

          <NotificationBell />

          {/* Theme Toggle */}

          <button
            type="button"
            onClick={toggleTheme}
            className="
              flex
              h-10
              w-10

              items-center
              justify-center

              rounded-xl

              text-gray-600

              transition-all

              hover:bg-amber-50
              hover:text-brand-primary

              active:scale-95

              dark:text-gray-300
              dark:hover:bg-slate-800
              dark:hover:text-brand-secondary
            "
            aria-label={
              theme === 'light'
                ? 'Enable dark mode'
                : 'Enable light mode'
            }
            title={
              theme === 'light'
                ? 'Dark mode'
                : 'Light mode'
            }
          >
            {theme === 'light' ? (
              <Moon size={21} />
            ) : (
              <Sun size={21} />
            )}
          </button>

          {/* Logout */}

          <button
            type="button"
            onClick={handleLogout}
            className="
              flex
              h-10

              items-center
              justify-center

              gap-2

              rounded-xl

              bg-red-500

              px-3

              text-sm
              font-medium

              text-white

              shadow-sm

              transition-all

              hover:bg-red-600
              hover:shadow-md

              active:scale-[0.97]

              sm:px-4
            "
            aria-label="Logout"
          >
            <LogOut size={18} />

            <span
              className="
                hidden
                md:inline
              "
            >
              Logout
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;