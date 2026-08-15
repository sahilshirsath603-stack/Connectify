require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const dns = require('dns');
// Force IPv4 for DNS resolution to fix ENETUNREACH on Render for Gmail SMTP (IPv6 issues)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { createRedisClient } = require('./config/redis');
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const userRoutes = require('./routes/userRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const authMiddleware = require('./middleware/authMiddleware');
const { initializeSocket } = require('./sockets/socket');

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// TEMPORARILY comment DB to confirm server works
connectDB();

// Initialize Redis (non-blocking — app works without it)
createRedisClient();

app.use('/api/groups', groupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/media', authMiddleware, mediaRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/connections', authMiddleware, connectionRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api', userRoutes);

const server = http.createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const User = require('./models/User');
const MicroRoom = require('./models/MicroRoom');
const Message = require('./models/Message');

const RoomArchive = require('./models/RoomArchive');

// Expiration Cron Jobs
setInterval(async () => {
  if (mongoose.connection.readyState !== 1) {
    return; // Skip execution if DB is not fully connected (e.g., during connection drops, sleep)
  }

  try {
    const now = new Date();
    // 1) Clear expired Auras
    const auraResult = await User.updateMany(
      { 'aura.expiresAt': { $lt: now }, 'aura.type': { $ne: null } },
      { $set: { aura: { type: null, color: null, icon: null, expiresAt: null } } }
    );
    if (auraResult.modifiedCount > 0) {
      global.io.emit('auras-expired');
    }

    // 2) Clear expired MicroRooms and their messages
    const expiredRooms = await MicroRoom.find({ expiresAt: { $lt: now } });
    if (expiredRooms.length > 0) {
      const roomIds = expiredRooms.map(r => r._id);

      // Archive rooms before deletion
      const archives = expiredRooms.map(room => {
        const durationHours = room.createdAt ? (room.expiresAt - room.createdAt) / 3600000 : 1;
        return {
          parentChatId: room.parentChatId,
          title: room.title,
          durationHours: Math.round(durationHours),
          totalMessages: room.stats?.messageCount || 0,
          peakParticipants: room.stats?.peakParticipants || room.participants?.length || 0,
          createdBy: room.createdBy
        };
      });
      if (archives.length > 0) {
        await RoomArchive.insertMany(archives);
      }

      await Message.deleteMany({ roomId: { $in: roomIds } });
      await MicroRoom.deleteMany({ _id: { $in: roomIds } });

      roomIds.forEach(id => {
        global.io.emit('micro-room-expired', id);
      });
    }
  } catch (err) {
    console.error('Error in expiration cron:', err);
  }
}, 60 * 1000); // Check every minute


global.io = io;

initializeSocket(io);

// Centralized error handler
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR HANDLER CAUGHT:", err);
  if (res.headersSent) {
    return next(err)
  }
  res.status(500).json({ message: 'Internal Server Error' });
});

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5000;

const startServer = (portToUse) => {
  const srv = server.listen(portToUse, () => {
    console.log(`🚀 Server running on port ${portToUse}`);
  });

  srv.on('error', (err) => {
    if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${portToUse} permission denied or in use (${err.code}). Trying port ${portToUse + 1}...`);
      startServer(portToUse + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

startServer(DEFAULT_PORT);
