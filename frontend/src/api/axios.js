import axios from 'axios';

/* ========================================
   API BASE URL
======================================== */

const normalizeApiBaseUrl = (value) => {
  const url = String(value || '')
    .trim()
    .replace(/\/+$/, '');

  if (!url) {
    return '';
  }

  return url.endsWith('/api')
    ? url
    : `${url}/api`;
};

const configuredApiUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:5001'
    : '');

const API_BASE_URL =
  normalizeApiBaseUrl(
    configuredApiUrl
  );

if (!API_BASE_URL) {
  console.error(
    'VITE_API_URL is not configured. API requests will fail.'
  );
}

if (import.meta.env.DEV) {
  console.log(
    '🔧 API Base URL:',
    API_BASE_URL
  );
}

/* ========================================
   AXIOS INSTANCE
======================================== */

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,

  headers: {
    Accept: 'application/json',
  },
});

/* ========================================
   AUTH HELPERS
======================================== */

const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/verify-otp',
  '/auth/resend-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/register',
  '/auth/verify-registration',
];

const isAuthEndpoint = (
  url = ''
) => {
  return AUTH_ENDPOINTS.some(
    (endpoint) =>
      String(url).includes(
        endpoint
      )
  );
};

const clearStoredAuth = () => {
  localStorage.removeItem(
    'token'
  );

  localStorage.removeItem(
    'user'
  );
};

let isRedirectingToLogin =
  false;

const redirectToLogin = () => {
  if (
    typeof window ===
      'undefined' ||
    isRedirectingToLogin
  ) {
    return;
  }

  const currentPath =
    `${window.location.pathname}${window.location.search}`;

  if (
    window.location.pathname !==
    '/login'
  ) {
    sessionStorage.setItem(
      'luxe-auth-return-to',
      currentPath
    );
  }

  isRedirectingToLogin =
    true;

  window.dispatchEvent(
    new CustomEvent(
      'luxe:unauthorized'
    )
  );

  if (
    window.location.pathname !==
    '/login'
  ) {
    window.location.replace(
      '/login'
    );
  }
};

/* ========================================
   REQUEST INTERCEPTOR
======================================== */

API.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem(
        'token'
      );

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) =>
    Promise.reject(error)
);

/* ========================================
   RESPONSE INTERCEPTOR
======================================== */

API.interceptors.response.use(
  (response) => response,

  (error) => {
    const status =
      error.response?.status;

    const requestUrl =
      error.config?.url || '';

    if (
      status === 401 &&
      !isAuthEndpoint(
        requestUrl
      )
    ) {
      clearStoredAuth();
      redirectToLogin();
    }

    return Promise.reject(
      error
    );
  }
);

export default API;