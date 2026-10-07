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
   HELPERS
======================================== */

const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const getStoredUser = () => {
  try {
    const storedUser =
      localStorage.getItem(USER_KEY);

    if (!storedUser) {
      return null;
    }

    const parsed =
      JSON.parse(storedUser);

    if (
      !parsed ||
      typeof parsed !== 'object'
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error(
      'Failed to parse stored user:',
      error
    );

    return null;
  }
};

/*
  Client-side expiration check only.

  This does NOT replace backend
  JWT verification.
*/

const isTokenExpired = (token) => {
  if (!token) {
    return true;
  }

  try {
    const parts =
      token.split('.');

    if (parts.length !== 3) {
      /*
        If your backend ever uses a
        non-JWT token, do not treat it
        as expired automatically.
      */
      return false;
    }

    const payloadPart =
      parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const padded =
      payloadPart.padEnd(
        Math.ceil(
          payloadPart.length / 4
        ) * 4,
        '='
      );

    const payload =
      JSON.parse(
        window.atob(padded)
      );

    if (!payload?.exp) {
      return false;
    }

    const currentTime =
      Math.floor(
        Date.now() / 1000
      );

    return (
      Number(payload.exp) <=
      currentTime
    );
  } catch (error) {
    console.warn(
      'Could not inspect JWT expiration:',
      error
    );

    /*
      Let backend validation decide
      rather than logging the user out
      because of a parsing problem.
    */
    return false;
  }
};

/* ========================================
   PROVIDER
======================================== */

export const AuthProvider = ({
  children,
}) => {
  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  /* ========================================
     RESTORE AUTH
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
          isTokenExpired(token)
        ) {
          clearStoredAuth();
          setUser(null);
          return;
        }

        setUser(storedUser);
      } catch (error) {
        console.error(
          'Failed to restore authentication:',
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
     SYNC BETWEEN TABS / WINDOWS
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
        !storedUser ||
        isTokenExpired(token)
      ) {
        setUser(null);

        if (
          token &&
          isTokenExpired(token)
        ) {
          clearStoredAuth();
        }

        return;
      }

      setUser(storedUser);
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
     STORE AUTH AFTER OTP
  ======================================== */

  const setAuthUser =
    useCallback(
      (userData, token) => {
        if (
          !userData ||
          typeof userData !==
            'object'
        ) {
          throw new Error(
            'Invalid user data.'
          );
        }

        if (
          !token ||
          typeof token !==
            'string'
        ) {
          throw new Error(
            'Authentication token is missing.'
          );
        }

        if (
          isTokenExpired(token)
        ) {
          clearStoredAuth();

          setUser(null);

          throw new Error(
            'Authentication token has expired.'
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

        setUser(userData);
      },
      []
    );

  /* ========================================
     START LOGIN / OTP REQUEST
  ======================================== */

  /*
    This helper does NOT consider the user
    authenticated unless the backend actually
    returns a token.

    Your Login.jsx currently calls /auth/login
    directly and then uses setAuthUser() after
    /auth/verify-otp. That's perfectly fine.

    Keeping login() here prevents older
    components from breaking.
  */

  const login = useCallback(
    async (email, password) => {
      try {
        const response =
          await API.post(
            '/auth/login',
            {
              email:
                email
                  ?.trim()
                  .toLowerCase(),

              password,
            }
          );

        const data =
          response?.data || {};

        /*
          Backwards compatibility:
          if backend ever returns a token
          directly, authenticate normally.
        */

        if (data.token) {
          const {
            token,
            ...userData
          } = data;

          setAuthUser(
            userData,
            token
          );

          toast.success(
            'Login successful'
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

        toast.error(message);

        return {
          success: false,
          error: message,
        };
      }
    },
    [setAuthUser]
  );

  /* ========================================
     UPDATE CURRENT USER
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

            const updatedUser = {
              ...previous,
              ...updates,
            };

            localStorage.setItem(
              USER_KEY,
              JSON.stringify(
                updatedUser
              )
            );

            return updatedUser;
          }
        );
      },
      []
    );

  /* ========================================
     LOGOUT
  ======================================== */

  const logout = useCallback(
    ({
      showToast = true,
    } = {}) => {
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
     DERIVED AUTH STATE
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
   HOOK
======================================== */

export const useAuth = () => {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
};

export default AuthContext;