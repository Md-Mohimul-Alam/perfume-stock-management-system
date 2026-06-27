import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import API from '../api/axios';
import logo from "../../public/logo.jpg";

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login: authLogin, setAuthUser } = useAuth(); // ✅ get setAuthUser
  const navigate = useNavigate();

  // OTP states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await API.post('/auth/login', { email, password });
      setLoading(false);
      setShowOtpModal(true);
      setOtp('');
      setOtpError('');
      setOtpSuccess(false);
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      setError(msg);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setOtpError('Please enter the OTP.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const response = await API.post('/auth/verify-otp', { email, otp });
      const { token, ...userData } = response.data;

      // ✅ Set auth state using context (updates user and localStorage)
      setAuthUser(userData, token);

      setOtpSuccess(true);
      setTimeout(() => {
        setShowOtpModal(false);
        navigate('/');
      }, 1000);
    } catch (err) {
      setOtpLoading(false);
      const msg = err.response?.data?.message || 'Invalid OTP. Please try again.';
      setOtpError(msg);
    }
  };

  const closeModal = () => {
    setShowOtpModal(false);
    setOtp('');
    setOtpError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={logo} alt="logo" className="w-40 object-contain" />
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-mutedNavy">Welcome Back</h2>
          <p className="text-gray-500 mt-2">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || showOtpModal}
                className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || showOtpModal}
                className="w-full px-4 py-3 pl-11 pr-11 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading || showOtpModal}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="text-center mt-8">
          <p className="text-gray-600">Don't have an account?</p>
          <Link
            to="/register"
            className="inline-block mt-3 px-6 py-2 rounded-full border border-gray-400 hover:bg-gray-800 hover:text-white transition"
          >
            Sign Up
          </Link>
        </div>
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold">Check Your Email</h3>
              <p className="text-gray-500 mt-2">
                We've sent a 6‑digit OTP to <br />
                <span className="font-medium text-gray-700">{email}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                  Enter OTP
                </label>
                <input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={otpLoading || otpSuccess}
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-400"
                  maxLength={6}
                  required
                  autoFocus
                />
                {otpError && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {otpError}
                  </p>
                )}
                {otpSuccess && (
                  <p className="text-green-500 text-sm mt-1 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Verified! Redirecting...
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={otpLoading || otpSuccess}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {otpLoading ? "Verifying..." : "Verify OTP"}
              </button>

              <p className="text-center text-sm text-gray-500">
                Didn't receive it?{' '}
                <button
                  type="button"
                  onClick={() => {
                    alert('Resend functionality not implemented. Please try logging in again.');
                  }}
                  className="text-blue-600 hover:underline"
                >
                  Resend
                </button>
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;