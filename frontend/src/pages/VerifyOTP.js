import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './VerifyOTP.css';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const LOCAL_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'http://10.0.2.2:5000/api';
const LIVE_URL = 'https://chhay-achaaya-backend.onrender.com/api';
const API_URL = process.env.REACT_APP_API_URL || (isLocal ? LOCAL_URL : LIVE_URL);
const OTP_RESEND_COOLDOWN = 60;

function VerifyOTP({ onLogin }) {
  const [searchParams] = useSearchParams();
  const emailFromParams = searchParams.get('email') || '';
  const hadEmailError = searchParams.get('emailError') === '1';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [email] = useState(emailFromParams);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(hadEmailError ? 0 : OTP_RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(hadEmailError);

  const inputRefs = useRef([]);
  const navigate = useNavigate();

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // only last char
    setOtp(newOtp);
    setError('');

    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (value && index === 5) {
      const allFilled = newOtp.every(d => d !== '');
      if (allFilled) {
        submitOTP(newOtp.join(''));
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const code = otp.join('');
      if (code.length === 6) submitOTP(code);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || '';
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) submitOTP(pasted);
  };

  const submitOTP = useCallback(async (code) => {
    if (!email) { setError('Email not found. Please register again.'); return; }
    setIsLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/verify-otp`, { email, otp: code });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      if (onLogin) onLogin(token);
      setSuccess('✅ Email verified! Redirecting...');
      setTimeout(() => navigate('/home'), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [email, navigate, onLogin]);

  const handleVerify = () => {
    const code = otp.join('');
    if (code.length !== 6) { setError('Please enter all 6 digits'); return; }
    submitOTP(code);
  };

  const handleResend = async () => {
    if (!canResend || !email) return;
    setError('');
    setSuccess('');
    try {
      await axios.post(`${API_URL}/auth/resend-otp`, { email });
      setSuccess('New OTP sent to your email!');
      setResendCooldown(OTP_RESEND_COOLDOWN);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    }
  };

  return (
    <div className="otp-container">
      {/* Background blobs */}
      <div className="otp-blob blob-1" />
      <div className="otp-blob blob-2" />

      <div className="otp-card">
        {/* Header */}
        <div className="otp-icon-wrapper">
          <div className="otp-icon">✉️</div>
          <div className="otp-icon-ring" />
        </div>

        {hadEmailError && (
          <div className="otp-email-warning">
            ⚠️ We couldn't send the verification email. Please click <strong>Resend OTP</strong> below to get your code.
          </div>
        )}

        <h1 className="otp-title">Verify your email</h1>
        <p className="otp-subtitle">
          We sent a 6-digit code to<br />
          <span className="otp-email">{email || 'your email'}</span>
        </p>

        {/* OTP input boxes */}
        <div className="otp-inputs" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => (inputRefs.current[index] = el)}
              id={`otp-digit-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleOtpChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              className={`otp-input ${digit ? 'filled' : ''} ${error ? 'error-shake' : ''}`}
              disabled={isLoading}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {/* Error / Success */}
        {error && <div className="otp-error">{error}</div>}
        {success && <div className="otp-success">{success}</div>}

        {/* Verify button */}
        <button
          id="verify-otp-btn"
          className="otp-verify-btn"
          onClick={handleVerify}
          disabled={isLoading || otp.join('').length !== 6}
        >
          {isLoading ? <span className="spinner" /> : 'Verify Email'}
        </button>

        {/* Resend */}
        <div className="otp-resend">
          <span>Didn't get the code? </span>
          {canResend ? (
            <button className="otp-resend-btn" onClick={handleResend}>
              Resend OTP
            </button>
          ) : (
            <span className="otp-countdown">Resend in {resendCooldown}s</span>
          )}
        </div>

        {/* Back to login */}
        <button className="otp-back" onClick={() => navigate('/login')}>
          ← Back to Login
        </button>
      </div>
    </div>
  );
}

export default VerifyOTP;
