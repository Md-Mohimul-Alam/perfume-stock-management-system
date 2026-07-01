import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import toast from 'react-hot-toast';
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import logo from "../../public/logo.jpg";

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  // OTP states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const validateForm = () => {
    if (!formData.name || !formData.email || !formData.password) {
      setError('All fields are required');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    try {
      const response = await API.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      // Store email for OTP verification
      setRegistrationEmail(formData.email);
      
      // Show OTP modal
      setShowOtpModal(true);
      setOtp('');
      setOtpError('');
      setOtpSuccess(false);
      
      toast.success(response.data.message || 'Registration successful! Check your email for OTP.');
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed';
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
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
      await API.post('/auth/verify-registration', {
        email: registrationEmail,
        otp: otp.trim(),
      });
      setOtpSuccess(true);
      toast.success('Email verified successfully!');
      setTimeout(() => {
        setShowOtpModal(false);
        navigate('/login');
      }, 1500);
    } catch (err) {
      setOtpLoading(false);
      const msg = err.response?.data?.message || 'Invalid OTP. Please try again.';
      setOtpError(msg);
    }
  };

  const closeOtpModal = () => {
    setShowOtpModal(false);
    setOtp('');
    setOtpError('');
  };

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={logo} alt="logo" className="w-40 object-contain" />
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold font-serif text-brand-dark">Create User</h2>
          <p className="text-brand-muted mt-2">Add a new staff or admin</p>
          <p className="text-xs text-gray-400 mt-1">Admin limit: max 2 admins</p>
        </div>

        {/* Form */}
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
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="name"
                placeholder="Full name"
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-secondary"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="email"
                name="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-secondary"
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
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-4 py-3 pl-11 pr-11 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-secondary"
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

          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-4 py-3 pl-11 pr-11 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-secondary"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-secondary bg-white"
              disabled={loading}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="investor">Investor</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary text-white py-3 rounded-xl font-semibold hover:bg-brand-secondary transition disabled:opacity-50 shadow-md hover:shadow-lg"
          >
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </form>

        {/* Link to Login */}
        <div className="text-center mt-8">
          <p className="text-gray-600">Go back to</p>
          <Link
            to="/login"
            className="inline-block mt-3 px-6 py-2 rounded-full border border-gray-400 hover:bg-brand-primary hover:text-white transition"
          >
            Login
          </Link>
        </div>
      </div>

      {/* ============================================
          OTP Verification Modal
          ============================================ */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={closeOtpModal}
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
              <h3 className="text-2xl font-bold">Verify Your Email</h3>
              <p className="text-gray-500 mt-2">
                We've sent a 6‑digit OTP to <br />
                <span className="font-medium text-gray-700">{registrationEmail}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">Please check your inbox (and spam folder).</p>
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
                    Verified! Redirecting to login...
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={otpLoading || otpSuccess}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {otpLoading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <p className="text-center text-sm text-gray-500">
                Didn't receive it?{' '}
                <button
                  type="button"
                  onClick={() => {
                    // Resend OTP – re-trigger registration (or create a dedicated resend endpoint)
                    toast('Resending OTP... Please try registering again.');
                    setShowOtpModal(false);
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

export default Register;