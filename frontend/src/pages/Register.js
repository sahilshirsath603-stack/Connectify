import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import { APP_ICONS } from '../constants/icons';
import './Register.css';

const DEFAULT_MOODS = ['Happy', 'Chill', 'Focused', 'Energetic', 'Night Owl'];
const PRESET_INTERESTS = ['Gaming', 'Music', 'Coding', 'Movies', 'Books', 'Fitness', 'Art', 'Travel'];

function Register({ onLogin }) {
  const navigate = useNavigate();
  const nameInputRef = useRef(null);

  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [selectedMood, setSelectedMood] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Validation State
  const [usernameStatus, setUsernameStatus] = useState(null); // 'checking', 'available', 'taken', null
  const [passwordStrength, setPasswordStrength] = useState(null); // 'weak', 'medium', 'strong', null

  const getApiUrl = () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const LOCAL_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'http://10.0.2.2:5000/api';
    const LIVE_URL = 'https://chhay-achaaya-backend.onrender.com/api';
    return process.env.REACT_APP_API_URL || (isLocal ? LOCAL_URL : LIVE_URL);
  };

  // Auto-focus first input
  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  // Username Availability Debounce
  useEffect(() => {
    const checkUsername = async () => {
      if (!username || username.length < 3) {
        setUsernameStatus(null);
        return;
      }

      const isValid = /^[a-zA-Z0-9_]+$/.test(username);
      if (!isValid) {
        setUsernameStatus('invalid');
        return;
      }

      setUsernameStatus('checking');
      try {
        const res = await axios.get(`${getApiUrl()}/auth/check-username?username=${username}`);
        setUsernameStatus(res.data.available ? 'available' : 'taken');
      } catch (err) {
        setUsernameStatus('error');
      }
    };

    const debounceTimer = setTimeout(checkUsername, 500);
    return () => clearTimeout(debounceTimer);
  }, [username]);

  // Password Strength and Match logic
  useEffect(() => {
    if (!password) {
      setPasswordStrength(null);
    } else {
      let strength = 0;
      if (password.length >= 8) strength += 1;
      if (/[A-Z]/.test(password)) strength += 1;
      if (/[0-9]/.test(password)) strength += 1;

      if (strength === 1) setPasswordStrength('weak');
      else if (strength === 2) setPasswordStrength('medium');
      else if (strength === 3) setPasswordStrength('strong');
      else setPasswordStrength('weak');
    }

  }, [password]);

  // Handlers
  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      if (selectedInterests.length < 5) { // Arbitrary limit of 5 tags
        setSelectedInterests([...selectedInterests, interest]);
      }
    }
  };

  const isFormValid = () => {
    return (
      name &&
      email &&
      username && usernameStatus === 'available' &&
      password && passwordStrength !== 'weak'
    );
  };

  const handleSubmit = async () => {
    setError(null);
    if (!isFormValid()) return;

    // Email format validation broadly
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Creating your account…');
    // After a moment, update message to reflect the email step
    const emailMsgTimer = setTimeout(() => setLoadingMessage('Sending verification email…'), 2000);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('username', username);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('bio', bio);
      if (selectedMood) formData.append('defaultMood', selectedMood);
      formData.append('interests', JSON.stringify(selectedInterests));
      if (avatarFile) {
        formData.append('profileImage', avatarFile);
      }

      const res = await axios.post(
        `${getApiUrl()}/auth/signup`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000, // 30s — covers slow SMTP sends
        }
      );

      // Redirect to OTP verification page (even if email delivery had issues)
      if (res.data.requiresVerification) {
        const emailError = res.data.error; // 'EMAIL_DELIVERY_FAILED' | 'EMAIL_NOT_CONFIGURED'
        const params = new URLSearchParams({ email: res.data.email || email });
        if (emailError) params.set('emailError', '1');
        navigate(`/verify-otp?${params.toString()}`);
      } else {
        navigate('/login');
      }

    } catch (err) {
      clearTimeout(emailMsgTimer);
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Request timed out. The server may be slow — please try again.');
      } else if (!err.response) {
        setError('Network error. Check your internet connection or try again.');
      } else {
        setError(err.response?.data?.message || 'Registration failed. Please try a different email or username.');
      }
    } finally {
      clearTimeout(emailMsgTimer);
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="register-container">
      {/* Background Blobs */}
      <div className="register-blob reg-blob-1"></div>
      <div className="register-blob reg-blob-2"></div>

      <div className="register-glass-card">

        <div className="register-header">
          <div className="register-logo">
            <Icon name={APP_ICONS.activity} size={32} color="#7C5CFF" />
            <span className="register-logo-text">Connectify</span>
          </div>
          <div className="register-subtitle">Connect with people who match your vibe.</div>
        </div>

        {error && (
          <div className="register-error">
            <Icon name={APP_ICONS.warning} size={16} />
            {error}
          </div>
        )}

        {/* Profile Initialization */}
        <div className="avatar-upload-container">
          <label className={`avatar-preview ${avatarPreview ? 'has-image' : ''}`}>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="avatar-input-hidden"
            />
            <div className="upload-icon">
              <Icon name={APP_ICONS.camera} size={24} />
            </div>
            {avatarPreview && <img src={avatarPreview} alt="Preview" />}
          </label>
          <div className="avatar-label-text">Set profile picture (optional)</div>
        </div>

        <div className="form-section-title">Required Information</div>

        <div className="register-form-group">
          <div className="register-input-wrapper">
            <input
              ref={nameInputRef}
              type="text"
              className="register-input"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="register-input-icon"><Icon name={APP_ICONS.user} size={18} /></div>
          </div>
        </div>

        <div className="register-form-group">
          <div className="register-input-wrapper">
            <input
              type="text"
              className="register-input"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              onKeyDown={handleKeyDown}
            />
            <div className="register-input-icon"><Icon name={APP_ICONS.atSign} size={18} /></div>

            {username && usernameStatus && (
              <div className={`username-indicator ${usernameStatus}`}>
                {usernameStatus === 'checking' && <Icon name={APP_ICONS.activity} size={14} />}
                {usernameStatus === 'available' && <Icon name={APP_ICONS.checkCircle} size={14} />}
                {usernameStatus === 'taken' && <Icon name={APP_ICONS.xCircle} size={14} />}
                {usernameStatus === 'invalid' && <Icon name={APP_ICONS.warning} size={14} />}
              </div>
            )}
          </div>
          {username && usernameStatus && (
            <div className={`username-text-indicator text-${usernameStatus}`}>
              {usernameStatus === 'checking' && "Checking availability..."}
              {usernameStatus === 'available' && "Username is available"}
              {usernameStatus === 'taken' && "This username is already taken"}
              {usernameStatus === 'invalid' && "Use only letters, numbers, and underscores"}
            </div>
          )}
        </div>

        <div className="register-form-group">
          <div className="register-input-wrapper">
            <input
              type="email"
              className="register-input"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="register-input-icon"><Icon name={APP_ICONS.mail} size={18} /></div>
          </div>
        </div>

        <div className="register-form-group">
          <div className="register-input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              className="register-input"
              placeholder="Password (min 8 chars, 1 uppercase, 1 number)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="register-input-icon"><Icon name={APP_ICONS.lock} size={18} /></div>
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <Icon name={showPassword ? APP_ICONS.eyeOff : APP_ICONS.eye} size={18} />
            </button>
          </div>
          {password && passwordStrength && (
            <div className={`password-strength-meter strength-${passwordStrength}`}>
              <div className="strength-bar"></div>
            </div>
          )}
          {passwordStrength && (
            <div className={`strength-text strength-${passwordStrength}`}>
              {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)} Password
            </div>
          )}
        </div>

        <div className="form-section-title">Onboarding (Optional)</div>

        <div className="register-form-group">
          <div className="register-input-wrapper">
            <textarea
              className="register-input textarea"
              placeholder="Write a short bio about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={120}
            />
            <div className="text-counter">{bio.length}/120</div>
          </div>
        </div>

        <div className="register-form-group" style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px', display: 'block' }}>Default Mood Aura</label>
          <div className="mood-chips">
            {DEFAULT_MOODS.map(mood => (
              <div
                key={mood}
                className={`mood-chip ${selectedMood === mood ? 'selected' : ''}`}
                onClick={() => setSelectedMood(mood === selectedMood ? '' : mood)}
              >
                {mood}
              </div>
            ))}
          </div>
        </div>

        <div className="register-form-group">
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px', display: 'block' }}>Select Interests (max 5)</label>
          <div className="interests-grid">
            {PRESET_INTERESTS.map(interest => {
              const checked = selectedInterests.includes(interest);
              return (
                <div
                  key={interest}
                  className={`interest-tag ${checked ? 'selected' : ''}`}
                  onClick={() => toggleInterest(interest)}
                >
                  {checked && <Icon name={APP_ICONS.check} size={14} />}
                  {interest}
                </div>
              );
            })}
          </div>
        </div>

        <button
          className="register-btn"
          onClick={handleSubmit}
          disabled={!isFormValid() || isLoading}
        >
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
              <div className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }}></div>
              <span style={{ fontSize: '14px' }}>{loadingMessage || 'Creating account…'}</span>
            </span>
          ) : "Create Account"}
        </button>

        <div className="register-footer">
          Already have an account?
          <button onClick={() => navigate('/login')}>Login Here</button>
        </div>

      </div>
    </div>
  );
}

export default Register;
