import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import { APP_ICONS } from '../constants/icons';
import './ForgotPassword.css'; /* reuse same CSS */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const LOCAL_URL = window.location.hostname === 'localhost' ? 'http://localhost:5001/api' : 'http://10.0.2.2:5000/api';
const LIVE_URL = 'https://chhay-achaaya-backend.onrender.com/api';
const API_URL = process.env.REACT_APP_API_URL || (isLocal ? LOCAL_URL : LIVE_URL);

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!newPassword || !confirmPassword) { setError('Please fill in both fields'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!token || !email) { setError('Invalid reset link. Please request a new one.'); return; }

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { email, token, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fp-container">
        <div className="fp-blob blob-1" />
        <div className="fp-blob blob-2" />
        <div className="fp-card">
          <div className="fp-success-state">
            <div className="fp-success-icon">✅</div>
            <h1 className="fp-title">Password reset!</h1>
            <p className="fp-subtitle">Your password has been updated successfully. You can now log in with your new password.</p>
            <button id="rp-go-login" className="fp-btn" onClick={() => navigate('/login')}>
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fp-container">
      <div className="fp-blob blob-1" />
      <div className="fp-blob blob-2" />

      <div className="fp-card">
        <div className="fp-icon-wrapper">
          <div className="fp-icon">🔑</div>
        </div>
        <h1 className="fp-title">Set new password</h1>
        <p className="fp-subtitle">Create a strong, new password for <span className="fp-email">{email}</span>.</p>

        {error && <div className="fp-error">{error}</div>}

        <form onSubmit={handleSubmit} className="fp-form">
          <div className="fp-input-group" style={{ position: 'relative' }}>
            <input
              id="rp-new-password"
              type={showPass ? 'text' : 'password'}
              className="fp-input"
              placeholder="New password (min 6 characters)"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setError(''); }}
              disabled={isLoading}
              autoFocus
              style={{ paddingRight: '44px' }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <Icon name={showPass ? APP_ICONS.eyeOff : APP_ICONS.eye} size={18} />
            </button>
          </div>
          <div className="fp-input-group" style={{ position: 'relative' }}>
            <input
              id="rp-confirm-password"
              type={showPass ? 'text' : 'password'}
              className="fp-input"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
              disabled={isLoading}
              style={{ paddingRight: '44px' }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <Icon name={showPass ? APP_ICONS.eyeOff : APP_ICONS.eye} size={18} />
            </button>
          </div>

          <button
            id="rp-submit-btn"
            type="submit"
            className="fp-btn"
            disabled={isLoading}
          >
            {isLoading ? <span className="fp-spinner" /> : 'Reset Password'}
          </button>
        </form>

        <button className="fp-back" onClick={() => navigate('/login')}>
          ← Back to Login
        </button>
      </div>
    </div>
  );
}

export default ResetPassword;
