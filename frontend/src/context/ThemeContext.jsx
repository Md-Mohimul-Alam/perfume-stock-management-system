import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'luxe-theme';

const LIGHT_THEME_COLOR = '#faf8f5';
const DARK_THEME_COLOR = '#0f172a';

/* ========================================
   GET INITIAL THEME
======================================== */

const getInitialTheme = () => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const savedTheme =
    localStorage.getItem(STORAGE_KEY);

  if (
    savedTheme === 'light' ||
    savedTheme === 'dark'
  ) {
    return savedTheme;
  }

  const prefersDark =
    window.matchMedia?.(
      '(prefers-color-scheme: dark)'
    ).matches;

  return prefersDark
    ? 'dark'
    : 'light';
};

/* ========================================
   THEME PROVIDER
======================================== */

export const ThemeProvider = ({
  children,
}) => {
  const [theme, setTheme] =
    useState(getInitialTheme);

  /*
    Apply theme before the browser paints
    whenever the theme changes.
  */
  useLayoutEffect(() => {
    const root =
      document.documentElement;

    const isDark =
      theme === 'dark';

    root.classList.toggle(
      'dark',
      isDark
    );

    root.style.colorScheme =
      isDark
        ? 'dark'
        : 'light';

    localStorage.setItem(
      STORAGE_KEY,
      theme
    );

    /* Update PWA/browser theme color */

    let themeMeta =
      document.querySelector(
        'meta[name="theme-color"]'
      );

    if (!themeMeta) {
      themeMeta =
        document.createElement(
          'meta'
        );

      themeMeta.setAttribute(
        'name',
        'theme-color'
      );

      document.head.appendChild(
        themeMeta
      );
    }

    themeMeta.setAttribute(
      'content',
      isDark
        ? DARK_THEME_COLOR
        : LIGHT_THEME_COLOR
    );
  }, [theme]);

  /*
    Watch system color scheme only when
    the user has never manually selected
    a theme.
  */
  useEffect(() => {
    if (
      typeof window ===
      'undefined'
    ) {
      return undefined;
    }

    const savedTheme =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (
      savedTheme ===
        'light' ||
      savedTheme === 'dark'
    ) {
      return undefined;
    }

    const mediaQuery =
      window.matchMedia(
        '(prefers-color-scheme: dark)'
      );

    const handleSystemTheme =
      (event) => {
        setTheme(
          event.matches
            ? 'dark'
            : 'light'
        );
      };

    mediaQuery.addEventListener?.(
      'change',
      handleSystemTheme
    );

    return () => {
      mediaQuery.removeEventListener?.(
        'change',
        handleSystemTheme
      );
    };
  }, []);

  const toggleTheme = () => {
    setTheme((current) =>
      current === 'dark'
        ? 'light'
        : 'dark'
    );
  };

  const useLightTheme = () => {
    setTheme('light');
  };

  const useDarkTheme = () => {
    setTheme('dark');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark:
          theme === 'dark',

        setTheme,
        toggleTheme,

        useLightTheme,
        useDarkTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

/* ========================================
   HOOK
======================================== */

export const useTheme = () => {
  const context =
    useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useTheme must be used inside ThemeProvider'
    );
  }

  return context;
};

export default ThemeContext;