import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  Menu,
  LogOut,
  Bell,
  AlertCircle,
  Package,
  DollarSign,
  Sun,
  Moon,
  X,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/* ========================================
   NOTIFICATION BELL
======================================== */

const NotificationBell = ({ notifications = [] }) => {
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, []);

  const totalUnread = notifications.filter(
    (notification) => !notification.read
  ).length;

  const getIcon = (type) => {
    switch (type) {
      case 'warning':
        return (
          <AlertCircle className="h-4 w-4 text-amber-500" />
        );

      case 'due':
        return (
          <DollarSign className="h-4 w-4 text-red-500" />
        );

      default:
        return (
          <Package className="h-4 w-4 text-blue-500" />
        );
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="
          relative
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-xl

          text-gray-600
          transition-colors

          hover:bg-gray-100
          hover:text-brand-primary

          dark:text-gray-300
          dark:hover:bg-slate-800
          dark:hover:text-brand-secondary
        "
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={21} />

        {totalUnread > 0 && (
          <span
            className="
              absolute
              -right-0.5
              -top-0.5

              flex
              h-5
              min-w-5
              items-center
              justify-center

              rounded-full
              bg-red-500

              px-1

              text-[10px]
              font-bold
              leading-none
              text-white
            "
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="
            fixed
            left-4
            right-4
            top-[72px]
            z-[70]

            overflow-hidden
            rounded-2xl

            border
            border-gray-200

            bg-white
            shadow-2xl

            dark:border-slate-700
            dark:bg-slate-800

            sm:absolute
            sm:left-auto
            sm:right-0
            sm:top-auto
            sm:mt-3
            sm:w-96
          "
        >
          {/* Header */}
          <div
            className="
              flex
              items-center
              justify-between

              border-b
              border-gray-200

              px-4
              py-3

              dark:border-slate-700
            "
          >
            <div>
              <h3
                className="
                  text-sm
                  font-semibold
                  text-gray-900
                  dark:text-gray-100
                "
              >
                Notifications
              </h3>

              {totalUnread > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {totalUnread} unread
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-lg

                text-gray-500

                hover:bg-gray-100

                dark:text-gray-400
                dark:hover:bg-slate-700
              "
              aria-label="Close notifications"
            >
              <X size={18} />
            </button>
          </div>

          {/* Notifications */}
          <div
            className="
              max-h-[60vh]
              overflow-y-auto
              divide-y
              divide-gray-100

              dark:divide-slate-700
            "
          >
            {notifications.length === 0 ? (
              <div
                className="
                  px-6
                  py-10
                  text-center
                  text-sm
                  text-gray-500

                  dark:text-gray-400
                "
              >
                No notifications
              </div>
            ) : (
              notifications.map((notification, index) => (
                <Link
                  key={
                    notification.id ||
                    notification._id ||
                    index
                  }
                  to={notification.link || '/'}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex
                    items-start
                    gap-3

                    px-4
                    py-3

                    transition-colors

                    hover:bg-gray-50
                    dark:hover:bg-slate-700/70

                    ${
                      !notification.read
                        ? 'bg-amber-50/60 dark:bg-amber-900/10'
                        : ''
                    }
                  `}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {getIcon(notification.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="
                        break-words
                        text-sm
                        text-gray-700

                        dark:text-gray-200
                      "
                    >
                      {notification.message}
                    </p>

                    {notification.time && (
                      <p
                        className="
                          mt-1
                          text-xs
                          text-gray-400

                          dark:text-gray-500
                        "
                      >
                        {notification.time}
                      </p>
                    )}
                  </div>

                  {!notification.read && (
                    <div
                      className="
                        mt-2
                        h-2
                        w-2
                        flex-shrink-0
                        rounded-full
                        bg-brand-primary
                      "
                    />
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ========================================
   NAVBAR
======================================== */

const Navbar = ({
  onToggle,
  notifications = [],
}) => {
  const { user, logout } = useAuth();

  const {
    theme,
    toggleTheme,
  } = useTheme();

  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      className="
        safe-top
        sticky
        top-0
        z-30

        border-b
        border-gray-200/80

        bg-white/90
        backdrop-blur-xl

        shadow-sm

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
        {/* =====================
            LEFT
        ====================== */}

        <div
          className="
            flex
            min-w-0
            items-center
            gap-2

            sm:gap-3
          "
        >
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

              transition-colors

              hover:bg-amber-50
              hover:text-brand-primary

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
                text-brand-primary

                dark:bg-amber-900/30
                dark:text-brand-secondary

                sm:h-10
                sm:w-10
              "
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>

            <div className="hidden min-w-0 sm:block">
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
                <span className="text-brand-primary dark:text-brand-secondary">
                  {user?.name || 'User'}
                </span>
              </p>

              <p
                className="
                  mt-0.5
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

        {/* =====================
            RIGHT
        ====================== */}

        <div
          className="
            flex
            flex-shrink-0
            items-center
            gap-1

            sm:gap-2
          "
        >
          <NotificationBell
            notifications={notifications}
          />

          {/* Theme */}
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

              transition-colors

              hover:bg-amber-50
              hover:text-brand-primary

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
          >
            <LogOut size={18} />

            <span className="hidden md:inline">
              Logout
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;