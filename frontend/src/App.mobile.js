import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import axios from 'axios';

// Mobile-specific layouts & pages
import MobileAppLayout from './layout/mobile/AppLayout';
import Login from './pages/mobile/Login';
import Register from './pages/mobile/Register';
import VerifyOTP from './pages/mobile/VerifyOTP';
import ForgotPassword from './pages/mobile/ForgotPassword';
import ResetPassword from './pages/mobile/ResetPassword';

// Shared pages (not yet split)
import Home from './components/home/Home';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import ProfilePage from './pages/ProfilePage';

import { SocketProvider } from './context/SocketContext';

const Groups = () => <div style={{ padding: 20 }}>Groups Coming Soon</div>;

function ProtectedRoute({ children, token }) {
  if (!token) return <Navigate to="/login" replace />;
  return <SocketProvider token={token}>{children}</SocketProvider>;
}

function AppMobile() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    window.location.href = '/login';
  };

  // Auto-logout on 401
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (error) => {
        if (error.response?.status === 401) handleLogout();
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // Android hardware back button
  useEffect(() => {
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        CapacitorApp.exitApp();
      } else {
        window.history.back();
      }
    });
    return () => CapacitorApp.removeAllListeners();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register onLogin={handleLogin} />} />
        <Route path="/verify-otp" element={<Navigate to={token ? "/home" : "/login"} replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected — Mobile Layout */}
        <Route
          element={
            token ? (
              <ProtectedRoute token={token}>
                <MobileAppLayout onLogout={handleLogout} />
              </ProtectedRoute>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/home" element={<Home token={token} />} />
          <Route path="/messages" element={<Chat token={token} onLogout={handleLogout} />} />
          <Route path="/messages/:id" element={<Chat token={token} onLogout={handleLogout} />} />
          <Route path="/rooms" element={<Chat token={token} onLogout={handleLogout} />} />
          <Route path="/rooms/:id" element={<Chat token={token} onLogout={handleLogout} />} />
          <Route path="/notifications" element={<Notifications token={token} />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/profile" element={<ProfilePage token={token} />} />
          <Route path="/profile/:id" element={<ProfilePage token={token} />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to={token ? '/home' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppMobile;
