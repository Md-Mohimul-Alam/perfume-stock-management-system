import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

const NotificationContext = createContext(null);

/* ========================================
   HELPERS
======================================== */

const createNotificationId = (notification = {}) => {
  if (notification.id) {
    return String(notification.id);
  }

  if (notification._id) {
    return String(notification._id);
  }

  return [
    notification.type || 'notification',
    notification.link || '',
    notification.message || '',
  ].join('::');
};

const normalizeNotification = (notification = {}) => ({
  ...notification,

  id: createNotificationId(notification),

  type:
    notification.type ||
    'info',

  message:
    notification.message ||
    'Notification',

  link:
    notification.link ||
    '/',

  time:
    notification.time ||
    'Just now',

  read:
    Boolean(notification.read),
});

/* ========================================
   PROVIDER
======================================== */

export const NotificationProvider = ({
  children,
}) => {
  const [
    notifications,
    setNotificationsState,
  ] = useState([]);

  /*
    Stores IDs marked as read.

    This survives Dashboard calling
    setNotifications() again.
  */
  const readIdsRef =
    useRef(new Set());

  /* ========================================
     SET / REPLACE NOTIFICATIONS
  ======================================== */

  const setNotifications = useCallback(
    (value) => {
      setNotificationsState(
        (previous) => {
          const next =
            typeof value === 'function'
              ? value(previous)
              : value;

          if (!Array.isArray(next)) {
            return [];
          }

          /*
            Also remember currently-read
            notifications before replacing.
          */
          previous.forEach(
            (notification) => {
              if (notification.read) {
                readIdsRef.current.add(
                  String(notification.id)
                );
              }
            }
          );

          const seen =
            new Set();

          return next
            .filter(Boolean)
            .map(
              normalizeNotification
            )
            .filter(
              (notification) => {
                if (
                  seen.has(
                    notification.id
                  )
                ) {
                  return false;
                }

                seen.add(
                  notification.id
                );

                return true;
              }
            )
            .map(
              (notification) => ({
                ...notification,

                read:
                  notification.read ||
                  readIdsRef.current.has(
                    String(
                      notification.id
                    )
                  ),
              })
            );
        }
      );
    },
    []
  );

  /* ========================================
     ADD
  ======================================== */

  const addNotification = useCallback(
    (notification) => {
      if (!notification) {
        return;
      }

      const normalized =
        normalizeNotification(
          notification
        );

      normalized.read =
        normalized.read ||
        readIdsRef.current.has(
          String(normalized.id)
        );

      setNotificationsState(
        (previous) => {
          const exists =
            previous.some(
              (item) =>
                item.id ===
                normalized.id
            );

          if (exists) {
            return previous;
          }

          return [
            normalized,
            ...previous,
          ];
        }
      );
    },
    []
  );

  /* ========================================
     MARK ONE READ
  ======================================== */

  const markAsRead = useCallback(
    (id) => {
      if (!id) {
        return;
      }

      const key =
        String(id);

      readIdsRef.current.add(
        key
      );

      setNotificationsState(
        (previous) =>
          previous.map(
            (notification) =>
              String(
                notification.id
              ) === key
                ? {
                    ...notification,
                    read: true,
                  }
                : notification
          )
      );
    },
    []
  );

  /* ========================================
     MARK ALL READ
  ======================================== */

  const markAllAsRead =
    useCallback(() => {
      setNotificationsState(
        (previous) => {
          /*
            Remember every notification ID.
          */
          previous.forEach(
            (notification) => {
              readIdsRef.current.add(
                String(
                  notification.id
                )
              );
            }
          );

          return previous.map(
            (notification) => ({
              ...notification,
              read: true,
            })
          );
        }
      );
    }, []);

  /* ========================================
     MARK UNREAD
  ======================================== */

  const markAsUnread =
    useCallback((id) => {
      if (!id) {
        return;
      }

      const key =
        String(id);

      readIdsRef.current.delete(
        key
      );

      setNotificationsState(
        (previous) =>
          previous.map(
            (notification) =>
              String(
                notification.id
              ) === key
                ? {
                    ...notification,
                    read: false,
                  }
                : notification
          )
      );
    }, []);

  /* ========================================
     REMOVE
  ======================================== */

  const removeNotification =
    useCallback((id) => {
      if (!id) {
        return;
      }

      const key =
        String(id);

      readIdsRef.current.delete(
        key
      );

      setNotificationsState(
        (previous) =>
          previous.filter(
            (notification) =>
              String(
                notification.id
              ) !== key
          )
      );
    }, []);

  /* ========================================
     CLEAR
  ======================================== */

  const clearNotifications =
    useCallback(() => {
      readIdsRef.current.clear();

      setNotificationsState(
        []
      );
    }, []);

  /* ========================================
     UNREAD COUNT
  ======================================== */

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          !notification.read
      ).length,
    [notifications]
  );

  const hasUnread =
    unreadCount > 0;

  /* ========================================
     CONTEXT
  ======================================== */

  const value = useMemo(
    () => ({
      notifications,

      unreadCount,
      hasUnread,

      setNotifications,
      addNotification,

      markAsRead,
      markAsUnread,
      markAllAsRead,

      removeNotification,
      clearNotifications,
    }),
    [
      notifications,
      unreadCount,
      hasUnread,

      setNotifications,
      addNotification,

      markAsRead,
      markAsUnread,
      markAllAsRead,

      removeNotification,
      clearNotifications,
    ]
  );

  return (
    <NotificationContext.Provider
      value={value}
    >
      {children}
    </NotificationContext.Provider>
  );
};

/* ========================================
   HOOK
======================================== */

export const useNotifications = () => {
  const context =
    useContext(
      NotificationContext
    );

  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }

  return context;
};

export default NotificationContext;