import { io } from 'socket.io-client';

let socket;

export const connectSocket = (token) => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const LIVE_URL = 'https://chhay-achaaya-backend.onrender.com';
  const LOCAL_URL = window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'http://10.0.2.2:5001';
  
  socket = io(process.env.REACT_APP_SOCKET_URL || (isLocal ? LOCAL_URL : LIVE_URL), {
    auth: { token }
  });
  return socket;
};

export const getSocket = () => socket;

export const toggleReaction = ({ chatId, groupId, messageId, emoji }) => {
  if (socket) {
    socket.emit('toggle-reaction', { chatId, groupId, messageId, emoji });
  }
};
