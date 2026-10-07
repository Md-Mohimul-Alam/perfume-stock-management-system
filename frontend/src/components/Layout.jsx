import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';

import { useNotifications } from '../context/NotificationContext';

const layoutStyles = `
  @media (min-width: 1920px) {
    .main-content-container {
      max-width: 1600px !important;
    }
  }

  @media (min-width: 2560px) {
    .main-content-container {
      max-width: 2000px !important;
      padding-left: 2rem;
      padding-right: 2rem;
    }
  }
`;

const Layout = () => {
  const { notifications } = useNotifications();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const closeDrawer = () => {
    setSidebarOpen(false);
  };

  const openDrawer = () => {
    setSidebarOpen(true);
  };

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed((prev) => !prev);
    } else {
      setSidebarOpen((prev) => !prev);
    }
  };

  return (
    <>
      <style>{layoutStyles}</style>

      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* =========================
            Desktop Sidebar
        ========================== */}
        <div
          className={`hidden lg:block lg:shrink-0 transition-all duration-300 ${
            sidebarCollapsed
              ? 'w-16 lg:w-20'
              : 'w-64 lg:w-72 2xl:w-80'
          }`}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() =>
              setSidebarCollapsed((prev) => !prev)
            }
          />
        </div>

        {/* =========================
            Mobile Drawer Overlay
        ========================== */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            className="
              fixed inset-0 z-40
              bg-black/40
              backdrop-blur-sm
              dark:bg-black/60
              lg:hidden
            "
            onClick={closeDrawer}
          />
        )}

        {/* =========================
            Mobile Drawer
        ========================== */}
        <div
          className={`
            fixed left-0 top-0 z-50
            h-full w-[85%] max-w-72
            bg-white
            shadow-2xl
            transition-transform
            duration-300
            ease-in-out

            dark:bg-gray-900
            dark:shadow-gray-900/50

            lg:hidden

            ${
              sidebarOpen
                ? 'translate-x-0'
                : '-translate-x-full'
            }
          `}
        >
          <Sidebar
            closeDrawer={closeDrawer}
            isDrawer
          />
        </div>

        {/* =========================
            Main Application
        ========================== */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            onToggle={handleToggle}
            notifications={notifications}
          />

          <main
            className="
              flex-1
              overflow-y-auto
              bg-gray-50
              p-4
              pb-24

              dark:bg-gray-900

              sm:p-6
              sm:pb-24

              lg:pb-6
            "
          >
            <div className="main-content-container mx-auto max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>

        {/* =========================
            Mobile Bottom Navigation
        ========================== */}
        <MobileBottomNav onMore={openDrawer} />
      </div>
    </>
  );
};

export default Layout;