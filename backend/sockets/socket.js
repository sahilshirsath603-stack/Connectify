const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');

const onlineUsers = new Set(); // global set of online userIds
const socketIds = new Map(); // userId -> socketId

// --- SMART AURA ENGINE ---
const userActivity = new Map(); // userId -> { lastMessageTimes: [], typingStarts: Map, lastActive: timestamp }

const checkAndSetAura = async (userId, type, label, color, icon) => {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const userFields = {
      'aura.type': type,
      'aura.label': label,
      'aura.color': color,
      'aura.icon': icon,
      'aura.expiresAt': expiresAt
    };
    const updatedUser = await User.findByIdAndUpdate(userId, { $set: userFields }, { new: true });
    if (updatedUser && global.io) {
      global.io.emit('aura-updated', { userId, aura: updatedUser.aura });
    }
  } catch (err) {
    console.error('Error auto-setting aura:', err);
  }
};

const recordActivity = (userId) => {
  if (!userActivity.has(userId)) {
    userActivity.set(userId, { lastMessageTimes: [], typingStarts: new Map(), lastActive: Date.now() });
  }
  const activity = userActivity.get(userId);
  activity.lastActive = Date.now();
  return activity;
};

setInterval(async () => {
  const now = Date.now();
  for (const [userId, activity] of userActivity.entries()) {
    if (now - activity.lastActive > 20 * 60 * 1000) {
      // Idle condition
      const user = await User.findById(userId);
      if (user && user.aura && ['active', 'deepwork'].includes(user.aura.type)) {
        await User.findByIdAndUpdate(userId, { $set: { aura: { type: null, color: null, icon: null, expiresAt: null, label: null } } });
        if (global.io) {
          global.io.emit('aura-updated', { userId, aura: { type: null, color: null, icon: null, expiresAt: null, label: null } });
        }
      }
      userActivity.delete(userId);
    }
  }
}, 60 * 1000);

const initializeSocket = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on('connection', async (socket) => {
    try {
      const userId = socket.userId;

      onlineUsers.add(userId);
      socketIds.set(userId, socket.id);

      // Join user to their group rooms
      const userGroups = await Group.find({ members: userId });
      userGroups.forEach(group => {
        socket.join(`group_${group._id}`);
      });

      // Emit online-users list to the new client
      const visibleUsersObj = await User.find({ _id: { $in: Array.from(onlineUsers) }, showOnlineStatus: { $ne: false } }, '_id');
      socket.emit('online-users', visibleUsersObj.map(u => u._id.toString()));

      socket.on(
        'send-message',
        async ({ chatId, text, type, fileUrl, fileName, fileSize, replyTo }) => {
          if (!chatId) return;

          const activity = recordActivity(userId);
          const now = Date.now();
          activity.lastMessageTimes.push(now);
          activity.lastMessageTimes = activity.lastMessageTimes.filter(t => now - t <= 3 * 60 * 1000);
          if (activity.lastMessageTimes.length > 5) {
            checkAndSetAura(userId, 'active', 'High Energy', '#F59E0B', 'Zap');
          }

          const [userA, userB] = chatId.split('-');
          const receiverId = new mongoose.Types.ObjectId(userId === userA ? userB : userA);

          const message = await Message.create({
            senderId: userId,
            receiverId,
            chatId,
            text: text || '',
            type: type || 'text',
            fileUrl: fileUrl || null,
            fileName: fileName || null,
            fileSize: fileSize || null,
            replyTo: replyTo || null,
            status: 'sent'
          });

          await message.populate('replyTo', 'text type senderId');

          const receiverSocketId = socketIds.get(receiverId.toString());

          if (receiverSocketId) {
            // Update status to delivered when sending to receiver
            await Message.findByIdAndUpdate(message._id, { status: 'delivered' });
            message.status = 'delivered';
            io.to(receiverSocketId).emit('receive-message', message);
          }

          socket.emit('receive-message', message);
        }
      );

      socket.on('typing', (data) => {
        const { chatId } = data;
        if (!chatId) return;

        const activity = recordActivity(userId);
        if (!activity.typingStarts.has(chatId)) {
          activity.typingStarts.set(chatId, Date.now());
        } else {
          if (Date.now() - activity.typingStarts.get(chatId) > 2 * 60 * 1000) {
            checkAndSetAura(userId, 'deepwork', 'Deep Work', '#3B82F6', 'Monitor');
          }
        }

        let room = chatId;
        // 1-1 chats have hyphens in their ID (userA-userB)
        if (chatId.includes('-')) {
          room = `chat_${chatId}`;
        } else {
          // Groups don't have hyphens (Mongo ObjectIds)
          room = `group_${chatId}`;
        }
        socket.to(room).emit('typing', { ...data, userId });
      });

      socket.on('stop-typing', (data) => {
        const { chatId } = data;
        if (!chatId) return;

        if (userActivity.has(userId)) {
          userActivity.get(userId).typingStarts.delete(chatId);
        }

        let room = chatId;
        if (chatId.includes('-')) {
          room = `chat_${chatId}`;
        } else {
          room = `group_${chatId}`;
        }
        socket.to(room).emit('stop-typing', { ...data, userId });
      });

      socket.on('join-group', ({ groupId }) => {
        if (!groupId) return;
        socket.join(`group_${groupId}`);
      });

      socket.on('group-message', async ({ groupId, text, type, fileUrl, fileName, fileSize, replyTo }) => {
        if (!groupId) return;

        const message = await Message.create({
          senderId: userId,
          receiverType: 'group',
          receiverId: groupId,
          chatId: groupId,
          text: text || '',
          type: type || 'text',
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          replyTo: replyTo || null,
          readBy: [userId] // Sender has read the message
        });

        await message.populate('replyTo', 'text type senderId');

        io.to(`group_${groupId}`).emit('receive-group-message', message);
      });

      socket.on('mark-read', async ({ chatId }) => {
        if (!chatId) return;

        const [userA, userB] = chatId.split('-');
        const senderId = userId === userA ? userB : userA;

        await Message.updateMany(
          { senderId, receiverId: userId, status: { $ne: 'read' } },
          { status: 'read', read: true }
        );

        socket.emit('messages-marked-read', { senderId });
      });

      socket.on('mark-group-read', async ({ groupId }) => {
        if (!groupId) return;

        // Add userId to readBy array for all unread messages in the group
        await Message.updateMany(
          {
            receiverType: 'group',
            receiverId: groupId,
            readBy: { $ne: userId }
          },
          { $addToSet: { readBy: userId } }
        );

        socket.emit('group-messages-marked-read', { groupId });
      });

      socket.on('join-chat', ({ chatId }) => {
        if (!chatId) return;
        socket.join(`chat_${chatId}`);
      });

      socket.on('toggle-reaction', async ({ chatId, groupId, messageId, emoji }) => {
        if (!messageId || !emoji) return;

        const message = await Message.findById(messageId);
        if (!message) return;

        const existingReactionIndex = message.reactions.findIndex(
          r => r.userId.toString() === userId && r.emoji === emoji
        );

        if (existingReactionIndex > -1) {
          // Remove reaction
          message.reactions.splice(existingReactionIndex, 1);
        } else {
          // Add reaction
          message.reactions.push({ userId, emoji });
        }

        await message.save();

        if (groupId) {
          // Group message - emit to group room
          io.to(`group_${groupId}`).emit('reaction-updated', message);
        } else if (chatId) {
          // One-to-one message - emit to both users
          const [userA, userB] = chatId.split('-');
          const socketIdA = socketIds.get(userA);
          const socketIdB = socketIds.get(userB);
          if (socketIdA) io.to(socketIdA).emit('reaction-updated', message);
          if (socketIdB) io.to(socketIdB).emit('reaction-updated', message);
        }
      });

      socket.on('delete-message', async ({ messageId }) => {
        if (!messageId) return;

        const message = await Message.findById(messageId);
        if (!message || message.senderId.toString() !== userId) return;

        await Message.findByIdAndDelete(messageId);

        if (message.chatId) {
          // One-to-one message - emit to chat room and directly to receiver
          io.to(`chat_${message.chatId}`).emit('message-deleted', { messageId });

          // Also emit directly to receiver for immediate sync
          const [userA, userB] = message.chatId.split('-');
          const receiverId = userId === userA ? userB : userA;
          const receiverSocketId = socketIds.get(receiverId);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit('message-deleted', { messageId });
          }
        } else if (message.receiverType === 'group') {
          // Group message - emit to group room
          io.to(`group_${message.receiverId}`).emit('message-deleted', { messageId });
        }
      });

      socket.on('set-aura', async ({ type, label, color, icon, expiresAt }) => {
        try {
          const finalExpiresAt = type ? (expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000)) : null;
          const userFields = { 
            'aura.type': type, 
            'aura.label': label,
            'aura.color': color, 
            'aura.icon': icon, 
            'aura.expiresAt': finalExpiresAt 
          };
          const updatedUser = await User.findByIdAndUpdate(userId, { $set: userFields }, { new: true });
          if (updatedUser) {
            io.emit('aura-updated', { userId, aura: updatedUser.aura });
          }
        } catch (error) {
          console.error("Error setting aura:", error);
        }
      });

      const MicroRoom = require('../models/MicroRoom');

      socket.on('create-micro-room', async ({ parentChatId, title, durationHours, type = 'live' }) => {
        try {
          const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);

          const newRoom = await MicroRoom.create({
            parentChatId,
            title,
            type,
            createdBy: userId,
            participants: [userId],
            expiresAt,
            stats: { messageCount: 0, peakParticipants: 1, reactionCount: 0 }
          });

          // Auto-set hosting aura
          const auraFields = {
            'aura.type': 'hosting',
            'aura.label': 'Hosting Room',
            'aura.color': '#FF4D6D',
            'aura.icon': 'Star', // basic icon string or matching your icon set
            'aura.expiresAt': expiresAt
          };
          const updatedUser = await User.findByIdAndUpdate(userId, { $set: auraFields }, { new: true });

          // Emit to parent chat that room was created
          if (parentChatId === 'global') {
            io.emit('micro-room-created', newRoom);
          } else {
            let roomStr = parentChatId.includes('-') ? `chat_${parentChatId}` : `group_${parentChatId}`;
            io.to(roomStr).emit('micro-room-created', newRoom);
          }

          if (updatedUser) {
            io.emit('aura-updated', { userId, aura: updatedUser.aura });
          }

          socket.emit('micro-room-joined', newRoom);
        } catch (error) {
          console.error("Error creating micro room:", error);
        }
      });

      socket.on('get-active-micro-rooms', async () => {
        try {
          const now = new Date();
          const activeRooms = await MicroRoom.find({ expiresAt: { $gt: now } }).sort({ createdAt: -1 });
          socket.emit('active-micro-rooms-data', activeRooms);
        } catch (error) {
          console.error("Error fetching micro rooms:", error);
        }
      });

      socket.on('join-micro-room', async ({ roomId }) => {
        try {
          const room = await MicroRoom.findById(roomId);
          if (room) {
            if (!room.participants.includes(userId)) {
              room.participants.push(userId);
              // Update peak participants
              if (room.participants.length > room.stats.peakParticipants) {
                room.stats.peakParticipants = room.participants.length;
              }
              await room.save();

              const roomStr = room.parentChatId.includes('-') ? `chat_${room.parentChatId}` : `group_${room.parentChatId}`;
              io.to(roomStr).emit('micro-room-updated', room);
            }
            socket.join(`micro_${roomId}`);
            socket.emit('micro-room-joined', room);
            // also load messages
            const messages = await Message.find({ roomId }).sort({ createdAt: 1 });
            socket.emit('micro-room-messages', { roomId, messages });
          }
        } catch (error) {
          console.error("Error joining micro room:", error);
        }
      });

      socket.on('send-micro-message', async ({ roomId, text, type, fileUrl, fileName, fileSize }) => {
        try {
          const room = await MicroRoom.findById(roomId);
          if (!room) return;

          const message = await Message.create({
            senderId: userId,
            receiverId: room.createdBy, // required in schema but conceptually it's a room message
            receiverType: 'group',
            roomId,
            text: text || '',
            type: type || 'text',
            fileUrl: fileUrl || null,
            fileName: fileName || null,
            fileSize: fileSize || null,
            status: 'sent'
          });

          room.stats.messageCount += 1;
          await room.save();

          if (room.stats.messageCount % 5 === 0) { // Emit updates periodically
            const roomStr = room.parentChatId.includes('-') ? `chat_${room.parentChatId}` : `group_${room.parentChatId}`;
            io.to(roomStr).emit('micro-room-updated', room);
          }

          io.to(`micro_${roomId}`).emit('receive-micro-message', message);
        } catch (error) {
          console.error('Error sending micro message:', error);
        }
      });

      socket.on('disconnect', async () => {
        onlineUsers.delete(socket.userId);

        // Update lastSeen in database
        const lastSeen = new Date();
        const user = await User.findByIdAndUpdate(socket.userId, { lastSeen }, { new: true });

        // Emit user-offline to all clients
        if (user && user.showOnlineStatus !== false) {
          io.emit('user-offline', { userId: socket.userId, lastSeen });
        } else {
          io.emit('user-offline', { userId: socket.userId, lastSeen: null });
        }
      });

    } catch (err) {
      console.error('Socket connection error:', err.message);
      socket.disconnect();
    }
  });
};

module.exports = { initializeSocket, onlineUsers, socketIds };
