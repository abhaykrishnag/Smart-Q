import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Mail, KeyRound, ShieldCheck } from 'lucide-react';
import Header from '../shared/Header';
import '../../styles/customer.css';
import {
  loginCustomer,
  registerCustomer,
  sendCustomerLoginOtp,
  setAuthToken,
  verifyCustomerLoginOtp
} from '../../services/api';
import { getServiceUnavailableMessage } from '../../utils/interactionHelpers.mjs';

const OTP_COOLDOWN_SECONDS = 60;

const CustomerLogin = ({ onNavigate, goBack, currentPage }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [authMode, setAuthMode] = useState('password'); // 'password' | 'otp'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    otp: ''
  });
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const cooldownRef = useRef(null);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (otpCooldown > 0) {
      cooldownRef.current = setTimeout(() => {
        setOtpCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(cooldownRef.current);
  }, [otpCooldown]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errorMessage) setErrorMessage('');
    if (successMessage) setSuccessMessage('');
    if (devOtp) setDevOtp('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setDevOtp('');

    try {
      setLoading(true);

      if (isSignUp) {
        const nameToSave = formData.name?.trim() || (formData.email ? formData.email.split('@')[0] : formData.mobile);
        await registerCustomer({
          name: nameToSave,
          email: formData.email,
          mobile: formData.mobile,
          password: formData.password
        });

        setSuccessMessage('Account created successfully. Please sign in.');
        setIsSignUp(false);
        setAuthMode('password');
        setFormData((prev) => ({
          ...prev,
          name: '',
          password: '',
          otp: ''
        }));
        return;
      }

      let data;
      if (authMode === 'otp') {
        data = await verifyCustomerLoginOtp({
          email: formData.email,
          otp: formData.otp
        });
      } else {
        data = await loginCustomer({
          emailOrPhone: formData.email,
          password: formData.password
        });
      }

      if (data?.user?.role !== 'customer') {
        setErrorMessage('This account is not authorized for customer sign in.');
        return;
      }

      if (data?.accessToken) {
        localStorage.setItem('token', data.accessToken);
        setAuthToken(data.accessToken);
      }

      onNavigate('customer-dashboard', {
        name: data.user?.name || (data.user?.email ? data.user.email.split('@')[0] : ''),
        email: data.user?.email || '',
        phone: data.user?.phone || ''
      });
    } catch (error) {
      const msg =
        getServiceUnavailableMessage(error) ||
        error?.response?.data?.message ||
        error?.message ||
        'Authentication failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = useCallback(async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setDevOtp('');

    if (!formData.email) {
      setErrorMessage('Enter your registered email to receive OTP.');
      return;
    }

    try {
      setOtpSending(true);
      const res = await sendCustomerLoginOtp(formData.email);
      setSuccessMessage(res?.message || 'OTP sent to your email successfully!');
      setDevOtp(res?.devOtp || '');
      setOtpCooldown(OTP_COOLDOWN_SECONDS);
    } catch (error) {
      setDevOtp('');
      setErrorMessage(error?.response?.data?.message || 'Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  }, [formData.email]);

  // Forgot password handler — switches to OTP mode and auto-sends OTP
  const handleForgotPassword = async () => {
    if (!formData.email) {
      setAuthMode('otp');
      setErrorMessage('Please enter your registered email first, then click Send OTP.');
      return;
    }
    setAuthMode('otp');
    setFormData((prev) => ({ ...prev, password: '', otp: '' }));
    // Auto-send OTP when switching via forgot password
    await handleSendOtp();
  };



  const switchAuthTab = (nextIsSignUp) => {
    setIsSignUp(nextIsSignUp);
    setAuthMode('password');
    setErrorMessage('');
    setSuccessMessage('');
    setDevOtp('');
    setLoading(false);
    setOtpCooldown(0);
    setFormData((prev) => ({
      ...prev,
      password: '',
      otp: '',
      name: nextIsSignUp ? prev.name : ''
    }));
  };

  const otpButtonDisabled = otpSending || otpCooldown > 0;
  const otpButtonLabel = otpSending
    ? 'Sending...'
    : otpCooldown > 0
      ? `Resend (${otpCooldown}s)`
      : 'Send OTP';
  const otpBannerMessage = devOtp
    ? `Email delivery is unavailable here. Use OTP ${devOtp} to sign in. It expires in 5 minutes.`
    : successMessage
      ? 'A 6-digit OTP has been sent to your registered email. It expires in 5 minutes.'
      : 'Enter your registered email and click Send OTP to receive a 6-digit code.';
  const otpBannerStyles = devOtp
    ? {
        background: 'linear-gradient(135deg, #fff7ed, #fefce8)',
        border: '1px solid #fdba74',
        color: '#9a3412'
      }
    : successMessage
      ? {
          background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)',
          border: '1px solid #bfdbfe',
          color: '#1e40af'
        }
      : {
          background: 'linear-gradient(135deg, #f8fafc, #eff6ff)',
          border: '1px solid #cbd5e1',
          color: '#475569'
        };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onNavigate={onNavigate} goBack={goBack} currentPage={currentPage} />

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--color-gray-50) 0%, var(--color-primary-bg) 100%)',
        padding: '2rem'
      }}>
        <div className="card" style={{
          maxWidth: '450px',
          width: '100%',
          padding: '2.5rem',
          border: '1px solid var(--color-gray-200)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{
              fontSize: '1.875rem',
              color: 'var(--color-gray-900)',
              marginBottom: '0.5rem',
              fontWeight: 700
            }}>
              {isSignUp ? 'Create Account' : (authMode === 'otp' ? 'OTP Verification' : 'Welcome Back')}
            </h2>
            <p style={{ color: 'var(--color-gray-500)' }}>
              {isSignUp
                ? 'Enter your details to register'
                : authMode === 'otp'
                  ? 'Enter the OTP sent to your email to sign in'
                  : 'Please enter your details to sign in'}
            </p>
          </div>

          {/* Sign In / Register Switch */}
          <div style={{
            display: 'flex',
            borderBottom: '2px solid var(--color-gray-200)',
            marginBottom: '2rem'
          }}>
            <button
              onClick={() => switchAuthTab(false)}
              style={{
                flex: 1,
                padding: '1rem',
                background: 'none',
                border: 'none',
                borderBottom: !isSignUp ? '2px solid var(--color-primary)' : 'none',
                marginBottom: '-2px',
                color: !isSignUp ? 'var(--color-primary)' : 'var(--color-gray-500)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => switchAuthTab(true)}
              style={{
                flex: 1,
                padding: '1rem',
                background: 'none',
                border: 'none',
                borderBottom: isSignUp ? '2px solid var(--color-primary)' : 'none',
                marginBottom: '-2px',
                color: isSignUp ? 'var(--color-primary)' : 'var(--color-gray-500)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Register
            </button>
          </div>



          <form onSubmit={handleLogin}>
            {isSignUp ? (
              // Register Form (All fields)
              <>
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="name@gmail.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="mobile">Mobile Number</label>
                  <input
                    type="tel"
                    id="mobile"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleInputChange}
                    placeholder="Enter Number"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter Password"
                    required
                  />
                </div>
              </>
            ) : (
              // Sign In Form
              <>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="name@gmail.com"
                    required
                  />
                </div>

                {authMode === 'otp' ? (
                  /* ───── OTP Mode ───── */
                  <>
                    {/* OTP info banner */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      background: otpBannerStyles.background,
                      border: otpBannerStyles.border
                    }}>
                      <ShieldCheck size={18} style={{ color: otpBannerStyles.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', color: otpBannerStyles.color }}>
                        {otpBannerMessage}
                      </span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="otp" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <KeyRound size={14} /> One Time Password
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          id="otp"
                          name="otp"
                          value={formData.otp}
                          onChange={handleInputChange}
                          placeholder="Enter 6-digit OTP"
                          maxLength="6"
                          style={{ letterSpacing: '0.25em', textAlign: 'center', fontWeight: 600, fontSize: '1.1rem' }}
                          required
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleSendOtp}
                          disabled={otpButtonDisabled}
                          style={{
                            whiteSpace: 'nowrap',
                            minWidth: '110px',
                            opacity: otpButtonDisabled ? 0.6 : 1,
                            cursor: otpButtonDisabled ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {otpButtonLabel}
                        </button>
                      </div>
                    </div>

                    {/* Back to password link */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('password');
                          setFormData((prev) => ({ ...prev, otp: '' }));
                          setErrorMessage('');
                          setSuccessMessage('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-gray-500)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <ArrowLeft size={13} /> Back to password login
                      </button>
                    </div>
                  </>
                ) : (
                  /* ───── Password Mode ───── */
                  <>
                    <div className="form-group">
                      <label htmlFor="password">Password</label>
                      <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Enter Password"
                        required
                      />
                    </div>

                    {/* Forgot Password link */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', marginBottom: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={otpSending}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          fontSize: '0.8rem',
                          padding: 0,
                          cursor: 'pointer',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <Mail size={13} />
                        {otpSending ? 'Sending OTP...' : 'Forgot Password? Login via OTP'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {(errorMessage || successMessage) && (
              <p
                style={{
                  color: errorMessage ? '#dc2626' : '#16a34a',
                  marginTop: '0.5rem',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                {errorMessage || successMessage}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}
            >
              {loading
                ? (isSignUp ? 'Creating...' : (authMode === 'otp' ? 'Verifying OTP...' : 'Signing In...'))
                : (isSignUp ? 'Create Account' : (authMode === 'otp' ? 'Verify OTP & Sign In' : 'Sign In'))}
            </button>
          </form>

          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-gray-200)' }}>
            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-gray-500)', marginBottom: '1rem' }}>
              Don't have an account?
            </p>
            <button
              className="btn-secondary"
              onClick={() => onNavigate('join-queue')}
              style={{ width: '100%' }}
            >
              Join Queue as Guest
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <a href="#" onClick={(e) => {
              e.preventDefault();
              onNavigate('landing');
            }} style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={16} /> Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerLogin;

