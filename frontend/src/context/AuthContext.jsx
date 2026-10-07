import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import API from '../api/axios';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

/* ========================================
   STORAGE HELPERS
======================================== */

const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const getStoredUser = () => {
  try {
    const storedUser =
      localStorage.getItem(
        USER_KEY
      );

    if (!storedUser) {
      return null;
    }

    const parsed =
      JSON.parse(
        storedUser
      );

    if (
      !parsed ||
      typeof parsed !== 'object'
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error(
      'Unable to parse stored user:',
      error
    );

    return null;
  }
};

/* ========================================
   JWT EXPIRATION
======================================== */

const isTokenExpired = (
  token
) => {
  if (!token) {
    return true;
  }

  try {
    const parts =
      token.split('.');

    /*
      If backend is using a non-JWT
      token, let the backend validate it.
    */
    if (parts.length !== 3) {
      return false;
    }

    const base64 =
      parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const padded =
      base64.padEnd(
        Math.ceil(
          base64.length / 4
        ) * 4,
        '='
      );

    const payload =
      JSON.parse(
        window.atob(
          padded
        )
      );

    if (!payload?.exp) {
      return false;
    }

    return (
      Number(payload.exp) <=
      Math.floor(
        Date.now() / 1000
      )
    );
  } catch (error) {
    console.warn(
      'Unable to inspect auth token:',
      error
    );

    return false;
  }
};

/* ========================================
   AUTH PROVIDER
======================================== */

export const AuthProvider = ({
  children,
}) => {
  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  /* ========================================
     RESTORE SESSION
  ======================================== */

  useEffect(() => {
    const restoreAuth = () => {
      try {
        const token =
          localStorage.getItem(
            TOKEN_KEY
          );

        const storedUser =
          getStoredUser();

        if (
          !token ||
          !storedUser
        ) {
          clearStoredAuth();

          setUser(null);

          return;
        }

        if (
          isTokenExpired(
            token
          )
        ) {
          clearStoredAuth();

          setUser(null);

          return;
        }

        setUser(
          storedUser
        );
      } catch (error) {
        console.error(
          'Failed to restore session:',
          error
        );

        clearStoredAuth();

        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreAuth();
  }, []);

  /* ========================================
     AXIOS 401 EVENT
  ======================================== */

  useEffect(() => {
    const handleUnauthorized =
      () => {
        clearStoredAuth();

        setUser(null);
      };

    window.addEventListener(
      'luxe:unauthorized',
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        'luxe:unauthorized',
        handleUnauthorized
      );
    };
  }, []);

  /* ========================================
     MULTI TAB / WINDOW SYNC
  ======================================== */

  useEffect(() => {
    const handleStorage = (
      event
    ) => {
      if (
        event.key !== TOKEN_KEY &&
        event.key !== USER_KEY &&
        event.key !== null
      ) {
        return;
      }

      const token =
        localStorage.getItem(
          TOKEN_KEY
        );

      const storedUser =
        getStoredUser();

      if (
        !token ||
        !storedUser
      ) {
        setUser(null);

        return;
      }

      if (
        isTokenExpired(
          token
        )
      ) {
        clearStoredAuth();

        setUser(null);

        return;
      }

      setUser(
        storedUser
      );
    };

    window.addEventListener(
      'storage',
      handleStorage
    );

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage
      );
    };
  }, []);

  /* ========================================
     SET AUTH USER
  ======================================== */

  const setAuthUser =
    useCallback(
      (
        userData,
        token
      ) => {
        if (
          !userData ||
          typeof userData !==
            'object'
        ) {
          throw new Error(
            'Invalid user data'
          );
        }

        if (
          !token ||
          typeof token !==
            'string'
        ) {
          throw new Error(
            'Authentication token is missing'
          );
        }

        if (
          isTokenExpired(
            token
          )
        ) {
          clearStoredAuth();

          setUser(null);

          throw new Error(
            'Authentication token has expired'
          );
        }

        localStorage.setItem(
          TOKEN_KEY,
          token
        );

        localStorage.setItem(
          USER_KEY,
          JSON.stringify(
            userData
          )
        );

        setUser(
          userData
        );
      },
      []
    );

  /* ========================================
     LOGIN
  ======================================== */

  /*
    Your current OTP Login.jsx can continue
    calling /auth/login directly and then use:

    setAuthUser(userData, token)

    after /auth/verify-otp succeeds.

    This function is kept for compatibility
    with any other component that uses login().
  */

  const login = useCallback(
    async (
      email,
      password
    ) => {
      try {
        const response =
          await API.post(
            '/auth/login',
            {
              email:
                String(
                  email || ''
                )
                  .trim()
                  .toLowerCase(),

              password,
            }
          );

        const data =
          response?.data ||
          {};

        /*
          Support direct-token login
          if backend returns one.
        */

        if (data.token) {
          const {
            token,
            user:
              nestedUser,
            ...rest
          } = data;

          const userData =
            nestedUser ||
            rest;

          setAuthUser(
            userData,
            token
          );
        }

        return {
          success: true,
          data,
        };
      } catch (error) {
        const message =
          error.response?.data
            ?.message ||
          'Login failed';

        toast.error(
          message
        );

        return {
          success: false,
          error: message,
        };
      }
    },
    [setAuthUser]
  );

  /* ========================================
     UPDATE AUTH USER
  ======================================== */

  const updateAuthUser =
    useCallback(
      (updates) => {
        if (
          !updates ||
          typeof updates !==
            'object'
        ) {
          return;
        }

        setUser(
          (previous) => {
            if (!previous) {
              return previous;
            }

            const updated = {
              ...previous,
              ...updates,
            };

            localStorage.setItem(
              USER_KEY,
              JSON.stringify(
                updated
              )
            );

            return updated;
          }
        );
      },
      []
    );

  /* ========================================
     LOGOUT
  ======================================== */

  const logout = useCallback(
    (
      options = {}
    ) => {
      const {
        showToast = true,
      } = options;

      clearStoredAuth();

      setUser(null);

      if (showToast) {
        toast.success(
          'Logged out'
        );
      }
    },
    []
  );

  /* ========================================
     DERIVED VALUES
  ======================================== */

  const isAuthenticated =
    Boolean(user);

  const isAdmin =
    user?.role === 'admin';

  const isStaff =
    user?.role === 'staff';

  const isInvestor =
    user?.role ===
    'investor';

  /* ========================================
     CONTEXT VALUE
  ======================================== */

  const value = useMemo(
    () => ({
      user,
      loading,

      isAuthenticated,

      isAdmin,
      isStaff,
      isInvestor,

      login,

      setAuthUser,
      updateAuthUser,

      logout,
    }),
    [
      user,
      loading,

      isAuthenticated,

      isAdmin,
      isStaff,
      isInvestor,

      login,
      setAuthUser,
      updateAuthUser,
      logout,
    ]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* ========================================
   AUTH HOOK
======================================== */

export const useAuth = () => {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return context;
};

export default AuthContext;