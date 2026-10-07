import {
  useEffect,
  useState,
} from 'react';
import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  LoaderCircle,
  X,
  Sun,
  Moon,
  ShieldCheck,
} from 'lucide-react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
const RESEND_COOLDOWN_SECONDS = 30;
const Login = () => {
const navigate = useNavigate();
const location = useLocation();
const { setAuthUser } =
    useAuth();
const {
    theme,
    toggleTheme,
  } = useTheme();
const [email, setEmail] =
    useState('');
const [password, setPassword] =
    useState('');
const [loading, setLoading] =
    useState(false);
const [
    showPassword,
    setShowPassword,
  ] = useState(false);
const [error, setError] =
    useState('');
const [
    showOtpModal,
    setShowOtpModal,
  ] = useState(false);
const [otp, setOtp] =
    useState('');
const [
    otpLoading,
    setOtpLoading,
  ] = useState(false);
const [
    otpError,
    setOtpError,
  ] = useState('');
const [
    otpSuccess,
    setOtpSuccess,
  ] = useState(false);
const [
    resending,
    setResending,
  ] = useState(false);
const [
    resendMessage,
    setResendMessage,
  ] = useState('');
const [
    resendError,
    setResendError,
  ] = useState('');
const [
    cooldown,
    setCooldown,
  ] = useState(0);
const getPostLoginPath = () => {
    const routeStatePath =
      typeof location.state?.from === 'string'
        ? location.state.from
        : '';
    const storedPath =
      sessionStorage.getItem(
        'luxe-auth-return-to'
      ) || '';
    const candidate =
      routeStatePath ||
      storedPath ||
      '/';
    if (
      !candidate.startsWith('/') ||
      candidate.startsWith('//') ||
      candidate === '/login'
    ) {
      return '/';
    }
    return candidate;
  };
  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }
const timer = window.setTimeout(
      () => {
        setCooldown(
          (previous) =>
            Math.max(
              previous - 1,
              0
            )
        );
      },
      1000
    );
    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [cooldown]);
  useEffect(() => {
    if (!showOtpModal) {
      return undefined;
    }
const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow =
      'hidden';
    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [showOtpModal]);
const handleSubmit =
async (event) => {
      event.preventDefault();
      setError('');
const cleanEmail =
        email.trim().toLowerCase();
      if (
        !cleanEmail ||
        !password.trim()
      ) {
        setError(
          'Please fill in all fields.'
        );
        return;
      }
      if (
        !cleanEmail.includes('@')
      ) {
        setError(
          'Please enter a valid email address.'
        );
        return;
      }
      setLoading(true);
      try {
        await API.post(
          '/auth/login',
          {
            email: cleanEmail,
            password,
          }
        );
        setEmail(cleanEmail);
        setOtp('');
        setOtpError('');
        setOtpSuccess(false);
        setResendMessage('');
        setResendError('');
        setCooldown(
          RESEND_COOLDOWN_SECONDS
        );
        setShowOtpModal(true);
      } catch (err) {
const message =
          err.response?.data
            ?.message ||
          'Unable to sign in. Please try again.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
const handleVerifyOtp =
async (event) => {
      event.preventDefault();
const cleanOtp =
        otp.trim();
      setOtpError('');
      if (
        cleanOtp.length !== 6
      ) {
        setOtpError(
          'Please enter the 6-digit OTP.'
        );
        return;
      }
      setOtpLoading(true);
      try {
const response =
          await API.post(
            '/auth/verify-otp',
            {
              email,
              otp: cleanOtp,
            }
          );
const {
          token,
          user: nestedUser,
          ...rest
        } = response.data || {};
        if (!token) {
          throw new Error(
            'Authentication token was not returned.'
          );
        }
const userData =
          nestedUser ||
          rest;
        if (
          !userData ||
          typeof userData !== 'object'
        ) {
          throw new Error(
            'User information was not returned.'
          );
        }
        setAuthUser(
          userData,
          token
        );
const redirectTo =
          getPostLoginPath();
        sessionStorage.removeItem(
          'luxe-auth-return-to'
        );
        setOtpLoading(false);
        setOtpSuccess(true);
        window.setTimeout(() => {
          setShowOtpModal(
            false
          );
          navigate(
            redirectTo,
            {
              replace: true,
            }
          );
        }, 700);
      } catch (err) {
const message =
          err.response?.data
            ?.message ||
          err.message ||
          'Invalid OTP. Please try again.';
        setOtpError(message);
        setOtpLoading(false);
      }
    };
const handleResend =
async () => {
      if (
        resending ||
        cooldown > 0 ||
        otpSuccess
      ) {
        return;
      }
      setResending(true);
      setResendError('');
      setResendMessage('');
      try {
        await API.post(
          '/auth/resend-otp',
          {
            email,
            purpose: 'login',
          }
        );
        setOtp('');
        setOtpError('');
        setResendMessage(
          'A new OTP has been sent to your email.'
        );
        setCooldown(
          RESEND_COOLDOWN_SECONDS
        );
      } catch (err) {
const message =
          err.response?.data
            ?.message ||
          'Could not resend OTP. Please try again.';
        setResendError(
          message
        );
      } finally {
        setResending(false);
      }
    };
const closeModal = () => {
    if (
      otpLoading ||
      otpSuccess
    ) {
      return;
    }
    setShowOtpModal(false);
    setOtp('');
    setOtpError('');
    setResendMessage('');
    setResendError('');
    setCooldown(0);
  };
const inputClass = `
    w-full
    min-h-12
    rounded-xl
    border
    border-gray-300
    bg-white
    px-4
    py-3
    text-[16px]
    text-gray-900
    outline-none
    transition
    placeholder:text-gray-400
    focus:border-brand-primary
    focus:ring-2
    focus:ring-brand-primary/20
    disabled:cursor-not-allowed
    disabled:opacity-60
    dark:border-slate-600
    dark:bg-slate-800
    dark:text-gray-100
    dark:placeholder:text-gray-500
    dark:focus:border-brand-secondary
    dark:focus:ring-brand-secondary/20
  `;
  return (
    <div
      className="safe-top safe-bottom relative flex min-h-screen min-h-[100dvh] items-center justify-center overflow-hidden bg-[#faf8f5] px-4 py-8 dark:bg-slate-950 sm:px-6"
    >
      <div
        className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-600/10"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-28 h-80 w-80 rounded-full bg-orange-300/20 blur-3xl dark:bg-orange-700/10"
      />
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white/90 text-gray-600 shadow-sm backdrop-blur-xl transition hover:bg-amber-50 hover:text-brand-primary dark:border-slate-700 dark:bg-slate-800/90 dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-brand-secondary"
        aria-label={
          theme === 'light'
            ? 'Enable dark mode'
            : 'Enable light mode'
        }
      >
        {theme === 'light' ? (
          <Moon size={20} />
        ) : (
          <Sun size={20} />
        )}
      </button>
      <main
        className="relative z-[1] w-full max-w-md rounded-3xl border border-gray-200/80 bg-white/95 p-5 shadow-2xl shadow-black/5 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/30 sm:p-8"
      >
        <div className="mb-5 flex justify-center">
          <img
            src="/logo.png"
            alt="LUXE Perfume"
            className="h-auto w-36 object-contain sm:w-40"
          />
        </div>
        <div className="mb-7 text-center">
          <h1
            className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl"
          >
            Welcome Back
          </h1>
          <p
            className="mt-2 text-sm text-gray-500 dark:text-gray-400"
          >
            Sign in to LUXE Perfume Management
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
              <AlertCircle
                className="mt-0.5 h-5 w-5 flex-shrink-0"
              />
              <span>
                {error}
              </span>
            </div>
          )}
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(
                    event.target.value
                  );
                  setError('');
                }}
                disabled={
                  loading ||
                  showOtpModal
                }
                className={`${inputClass} pl-11`}
                required
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              />
              <input
                id="login-password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => {
                  setPassword(
                    event.target.value
                  );
                  setError('');
                }}
                disabled={
                  loading ||
                  showOtpModal
                }
                className={`${inputClass} pl-11 pr-12`}
                required
              />
              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (previous) =>
                      !previous
                  )
                }
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-200"
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                {showPassword ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-brand-primary hover:underline dark:text-brand-secondary"
            >
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={
              loading ||
              showOtpModal
            }
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 font-semibold text-white shadow-md shadow-amber-900/10 transition hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <LoaderCircle
                size={19}
                className="animate-spin"
              />
            )}
            {loading
              ? 'Signing in...'
              : 'Sign In'}
          </button>
        </form>
        <div
          className="mt-7 border-t border-gray-200 pt-6 text-center dark:border-slate-700"
        >
          <p
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            Don't have an account?
          </p>
          <Link
            to="/register"
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-brand-primary px-5 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-white dark:border-brand-secondary dark:text-brand-secondary dark:hover:bg-brand-secondary dark:hover:text-slate-950"
          >
            Create Account
          </Link>
        </div>
      </main>
      {showOtpModal && (
        <div
          className="safe-top safe-bottom fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="otp-heading"
        >
          <div
            className="relative my-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-7"
          >
            {!otpSuccess && (
              <button
                type="button"
                onClick={closeModal}
                disabled={
                  otpLoading
                }
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-gray-200"
                aria-label="Close OTP verification"
              >
                <X size={20} />
              </button>
            )}
            <div className="mb-6 text-center">
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-brand-primary dark:bg-amber-900/30 dark:text-brand-secondary"
              >
                {otpSuccess ? (
                  <CheckCircle
                    className="h-8 w-8"
                  />
                ) : (
                  <ShieldCheck
                    className="h-8 w-8"
                  />
                )}
              </div>
              <h2
                id="otp-heading"
                className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl"
              >
                {otpSuccess
                  ? 'Verified'
                  : 'Check Your Email'}
              </h2>
              {!otpSuccess && (
                <p
                  className="mt-2 text-sm text-gray-500 dark:text-gray-400"
                >
                  Enter the 6-digit code sent to
                  <br />
                  <span
                    className="break-all font-medium text-gray-700 dark:text-gray-200"
                  >
                    {email}
                  </span>
                </p>
              )}
            </div>
            {otpSuccess ? (
              <div
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300"
              >
                <CheckCircle
                  className="mr-1 inline h-4 w-4"
                />
                Login verified. Opening dashboard...
              </div>
            ) : (
              <form
                onSubmit={
                  handleVerifyOtp
                }
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="login-otp"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Verification Code
                  </label>
                  <input
                    id="login-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    placeholder="123456"
                    value={otp}
                    onChange={(event) => {
const value =
                        event.target.value
                          .replace(
                            /\D/g,
                            ''
                          )
                          .slice(0, 6);
                      setOtp(value);
                      setOtpError('');
                    }}
                    disabled={
                      otpLoading
                    }
                    className={`${inputClass} text-center text-2xl font-semibold tracking-[0.35em]`}
                    maxLength={6}
                    autoFocus
                    required
                  />
                  {otpError && (
                    <p
                      role="alert"
                      className="mt-2 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400"
                    >
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 flex-shrink-0"
                      />
                      {otpError}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={
                    otpLoading ||
                    otp.length !== 6
                  }
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-3 font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpLoading && (
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                    />
                  )}
                  {otpLoading
                    ? 'Verifying...'
                    : 'Verify OTP'}
                </button>
                <div className="text-center">
                  <p
                    className="text-sm text-gray-500 dark:text-gray-400"
                  >
                    Didn't receive the code?{' '}
                    <button
                      type="button"
                      onClick={
                        handleResend
                      }
                      disabled={
                        resending ||
                        cooldown > 0
                      }
                      className="font-semibold text-brand-primary hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline dark:text-brand-secondary dark:disabled:text-gray-500"
                    >
                      {resending
                        ? 'Sending...'
                        : cooldown > 0
                          ? `Resend in ${cooldown}s`
                          : 'Resend'}
                    </button>
                  </p>
                  {resendMessage && (
                    <p
                      className="mt-2 flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400"
                    >
                      <CheckCircle
                        className="h-4 w-4"
                      />
                      {resendMessage}
                    </p>
                  )}
                  {resendError && (
                    <p
                      className="mt-2 flex items-center justify-center gap-1 text-xs text-red-600 dark:text-red-400"
                    >
                      <AlertCircle
                        className="h-4 w-4"
                      />
                      {resendError}
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default Login;
