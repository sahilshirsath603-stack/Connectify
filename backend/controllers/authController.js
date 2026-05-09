const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ConnectionRequest = require('../models/ConnectionRequest');
const { sendVerificationOTP, sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService');
const otpService = require('../services/otpService');

// ─── Helper: Sign JWT ────────────────────────────────────────────────────────
const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// CHECK USERNAME
const checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'Username query parameter required' });

    // allow letters, numbers, underscores. min 3, max 20
    const isValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
    if (!isValid) return res.status(400).json({ message: 'Invalid username format' });

    const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (existingUser) {
      return res.json({ available: false });
    }

    return res.json({ available: true });
  } catch (err) {
    console.error('Check username error:', err);
    res.status(500).json({ message: 'Failed to check username' });
  }
};

// SIGNUP
const signup = async (req, res) => {
  try {
    const { name, username, email, password, bio, defaultMood, interests } = req.body;

    if (!email || !password || !name || !username) {
      return res.status(400).json({ message: 'Name, username, email, and password required' });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const usernameExists = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (usernameExists) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Parse interests
    let parsedInterests = [];
    if (interests) {
      try {
        parsedInterests = typeof interests === 'string' ? JSON.parse(interests) : interests;
      } catch (e) {
        parsedInterests = interests.split(',').map(i => i.trim());
      }
    }

    let avatarUrl = null;
    if (req.file) {
      avatarUrl = req.file.path;
    }

    // Generate & store OTP securely
    const otp = otpService.generateOTP();
    const hashedOtp = await otpService.hashOTP(otp);

    const newUser = await User.create({
      name,
      username,
      email,
      passwordHash: hashedPassword,
      about: bio || '',
      defaultMood: defaultMood || null,
      interests: parsedInterests,
      avatar: avatarUrl,
      isVerified: false, // must verify via OTP
    });

    // Store hashed OTP in Redis (5 min TTL)
    const redisStored = await otpService.storeOTP(newUser._id.toString(), hashedOtp);

    // Fallback: if Redis unavailable, store in Mongo temporarily
    if (!redisStored) {
      newUser.emailVerifyOTP = hashedOtp;
      newUser.emailVerifyOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
      await newUser.save();
    }

    // Pre-check SMTP credentials before sending
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('❌ SMTP credentials missing: GMAIL_USER or GMAIL_APP_PASSWORD not set in environment.');
      // Don't delete user — keep them unverified so they can resend later
      return res.status(201).json({
        message: 'Account created but email delivery is not configured. Please contact support.',
        requiresVerification: true,
        email,
        error: 'EMAIL_NOT_CONFIGURED',
      });
    }

    // Send OTP email — if this fails, keep user alive so they can resend OTP
    try {
      await sendVerificationOTP(email, name, otp);
    } catch (emailErr) {
      console.error('❌ Failed to send OTP email:', emailErr.message);
      // Do NOT delete the user — they can use resend-otp to retry
      return res.status(201).json({
        message: 'Account created but we could not send the verification email. Please try resending the OTP.',
        requiresVerification: true,
        email,
        error: 'EMAIL_DELIVERY_FAILED',
      });
    }

    res.status(201).json({
      message: 'Account created. Please verify your email with the OTP sent to ' + email,
      requiresVerification: true,
      email,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Signup failed' });
  }
};

// LOGIN (accepts email OR username)
const login = async (req, res) => {
  try {
    const { email: identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/username and password required' });
    }

    // Find by email OR username (case-insensitive)
    const isEmail = identifier.includes('@');
    const user = await User.findOne(
      isEmail
        ? { email: identifier.toLowerCase().trim() }
        : { username: { $regex: new RegExp(`^${identifier.trim()}$`, 'i') } }
    );

    if (!user || !user.passwordHash) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check email verification
    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: user.email,
      });
    }

    const token = signToken(user._id);
    res.json({ token });
  } catch (err) {
    console.error(err);

    res.status(500).json({ message: 'Login failed' });
  }
};

// VERIFY OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // ── Redis-backed verification (with bcrypt compare + attempt limiting) ──
    const result = await otpService.verifyOTP(user._id.toString(), otp.toString());

    if (!result.success) {
      // Fallback: if Redis unavailable, check Mongo stored hash
      if (result.error.includes('expired or does not exist') && user.emailVerifyOTP) {
        const mongoMatch = await bcrypt.compare(otp.toString(), user.emailVerifyOTP);
        if (!mongoMatch) {
          return res.status(400).json({ message: 'Invalid OTP.' });
        }
        if (user.emailVerifyOTPExpiry && new Date() > user.emailVerifyOTPExpiry) {
          return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }
        // Mongo fallback matched — continue below
      } else {
        return res.status(400).json({
          message: result.error,
          attemptsLeft: result.attemptsLeft,
        });
      }
    }

    // Mark verified & clear OTP fields
    user.isVerified = true;
    user.emailVerifyOTP = null;
    user.emailVerifyOTPExpiry = null;
    await user.save();

    // Send welcome email (non-blocking)
    try { await sendWelcomeEmail(email, user.name); } catch (_) {}

    const token = signToken(user._id);

    res.json({
      message: 'Email verified successfully!',
      token,
      user: { _id: user._id, name: user.name, username: user.username, email: user.email, avatar: user.avatar },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Verification failed' });
  }
};

// RESEND OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ message: 'Email is already verified' });

    // Check per-user rate limit (max 3 requests per 5 min)
    const rateCheck = await otpService.checkOTPRequestRate(user._id.toString());
    if (!rateCheck.allowed) {
      return res.status(429).json({
        message: `Too many OTP requests. Please wait ${Math.ceil(rateCheck.resetInSeconds / 60)} minute(s) before requesting again.`,
        resetInSeconds: rateCheck.resetInSeconds,
      });
    }

    const otp = otpService.generateOTP();
    const hashedOtp = await otpService.hashOTP(otp);

    // Store in Redis
    const redisStored = await otpService.storeOTP(user._id.toString(), hashedOtp);

    // Fallback: store in Mongo if Redis unavailable
    if (!redisStored) {
      user.emailVerifyOTP = hashedOtp;
      user.emailVerifyOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
      await user.save();
    }

    try {
      await sendVerificationOTP(email, user.name, otp);
    } catch (emailErr) {
      console.error('Failed to resend OTP:', emailErr.message);
      return res.status(500).json({ message: 'Failed to send OTP email. Check server email config.' });
    }

    res.json({
      message: 'OTP resent successfully',
      remainingRequests: rateCheck.remaining,
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ message: 'Failed to resend OTP' });
  }
};

// FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    // Always return success even if email doesn't exist (security best practice)
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Check per-user rate limit
    const rateCheck = await otpService.checkOTPRequestRate(`reset_${user._id.toString()}`);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        message: `Too many reset requests. Please wait ${Math.ceil(rateCheck.resetInSeconds / 60)} minute(s).`,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    try {
      await sendPasswordResetEmail(email, user.name, resetLink);
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr.message);
      return res.status(500).json({ message: 'Failed to send reset email. Check server email config.' });
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to process request' });
  }
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: 'Email, token, and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.passwordResetToken || user.passwordResetToken !== token) {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }
    if (new Date() > user.passwordResetExpiry) {
      return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = null;
    user.passwordResetExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

// GET USERS
const getUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const currentUser = await User.findById(currentUserId).select('connections');
    
    // Fetch pending requests sent by current user
    const sentRequests = await ConnectionRequest.find({
      sender: currentUserId,
      status: 'pending'
    }).select('receiver');
    const sentRequestReceiverIds = sentRequests.map(req => req.receiver.toString());
    const connectionIds = currentUser.connections.map(id => id.toString());

    // Fetch all users
    const users = await User.find({}, '_id email name about avatar lastSeen showOnlineStatus aura username');
    const maskedUsers = users.map(u => {
      const userObj = u.toObject ? u.toObject() : u;
      if (userObj.showOnlineStatus === false) {
        userObj.lastSeen = null;
      }
      delete userObj.showOnlineStatus; // Only send privacy pref to the owner
      
      // Determine connection state
      userObj.isConnected = connectionIds.includes(userObj._id.toString());
      userObj.isPendingRequest = sentRequestReceiverIds.includes(userObj._id.toString());
      
      return userObj;
    });
    res.json(maskedUsers);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// GET USERS STATUS
const getUsersStatus = async (req, res) => {
  try {
    const users = await User.find({}, '_id email name about avatar lastSeen showOnlineStatus');
    const maskedUsers = users.map(u => {
      const userObj = u.toObject ? u.toObject() : u;
      if (userObj.showOnlineStatus === false) {
        userObj.lastSeen = null;
      }
      delete userObj.showOnlineStatus;
      return userObj;
    });
    // Online status determined ONLY from active Socket.IO connections
    res.json(maskedUsers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users status' });
  }
};

// GET PRESENCE
const getPresence = async (req, res) => {
  try {
    // Get all users from DB
    const dbUsers = await User.find({}, '_id lastSeen showOnlineStatus');

    // Get online users from global set (imported from socket.js)
    const { onlineUsers } = require('../sockets/socket');

    // Merge online status
    const presence = dbUsers.map(user => {
      const isShow = user.showOnlineStatus !== false;
      return {
        _id: user._id,
        online: isShow ? onlineUsers.has(user._id.toString()) : false,
        lastSeen: isShow ? user.lastSeen : null
      };
    });

    res.json(presence);
  } catch (err) {
    console.error('Presence error:', err);
    res.status(500).json({ message: 'Failed to fetch presence' });
  }
};

// GET ME
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('name email username about avatar lastSeen connections aura showOnlineStatus');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ message: 'Failed to fetch user data' });
  }
};

// GET USER BY ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name email about avatar lastSeen connections aura username showOnlineStatus');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userObj = user.toObject({ getters: true });
    if (userObj.showOnlineStatus === false) {
      userObj.lastSeen = null;
    }
    delete userObj.showOnlineStatus;
    res.json(userObj);
  } catch (err) {
    console.error('Get user by id error:', err);
    res.status(500).json({ message: 'Failed to fetch user data' });
  }
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
  try {
    const { name, about, avatar, username } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (about !== undefined) updateData.about = about;
    if (avatar !== undefined) updateData.avatar = avatar;

    if (username !== undefined) {
      // Validate format
      const isValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
      if (!isValid) return res.status(400).json({ message: 'Invalid username format (3-20 chars, letters, numbers, underscores)' });

      // Check uniqueness
      const existingUser = await User.findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') },
        _id: { $ne: userId }
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      updateData.username = username;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// UPLOAD AVATAR
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const avatarUrl = req.file.path;
    const updatedUser = await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ message: 'Failed to upload avatar' });
  }
};

// GET ROOM ARCHIVES
const getRoomArchives = async (req, res) => {
  try {
    const RoomArchive = require('../models/RoomArchive');
    const archives = await RoomArchive.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json(archives);
  } catch (err) {
    console.error('Fetch room archives error:', err);
    res.status(500).json({ message: 'Failed to fetch room archives' });
  }
};

// DELETE ACCOUNT (Full Cleanup)
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete account' });
    }

    const User = require('../models/User');
    const bcrypt = require('bcryptjs');

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    const Message = require('../models/Message');
    const ConnectionRequest = require('../models/ConnectionRequest');
    const Notification = require('../models/Notification');
    const Group = require('../models/Group');
    const MicroRoom = require('../models/MicroRoom');
    const RoomArchive = require('../models/RoomArchive');

    // 1. Delete user from User collection
    await User.findByIdAndDelete(userId);

    // 2. Remove user from other users' connections
    await User.updateMany(
      { connections: userId },
      { $pull: { connections: userId } }
    );

    // 3. Delete connection requests involving this user
    await ConnectionRequest.deleteMany({
      $or: [{ sender: userId }, { receiver: userId }]
    });

    // 4. Delete messages sent by user
    await Message.deleteMany({ senderId: userId });

    // 5. Remove user from groups (members and admins) and delete groups they created
    await Group.updateMany(
      { $or: [{ members: userId }, { admins: userId }] },
      { $pull: { members: userId, admins: userId } }
    );
    await Group.deleteMany({ createdBy: userId });

    // 6. Delete notifications involving this user
    await Notification.deleteMany({
      $or: [{ user: userId }, { from: userId }]
    });

    // 7. Remove user from participants and delete MicroRooms they created
    await MicroRoom.updateMany(
      { participants: userId },
      { $pull: { participants: userId } }
    );
    await MicroRoom.deleteMany({ createdBy: userId });

    // 8. Delete room archives created by the user
    await RoomArchive.deleteMany({ createdBy: userId });

    res.status(200).json({ message: 'Account permanently deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ message: 'Failed to delete account' });
  }
};

module.exports = {
  checkUsername,
  signup,
  login,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  getUsers,
  getUsersStatus,
  getPresence,
  getMe,
  getUserById,
  updateProfile,
  uploadAvatar,
  getRoomArchives,
  deleteAccount
};
