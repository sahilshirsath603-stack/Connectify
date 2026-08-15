import axios from 'axios';

// Prioritize environment variable, then local dev URLs based on hostname
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const LIVE_URL = 'https://chhay-achaaya-backend.onrender.com/api';
const LOCAL_URL = window.location.hostname === 'localhost' ? 'http://localhost:5001/api' : 'http://10.0.2.2:5001/api';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || (isLocal ? LOCAL_URL : LIVE_URL),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const updateProfile = async (profileData) => {
  const response = await api.put('/auth/users/profile', profileData);
  return response.data;
};

export const updateAura = async (auraData) => {
  const response = await api.put('/auth/users/aura', auraData);
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/users/me');
  return response.data;
};

export const getRoomArchives = async () => {
  const response = await api.get('/auth/users/room-archives');
  return response.data;
};

export const getUsers = async () => {
  const response = await api.get('/auth/users');
  return response.data;
};

export const uploadAvatar = async (avatarFile) => {
  const formData = new FormData();
  formData.append('avatar', avatarFile, 'avatar.jpg');
  const response = await api.post('/auth/users/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const deleteAccount = async (password) => {
  const response = await api.delete('/auth/users/delete-account', {
    data: { password }
  });
  return response.data;
};

export default api;
