import {
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  ArrowLeft,
  Mail,
  Send,
  Sun,
  Moon,
} from 'lucide-react';

import toast from 'react-hot-toast';

import API from '../api/axios';
import { useTheme } from '../context/ThemeContext';

const ForgotPassword = () => {
  const {
    theme,
    toggleTheme,
  } = useTheme();

  const [email, setEmail] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [sent, setSent] =
    useState(false);

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (!normalizedEmail) {
        toast.error(
          'Please enter your email'
        );

        return;
      }

      setLoading(true);

      try {
        const response =
          await API.post(
            '/auth/forgot-password',
            {
              email:
                normalizedEmail,
            }
          );

        setSent(true);

        toast.success(
          response.data?.message ||
            'Password reset email sent'
        );
      } catch (error) {
        console.error(
          'Forgot password error:',
          error
        );

        toast.error(
          error.response?.data
            ?.message ||
            'Unable to send reset email'
        );
      } finally {
        setLoading(false);
      }
    };

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
      {/* Theme */}

      <button
        type="button"
        onClick={toggleTheme}
        className="
          fixed
          right-4
          top-4

          flex
          h-10
          w-10

          items-center
          justify-center

          rounded-xl

          border
          border-gray-200

          bg-white

          text-gray-600

          shadow-sm

          dark:border-slate-700
          dark:bg-slate-800
          dark:text-gray-300
        "
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <Moon size={19} />
        ) : (
          <Sun size={19} />
        )}
      </button>

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
            dark:hover:text-brand-secondary
          "
        >
          <ArrowLeft size={17} />

          Back to login
        </Link>

        <div
          className="
            mb-6

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
          <Mail size={23} />
        </div>

        <h1
          className="
            text-2xl
            font-bold

            text-gray-900

            dark:text-white
          "
        >
          Forgot password?
        </h1>

        <p
          className="
            mt-2

            text-sm
            leading-6

            text-gray-500

            dark:text-gray-400
          "
        >
          Enter your account email and
          we'll send you instructions to
          reset your password.
        </p>

        {sent ? (
          <div
            className="
              mt-6

              rounded-2xl

              border
              border-emerald-200

              bg-emerald-50

              p-4

              dark:border-emerald-800
              dark:bg-emerald-900/20
            "
          >
            <p
              className="
                text-sm
                font-semibold

                text-emerald-700

                dark:text-emerald-300
              "
            >
              Check your email
            </p>

            <p
              className="
                mt-1

                text-sm

                text-emerald-600

                dark:text-emerald-400
              "
            >
              If an account exists for{' '}
              <strong>{email}</strong>,
              you should receive password
              reset instructions shortly.
            </p>

            <button
              type="button"
              onClick={() =>
                setSent(false)
              }
              className="
                mt-4

                text-sm
                font-medium

                text-brand-primary

                dark:text-brand-secondary
              "
            >
              Try another email
            </button>
          </div>
        ) : (
          <form
            onSubmit={
              handleSubmit
            }
            className="mt-6"
          >
            <label
              htmlFor="email"
              className="
                block

                text-sm
                font-medium

                text-gray-700

                dark:text-gray-300
              "
            >
              Email address
            </label>

            <div
              className="
                relative
                mt-2
              "
            >
              <Mail
                size={18}
                className="
                  pointer-events-none

                  absolute
                  left-3
                  top-1/2

                  -translate-y-1/2

                  text-gray-400
                "
              />

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                autoComplete="email"
                placeholder="you@example.com"
                required
                className="
                  h-12
                  w-full

                  rounded-xl

                  border
                  border-gray-300

                  bg-white

                  pl-10
                  pr-4

                  text-sm

                  text-gray-900

                  outline-none

                  transition

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
                mt-5

                flex
                h-12
                w-full

                items-center
                justify-center

                gap-2

                rounded-xl

                bg-brand-primary

                font-semibold

                text-white

                shadow-sm

                transition

                hover:brightness-95

                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <Send size={18} />

              {loading
                ? 'Sending...'
                : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;