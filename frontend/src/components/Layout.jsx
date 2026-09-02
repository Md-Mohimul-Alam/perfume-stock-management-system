import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
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
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeDrawer = () => setSidebarOpen(false);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed(!sidebarCollapsed);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };

  return (
    <>
      <style>{layoutStyles}</style>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Desktop sidebar */}
        <div
          className={`hidden lg:block lg:shrink-0 transition-all duration-300 ${
            sidebarCollapsed ? 'w-16 lg:w-20' : 'w-64 lg:w-72 2xl:w-80'
          }`}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile drawer overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={closeDrawer}
          />
        )}

        {/* Mobile drawer */}
        <div
          className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-900 shadow-2xl dark:shadow-gray-900/50 transition-transform duration-300 ease-in-out lg:hidden ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar closeDrawer={closeDrawer} isDrawer />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onToggle={handleToggle} notifications={notifications} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-900">
            <div className="main-content-container max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default Layout;