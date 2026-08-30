import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, Bell, AlertCircle, Package, DollarSign, X } from 'lucide-react';
import { Link } from 'react-router-dom';

// ====== Notification Bell Component (inline) ======
const NotificationBell = ({ notifications }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalUnread = notifications.filter(n => !n.read).length;

  const getIcon = (type) => {
    switch (type) {
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'due': return <DollarSign className="w-4 h-4 text-red-500" />;
      default: return <Package className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition"
        aria-label="Notifications"
      >
        <Bell size={22} />
        {totalUnread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
            {totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-200 font-semibold flex items-center justify-between">
            <span>Notifications</span>
            {totalUnread > 0 && (
              <button 
                className="text-xs text-indigo-600 hover:underline"
                onClick={() => {
                  // Mark all as read – you can implement this if needed
                  // For now, just close the dropdown
                  setIsOpen(false);
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                ✅ No notifications
              </div>
            ) : (
              notifications.map((n, idx) => (
                <Link
                  key={idx}
                  to={n.link}
                  className={`block p-3 hover:bg-gray-50 transition flex items-start gap-3 ${!n.read ? 'bg-blue-50/50' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex-shrink-0 mt-0.5">{getIcon(n.type)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{n.message}</p>
                    <p className="text-xs text-gray-400">{n.time}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ====== Main Navbar Component ======
const Navbar = ({ onToggle, notifications = [] }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 lg:px-8 xl:px-10 py-3 sm:py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          aria-label="Toggle sidebar"
        >
          <Menu size={24} className="lg:w-6 lg:h-6" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-sm lg:text-base">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm lg:text-base font-medium text-gray-700 leading-tight">
              Welcome back, <span className="text-indigo-700">{user?.name}</span>
            </p>
            <p className="text-xs lg:text-sm text-gray-400 leading-tight">
              {user?.role || 'Staff'}
            </p>
          </div>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        <NotificationBell notifications={notifications} />

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          <LogOut size={18} className="lg:w-5 lg:h-5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;