import {
  useMemo,
  useState,
} from 'react';

import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

import toast from 'react-hot-toast';

import API from '../api/axios';

const ResetPassword = () => {
  const navigate =
    useNavigate();

  const params =
    useParams();

  const [searchParams] =
    useSearchParams();

  const token = useMemo(
    () =>
      params.token ||
      searchParams.get('token') ||
      '',
    [
      params.token,
      searchParams,
    ]
  );

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      if (!token) {
        toast.error(
          'Invalid or missing reset token'
        );

        return;
      }

      if (
        password.length < 6
      ) {
        toast.error(
          'Password must be at least 6 characters'
        );

        return;
      }

      if (
        password !==
        confirmPassword
      ) {
        toast.error(
          'Passwords do not match'
        );

        return;
      }

      setLoading(true);

      try {
        const response =
          await API.post(
            '/auth/reset-password',
            {
              token,
              password,
            }
          );

        toast.success(
          response.data?.message ||
            'Password reset successfully'
        );

        navigate(
          '/login',
          {
            replace: true,
          }
        );
      } catch (error) {
        console.error(
          'Reset password error:',
          error
        );

        toast.error(
          error.response?.data
            ?.message ||
            'Unable to reset password'
        );
      } finally {
        setLoading(false);
      }
    };

  if (!token) {
    return (
      <div
        className="
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
            w-full
            max-w-md

            rounded-3xl

            border
            border-gray-200

            bg-white

            p-8

            text-center

            shadow-xl

            dark:border-slate-700
            dark:bg-slate-900
          "
        >
          <h1
            className="
              text-xl
              font-bold

              text-gray-900

              dark:text-white
            "
          >
            Invalid reset link
          </h1>

          <p
            className="
              mt-2

              text-sm

              text-gray-500

              dark:text-gray-400
            "
          >
            The password reset token is
            missing from this link.
          </p>

          <Link
            to="/forgot-password"
            className="
              mt-5

              inline-flex
              items-center

              gap-2

              font-medium

              text-brand-primary

              dark:text-brand-secondary
            "
          >
            <ArrowLeft size={17} />

            Request a new link
          </Link>
        </div>
      </div>
    );
  }

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
        py-8

        dark:bg-slate-950
      "
    >
      <div
        className="
          w-full
          max-w-md

          rounded-3xl

          border
          border-gray-200

          bg-white

          p-6

          shadow-xl

          dark:border-slate-700
          dark:bg-slate-900

          sm:p-8
        "
      >
        <Link
          to="/login"
          className="
            mb-6

            inline-flex
            items-center

            gap-2

            text-sm
            font-medium

            text-gray-500

            hover:text-brand-primary

            dark:text-gray-400
          "
        >
          <ArrowLeft size={17} />

          Back to login
        </Link>

        <div
          className="
            flex
            h-12
            w-12

            items-center
            justify-center

            rounded-2xl

            bg-amber-100

            text-brand-primary

            dark:bg-amber-900/30
            dark:text-brand-secondary
          "
        >
          <Lock size={23} />
        </div>

        <h1
          className="
            mt-5

            text-2xl
            font-bold

            text-gray-900

            dark:text-white
          "
        >
          Create new password
        </h1>

        <p
          className="
            mt-2

            text-sm

            text-gray-500

            dark:text-gray-400
          "
        >
          Enter a new password for your
          LUXE account.
        </p>

        <form
          onSubmit={
            handleSubmit
          }
          className="
            mt-6
            space-y-4
          "
        >
          <div>
            <label
              htmlFor="password"
              className="
                text-sm
                font-medium

                text-gray-700

                dark:text-gray-300
              "
            >
              New password
            </label>

            <div
              className="
                relative
                mt-2
              "
            >
              <Lock
                size={18}
                className="
                  absolute
                  left-3
                  top-1/2

                  -translate-y-1/2

                  text-gray-400
                "
              />

              <input
                id="password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                autoComplete="new-password"
                minLength={6}
                required
                className="
                  h-12
                  w-full

                  rounded-xl

                  border
                  border-gray-300

                  pl-10
                  pr-12

                  outline-none

                  focus:border-brand-primary
                  focus:ring-2
                  focus:ring-amber-500/20

                  dark:border-slate-600
                  dark:bg-slate-800
                  dark:text-white
                "
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current
                  )
                }
                className="
                  absolute
                  right-3
                  top-1/2

                  -translate-y-1/2

                  text-gray-400
                "
              >
                {showPassword ? (
                  <EyeOff
                    size={18}
                  />
                ) : (
                  <Eye
                    size={18}
                  />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="
                text-sm
                font-medium

                text-gray-700

                dark:text-gray-300
              "
            >
              Confirm password
            </label>

            <input
              id="confirmPassword"
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              value={
                confirmPassword
              }
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              autoComplete="new-password"
              required
              className="
                mt-2
                h-12
                w-full

                rounded-xl

                border
                border-gray-300

                px-4

                outline-none

                focus:border-brand-primary
                focus:ring-2
                focus:ring-amber-500/20

                dark:border-slate-600
                dark:bg-slate-800
                dark:text-white
              "
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="
              flex
              h-12
              w-full

              items-center
              justify-center

              rounded-xl

              bg-brand-primary

              font-semibold

              text-white

              disabled:opacity-60
            "
          >
            {loading
              ? 'Updating...'
              : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;