import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-4">Loading...</div>;
  return user && user.role === 'admin' ? children : <Navigate to="/" />;
};

export default AdminRoute;