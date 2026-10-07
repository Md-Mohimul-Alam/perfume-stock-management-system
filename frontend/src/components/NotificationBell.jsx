import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Bell,
  AlertCircle,
  Package,
  DollarSign,
  X,
  CheckCheck,
} from 'lucide-react';

import { Link } from 'react-router-dom';

import { useNotifications } from '../context/NotificationContext';

const NotificationBell = () => {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] =
    useState(false);

  const dropdownRef =
    useRef(null);

  /* ========================================
     ALWAYS CALCULATE FROM CURRENT ARRAY
  ======================================== */

  const unreadCount = useMemo(() => {
    return notifications.filter(
      (notification) =>
        !notification.read
    ).length;
  }, [notifications]);

  /* ========================================
     CLOSE OUTSIDE
  ======================================== */

  useEffect(() => {
    const handleClickOutside = (
      event
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target
        )
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    document.addEventListener(
      'touchstart',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );

      document.removeEventListener(
        'touchstart',
        handleClickOutside
      );
    };
  }, []);

  /* ========================================
     ESCAPE
  ======================================== */

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscape = (
      event
    ) => {
      if (
        event.key === 'Escape'
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener(
      'keydown',
      handleEscape
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, [isOpen]);

  /* ========================================
     ICON
  ======================================== */

  const getIcon = (type) => {
    switch (type) {
      case 'warning':
        return (
          <AlertCircle
            className="
              h-4
              w-4
              text-amber-500
            "
          />
        );

      case 'due':
        return (
          <DollarSign
            className="
              h-4
              w-4
              text-red-500
            "
          />
        );

      default:
        return (
          <Package
            className="
              h-4
              w-4
              text-blue-500
            "
          />
        );
    }
  };

  /* ========================================
     MARK ONE
  ======================================== */

  const handleNotificationClick = (
    notification
  ) => {
    if (!notification.read) {
      markAsRead(
        notification.id
      );
    }

    setIsOpen(false);
  };

  /* ========================================
     MARK ALL
  ======================================== */

  const handleMarkAllRead = (
    event
  ) => {
    event.preventDefault();
    event.stopPropagation();

    markAllAsRead();
  };

  return (
    <div
      ref={dropdownRef}
      className="relative"
    >
      {/* Bell */}

      <button
        type="button"
        onClick={() =>
          setIsOpen(
            (previous) =>
              !previous
          )
        }
        className="
          relative

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
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell size={21} />

        {/* COUNT */}

        {unreadCount > 0 && (
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

              shadow-sm
            "
          >
            {unreadCount > 99
              ? '99+'
              : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}

      {isOpen && (
        <div
          className="
            fixed

            left-3
            right-3

            top-[calc(env(safe-area-inset-top)+68px)]

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

              gap-3

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

              <p
                className="
                  mt-0.5

                  text-xs

                  text-gray-500

                  dark:text-gray-400
                "
              >
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : 'You are all caught up'}
              </p>
            </div>

            <div
              className="
                flex
                items-center
                gap-1
              "
            >
              {/* MARK ALL */}

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={
                    handleMarkAllRead
                  }
                  className="
                    flex
                    h-8

                    items-center
                    gap-1.5

                    rounded-lg

                    px-2

                    text-xs
                    font-medium

                    text-brand-primary

                    transition-colors

                    hover:bg-amber-50

                    dark:text-brand-secondary
                    dark:hover:bg-amber-900/20
                  "
                >
                  <CheckCheck
                    size={15}
                  />

                  <span
                    className="
                      hidden
                      sm:inline
                    "
                  >
                    Mark all read
                  </span>
                </button>
              )}

              {/* Close */}

              <button
                type="button"
                onClick={() =>
                  setIsOpen(false)
                }
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
          </div>

          {/* List */}

          <div
            className="
              max-h-[60vh]

              overflow-y-auto

              divide-y
              divide-gray-100

              dark:divide-slate-700
            "
          >
            {notifications.length ===
            0 ? (
              <div
                className="
                  px-6
                  py-10

                  text-center
                "
              >
                <Bell
                  size={24}
                  className="
                    mx-auto

                    text-gray-300

                    dark:text-gray-600
                  "
                />

                <p
                  className="
                    mt-3

                    text-sm

                    text-gray-500

                    dark:text-gray-400
                  "
                >
                  No notifications
                </p>
              </div>
            ) : (
              notifications.map(
                (
                  notification
                ) => (
                  <Link
                    key={
                      notification.id
                    }
                    to={
                      notification.link ||
                      '/'
                    }
                    onClick={() =>
                      handleNotificationClick(
                        notification
                      )
                    }
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
                          ? `
                              bg-amber-50/60
                              dark:bg-amber-900/10
                            `
                          : ''
                      }
                    `}
                  >
                    {/* Icon */}

                    <div
                      className="
                        mt-0.5

                        flex
                        h-8
                        w-8

                        flex-shrink-0

                        items-center
                        justify-center

                        rounded-full

                        bg-gray-100

                        dark:bg-slate-700
                      "
                    >
                      {getIcon(
                        notification.type
                      )}
                    </div>

                    {/* Message */}

                    <div
                      className="
                        min-w-0
                        flex-1
                      "
                    >
                      <p
                        className={`
                          break-words

                          text-sm

                          ${
                            notification.read
                              ? `
                                  text-gray-600
                                  dark:text-gray-300
                                `
                              : `
                                  font-medium
                                  text-gray-900
                                  dark:text-gray-100
                                `
                          }
                        `}
                      >
                        {
                          notification.message
                        }
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
                          {
                            notification.time
                          }
                        </p>
                      )}
                    </div>

                    {/* Unread */}

                    {!notification.read && (
                      <span
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
                )
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;