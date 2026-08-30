import { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, Package, DollarSign, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const NotificationBell = ({ notifications }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on click outside
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
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-200 font-semibold flex items-center justify-between">
            <span>Notifications</span>
            {totalUnread > 0 && (
              <button className="text-xs text-indigo-600 hover:underline">
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

export default NotificationBell;