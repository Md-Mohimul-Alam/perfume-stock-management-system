import {
  useEffect,
  useState,
} from 'react';
import {
  Link,
  useNavigate,
} from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  LoaderCircle,
  ShieldCheck,
  X,
  Sun,
  Moon,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
const RESEND_COOLDOWN_SECONDS = 30;
const Register = () => {
const navigate =
    useNavigate();
const { isAdmin } =
    useAuth();
const {
    theme,
    toggleTheme,
  } = useTheme();
const [
    formData,
    setFormData,
  ] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
  });
const [loading, setLoading] =
    useState(false);
const [
    showPassword,
    setShowPassword,
  ] = useState(false);
const [
    showConfirm,
    setShowConfirm,
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
    registrationEmail,
    setRegistrationEmail,
  ] = useState('');
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
  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }
const timer =
      window.setTimeout(
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
const handleChange = (
    event
  ) => {
const {
      name,
      value,
    } = event.target;
    setFormData(
      (previous) => ({
        ...previous,
        [name]:
          name === 'email'
            ? value.toLowerCase()
            : value,
      })
    );
    setError('');
  };
const validateForm = () => {
const cleanName =
      formData.name.trim();
const cleanEmail =
      formData.email
        .trim()
        .toLowerCase();
    if (
      !cleanName ||
      !cleanEmail ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError(
        'Please fill in all fields.'
      );
      return false;
    }
    if (
      !cleanEmail.includes('@')
    ) {
      setError(
        'Please enter a valid email address.'
      );
      return false;
    }
    if (
      formData.password.length <
      6
    ) {
      setError(
        'Password must be at least 6 characters.'
      );
      return false;
    }
    if (
      formData.password !==
      formData.confirmPassword
    ) {
      setError(
        'Passwords do not match.'
      );
      return false;
    }
    return true;
  };
const handleSubmit =
async (event) => {
      event.preventDefault();
      if (!validateForm()) {
        return;
      }
      setLoading(true);
      setError('');
      setOtpError('');
      setResendMessage('');
      setResendError('');
const cleanEmail =
        formData.email
          .trim()
          .toLowerCase();
      try {
const response =
          await API.post(
            '/auth/register',
            {
              name:
                formData.name.trim(),
              email:
                cleanEmail,
              password:
                formData.password,
              role:
                isAdmin
                  ? formData.role
                  : 'staff',
            }
          );
        setRegistrationEmail(
          cleanEmail
        );
        setOtp('');
        setOtpError('');
        setOtpSuccess(false);
        setResendMessage('');
        setResendError('');
        setCooldown(
          RESEND_COOLDOWN_SECONDS
        );
        setShowOtpModal(true);
        toast.success(
          response.data
            ?.message ||
            'Registration successful. Check your email for the verification code.'
        );
      } catch (err) {
const message =
          err.response?.data
            ?.message ||
          'Registration failed. Please try again.';
        setError(message);
        toast.error(message);
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
        await API.post(
          '/auth/verify-registration',
          {
            email:
              registrationEmail,
            otp:
              cleanOtp,
          }
        );
        setOtpSuccess(true);
        toast.success(
          'Email verified successfully.'
        );
        window.setTimeout(() => {
          setShowOtpModal(
            false
          );
          navigate(
            isAdmin
              ? '/'
              : '/login',
            {
              replace: true,
            }
          );
        }, 900);
      } catch (err) {
const message =
          err.response?.data
            ?.message ||
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
            email:
              registrationEmail,
            purpose:
              'registration',
          }
        );
        setOtp('');
        setOtpError('');
        setResendMessage(
          'A new verification code has been sent.'
        );
        setCooldown(
          RESEND_COOLDOWN_SECONDS
        );
      } catch (err) {
const message =
          err.response?.data
            ?.message ||
          'Unable to resend the verification code.';
        setResendError(
          message
        );
      } finally {
        setResending(false);
      }
    };
const closeOtpModal = () => {
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
        className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-600/10"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-orange-300/20 blur-3xl dark:bg-orange-700/10"
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
            {isAdmin
              ? 'Create User'
              : 'Create Account'}
          </h1>
          <p
            className="mt-2 text-sm text-gray-500 dark:text-gray-400"
          >
            {isAdmin
              ? 'Add a new LUXE team member or investor'
              : 'Create your LUXE account'}
          </p>
          {isAdmin && (
            <p
              className="mt-1 text-xs text-gray-400 dark:text-gray-500"
            >
              Choose the appropriate account role below.
            </p>
          )}
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
              htmlFor="register-name"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Full Name
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              />
              <input
                id="register-name"
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Full name"
                value={formData.name}
                onChange={
                  handleChange
                }
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
              htmlFor="register-email"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              />
              <input
                id="register-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={
                  handleChange
                }
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
              htmlFor="register-password"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              />
              <input
                id="register-password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                name="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={
                  formData.password
                }
                onChange={
                  handleChange
                }
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
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-200"
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
          <div>
            <label
              htmlFor="register-confirm-password"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              />
              <input
                id="register-confirm-password"
                type={
                  showConfirm
                    ? 'text'
                    : 'password'
                }
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={
                  formData.confirmPassword
                }
                onChange={
                  handleChange
                }
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
                  setShowConfirm(
                    (previous) =>
                      !previous
                  )
                }
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-200"
                aria-label={
                  showConfirm
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                {showConfirm ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}
              </button>
            </div>
          </div>
          {isAdmin && (
            <div>
              <label
                htmlFor="register-role"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Account Role
              </label>
              <select
                id="register-role"
                name="role"
                value={
                  formData.role
                }
                onChange={
                  handleChange
                }
                disabled={loading}
                className={inputClass}
              >
                <option value="staff">
                  Staff
                </option>
                <option value="investor">
                  Investor
                </option>
                <option value="admin">
                  Admin
                </option>
              </select>
              <p
                className="mt-1.5 text-xs text-gray-400 dark:text-gray-500"
              >
                Only admins should be able to assign privileged roles.
              </p>
            </div>
          )}
          {!isAdmin && (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300"
            >
              <ShieldCheck
                className="mt-0.5 h-4 w-4 flex-shrink-0"
              />
              New public accounts are created as staff accounts.
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 font-semibold text-white shadow-md shadow-amber-900/10 transition hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle
                size={19}
                className="animate-spin"
              />
            ) : (
              <UserPlus
                size={19}
              />
            )}
            {loading
              ? 'Creating...'
              : isAdmin
                ? 'Create User'
                : 'Create Account'}
          </button>
        </form>
        <div
          className="mt-7 border-t border-gray-200 pt-6 text-center dark:border-slate-700"
        >
          <p
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            {isAdmin
              ? 'Return to your dashboard'
              : 'Already have an account?'}
          </p>
          <Link
            to={
              isAdmin
                ? '/'
                : '/login'
            }
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-brand-primary px-5 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-white dark:border-brand-secondary dark:text-brand-secondary dark:hover:bg-brand-secondary dark:hover:text-slate-950"
          >
            {isAdmin
              ? 'Back to Dashboard'
              : 'Sign In'}
          </Link>
        </div>
      </main>
      {showOtpModal && (
        <div
          className="safe-top safe-bottom fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-otp-heading"
        >
          <div
            className="relative my-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-7"
          >
            {!otpSuccess && (
              <button
                type="button"
                onClick={
                  closeOtpModal
                }
                disabled={
                  otpLoading
                }
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-gray-200"
                aria-label="Close verification"
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
                  <Mail
                    className="h-8 w-8"
                  />
                )}
              </div>
              <h2
                id="registration-otp-heading"
                className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl"
              >
                {otpSuccess
                  ? 'Email Verified'
                  : 'Verify Your Email'}
              </h2>
              {!otpSuccess && (
                <>
                  <p
                    className="mt-2 text-sm text-gray-500 dark:text-gray-400"
                  >
                    Enter the 6-digit code sent to
                    <br />
                    <span
                      className="break-all font-medium text-gray-700 dark:text-gray-200"
                    >
                      {registrationEmail}
                    </span>
                  </p>
                  <p
                    className="mt-1 text-xs text-gray-400 dark:text-gray-500"
                  >
                    Check your inbox and spam folder.
                  </p>
                </>
              )}
            </div>
            {otpSuccess ? (
              <div
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300"
              >
                <CheckCircle
                  className="mr-1 inline h-4 w-4"
                />
                {isAdmin
                  ? 'User verified. Returning to dashboard...'
                  : 'Account verified. Redirecting to login...'}
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
                    htmlFor="registration-otp"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Verification Code
                  </label>
                  <input
                    id="registration-otp"
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
                    : 'Verify Email'}
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
export default Register;
