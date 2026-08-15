import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { APP_ICONS } from '../../constants/icons';
import './Login.css'; // New CSS file

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const emailInputRef = useRef(null);
  const navigate = useNavigate();

  // Focus email input on mount
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  const login = async () => {
    setError(null);
    if (!email || !password) {
      setError('Please enter your email/username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const LOCAL_URL = window.location.hostname === 'localhost' ? 'http://localhost:5001/api' : 'http://10.0.2.2:5000/api';
      const LIVE_URL = 'https://chhay-achaaya-backend.onrender.com/api';
      const apiUrl = process.env.REACT_APP_API_URL || (isLocal ? LOCAL_URL : LIVE_URL);
      const res = await axios.post(
        `${apiUrl}/auth/login`,
        { email, password }
      );

      const token = res.data.token;

      // Handle Remember Me logic (just saving token locally for now)
      if (rememberMe) {
        localStorage.setItem('token', token);
      } else {
        sessionStorage.setItem('token', token);
        localStorage.setItem('token', token); // For simplicity keeping it here as before, could be enhanced based on standard behaviors
      }

      if (onLogin) onLogin(token);
      navigate('/home');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 400 || err.response?.status === 403) {
        setError('Invalid email or password');
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again later.');
      } else if (!err.response) {
        setError('Network error. Check if backend is running.');
      } else {
        setError(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      login();
    }
  };

  return (
    <div className="login-container">
      {/* Background Blobs */}
      <div className="login-blob blob-1"></div>
      <div className="login-blob blob-2"></div>

      {/* Glass Card */}
      <div className="login-glass-card">

        <div className="login-header">
          <div className="login-logo">
            <Icon name={APP_ICONS.activity} size={32} color="#7C5CFF" />
            <span className="login-logo-text">Connectify</span>
          </div>
          <div className="login-tagline">Connect with people who match your vibe.</div>
        </div>

        {error && (
          <div className="login-error">
            <Icon name={APP_ICONS.warning} size={16} />
            {error}
          </div>
        )}

        <div className="login-form-group">
          <div className="login-input-wrapper">
            <input
              ref={emailInputRef}
              type="text"
              className="login-input"
              placeholder="Email or Username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <div className="login-input-icon">
              <Icon name={APP_ICONS.user} size={18} />
            </div>
          </div>
        </div>

        <div className="login-form-group">
          <div className="login-input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              className="login-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <div className="login-input-icon">
              <Icon name={APP_ICONS.lock} size={18} />
            </div>
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              <Icon name={showPassword ? APP_ICONS.eyeOff : APP_ICONS.eye} size={18} />
            </button>
          </div>
        </div>

        <div className="login-controls">
          <label className="remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <a
            href="#"
            className="forgot-password"
            onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}
          >
            Forgot Password?
          </a>
        </div>

        <button
          className="login-btn"
          onClick={login}
          disabled={isLoading}
        >
          {isLoading ? <div className="spinner"></div> : "Login"}
        </button>

        <div className="login-footer">
          New user?
          <button onClick={() => navigate('/register')}>Create account</button>
        </div>

      </div>
    </div>
  );
}

export default Login;
