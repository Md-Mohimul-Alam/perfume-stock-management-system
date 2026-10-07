import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.jsx';

import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';

import { registerSW } from 'virtual:pwa-register';

import './index.css';

// Register PWA service worker
const updateSW = registerSW({
  onNeedRefresh() {
    const shouldUpdate = window.confirm(
      'A new version of LUXE is available. Update now?'
    );

    if (shouldUpdate) {
      updateSW(true);
    }
  },

  onOfflineReady() {
    console.log('LUXE is ready to work offline.');
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);