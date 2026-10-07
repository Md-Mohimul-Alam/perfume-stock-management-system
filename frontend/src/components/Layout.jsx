import { useEffect, useState } from 'react';
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

  /*
    Prevent background page scrolling while
    mobile drawer is open.
  */
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

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

      <div
        className="
          flex

          h-screen
          min-h-screen

          bg-gray-50

          dark:bg-slate-900

          supports-[height:100dvh]:h-[100dvh]
          supports-[height:100dvh]:min-h-[100dvh]
        "
      >
        {/* ========================================
            DESKTOP SIDEBAR
        ======================================== */}

        <aside
          className={`
            hidden
            lg:block
            lg:shrink-0

            transition-[width]
            duration-300
            ease-in-out

            ${
              sidebarCollapsed
                ? 'lg:w-20'
                : 'lg:w-72 2xl:w-80'
            }
          `}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() =>
              setSidebarCollapsed((prev) => !prev)
            }
          />
        </aside>

        {/* ========================================
            MOBILE DRAWER OVERLAY
        ======================================== */}

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={closeDrawer}
            className="
              fixed
              inset-0
              z-40

              bg-black/45
              backdrop-blur-[2px]

              dark:bg-black/65

              lg:hidden
            "
          />
        )}

        {/* ========================================
            MOBILE DRAWER
        ======================================== */}

        <aside
          className={`
            fixed
            bottom-0
            left-0
            top-0
            z-50

            w-[86%]
            max-w-[290px]

            bg-white

            shadow-2xl

            transition-transform
            duration-300
            ease-in-out

            dark:bg-slate-900
            dark:shadow-black/50

            lg:hidden

            ${
              sidebarOpen
                ? 'translate-x-0'
                : '-translate-x-full'
            }
          `}
          aria-hidden={!sidebarOpen}
        >
          <div
            className="
              h-full
              safe-top
              safe-bottom
            "
          >
            <Sidebar
              closeDrawer={closeDrawer}
              isDrawer
            />
          </div>
        </aside>

        {/* ========================================
            MAIN APPLICATION
        ======================================== */}

        <div
          className="
            flex
            min-w-0
            flex-1
            flex-col
            overflow-hidden
          "
        >
          <Navbar
            onToggle={handleToggle}
            notifications={notifications}
          />

          <main
            className="
              flex-1
              overflow-x-hidden
              overflow-y-auto

              bg-gray-50

              px-4
              pt-4

              pb-28

              dark:bg-slate-900

              sm:px-6
              sm:pt-6
              sm:pb-28

              lg:pb-6
            "
          >
            <div
              className="
                main-content-container
                mx-auto
                w-full
                max-w-7xl
              "
            >
              <Outlet />
            </div>
          </main>
        </div>

        {/* ========================================
            MOBILE BOTTOM NAVIGATION
        ======================================== */}

        <MobileBottomNav onMore={openDrawer} />
      </div>
    </>
  );
};

export default Layout;