import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, User } from 'lucide-react';

const Navbar = ({ onToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 transition-colors duration-200"
          aria-label="Toggle sidebar"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-sm">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-700 leading-tight">
              Welcome back, <span className="text-indigo-700">{user?.name}</span>
            </p>
            <p className="text-xs text-gray-400 leading-tight">
              {user?.role || 'Staff'}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium"
      >
        <LogOut size={18} />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </header>
  );
};

export default Navbar;