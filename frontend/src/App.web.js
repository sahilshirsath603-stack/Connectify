import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import axios from 'axios';

// Web-specific layouts & pages
import WebAppLayout from './layout/web/AppLayout';
import Login from './pages/web/Login';
import Register from './pages/web/Register';
import VerifyOTP from './pages/web/VerifyOTP';
import ForgotPassword from './pages/web/ForgotPassword';
import ResetPassword from './pages/web/ResetPassword';

// Shared pages (not yet split — used by both platforms)
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

function AppWeb() {
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

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register onLogin={handleLogin} />} />
        <Route path="/verify-otp" element={<Navigate to={token ? "/home" : "/login"} replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected — Web Layout */}
        <Route
          element={
            token ? (
              <ProtectedRoute token={token}>
                <WebAppLayout onLogout={handleLogout} />
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

export default AppWeb;
