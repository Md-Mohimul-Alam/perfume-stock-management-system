import {
  Navigate,
  useLocation,
} from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

const AuthLoadingScreen = () => {
  return (
    <div
      className="
        safe-top
        safe-bottom

        flex
        min-h-screen
        min-h-[100dvh]

        items-center
        justify-center

        bg-[#faf8f5]

        px-4

        dark:bg-slate-950
      "
    >
      <div
        className="
          flex
          flex-col

          items-center

          gap-3

          text-center
        "
      >
        <div
          className="
            h-10
            w-10

            animate-spin

            rounded-full

            border-4
            border-amber-200

            border-t-brand-primary

            dark:border-slate-700
            dark:border-t-brand-secondary
          "
        />

        <p
          className="
            text-sm

            text-gray-500

            dark:text-gray-400
          "
        >
          Loading LUXE...
        </p>
      </div>
    </div>
  );
};

const PrivateRoute = ({
  children,
}) => {
  const {
    loading,
    isAuthenticated,
  } = useAuth();

  const location =
    useLocation();

  if (loading) {
    return (
      <AuthLoadingScreen />
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from:
            location.pathname +
            location.search,
        }}
      />
    );
  }

  return children;
};

export default PrivateRoute;