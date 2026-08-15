import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './ForgotPassword.css';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const LOCAL_URL = window.location.hostname === 'localhost' ? 'http://localhost:5001/api' : 'http://10.0.2.2:5000/api';
const LIVE_URL = 'https://chhay-achaaya-backend.onrender.com/api';
const API_URL = process.env.REACT_APP_API_URL || (isLocal ? LOCAL_URL : LIVE_URL);

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email'); return; }
    setIsLoading(true);
    setError('');
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fp-container">
      <div className="fp-blob blob-1" />
      <div className="fp-blob blob-2" />

      <div className="fp-card">
        {sent ? (
          /* Success state */
          <div className="fp-success-state">
            <div className="fp-success-icon">📬</div>
            <h1 className="fp-title">Check your inbox</h1>
            <p className="fp-subtitle">
              If <span className="fp-email">{email}</span> is registered, you'll receive a password reset link shortly.
            </p>
            <p className="fp-hint">Don't forget to check your spam folder.</p>
            <button id="fp-back-login" className="fp-btn" onClick={() => navigate('/login')}>
              Back to Login
            </button>
          </div>
        ) : (
          /* Form state */
          <>
            <div className="fp-icon-wrapper">
              <div className="fp-icon">🔐</div>
            </div>
            <h1 className="fp-title">Forgot password?</h1>
            <p className="fp-subtitle">No worries! Enter your email and we'll send you a reset link.</p>

            {error && <div className="fp-error">{error}</div>}

            <form onSubmit={handleSubmit} className="fp-form">
              <div className="fp-input-group">
                <input
                  id="fp-email-input"
                  type="email"
                  className="fp-input"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <button
                id="fp-submit-btn"
                type="submit"
                className="fp-btn"
                disabled={isLoading}
              >
                {isLoading ? <span className="fp-spinner" /> : 'Send Reset Link'}
              </button>
            </form>

            <button className="fp-back" onClick={() => navigate('/login')}>
              ← Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
