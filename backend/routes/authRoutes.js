const express = require('express');
const router = express.Router();

const { upload } = require('../config/cloudinaryConfig');
const controllers = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { otpRequestLimiter, otpVerifyLimiter, authLimiter } = require('../middleware/rateLimitMiddleware');
const { validateEmail, validateOTP, validateNewPassword } = require('../middleware/validateMiddleware');

// Auth routes — with rate limiting and input validation
router.post('/signup', authLimiter, upload.single('profileImage'), controllers.signup);
router.post('/login', authLimiter, controllers.login);
router.post('/verify-otp', otpVerifyLimiter, validateEmail, validateOTP, controllers.verifyOTP);
router.post('/resend-otp', otpRequestLimiter, validateEmail, controllers.resendOTP);
router.post('/forgot-password', otpRequestLimiter, validateEmail, controllers.forgotPassword);
router.post('/reset-password', validateEmail, validateNewPassword, controllers.resetPassword);
router.get('/check-username', controllers.checkUsername);

// Diagnostic: check which env vars are set (no values exposed)
router.get('/env-check', (req, res) => {
  res.json({
    GMAIL_USER: process.env.GMAIL_USER ? `✅ SET (${process.env.GMAIL_USER})` : '❌ NOT SET',
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? `✅ SET (length: ${process.env.GMAIL_APP_PASSWORD.length})` : '❌ NOT SET',
    REDIS_URL: process.env.REDIS_URL ? '✅ SET' : '❌ NOT SET',
    MONGO_URI: process.env.MONGO_URI ? '✅ SET' : '❌ NOT SET',
    JWT_SECRET: process.env.JWT_SECRET ? '✅ SET' : '❌ NOT SET',
    FRONTEND_URL: process.env.FRONTEND_URL || '❌ NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  });
});

// Diagnostic: live SMTP send test (call this on Render to confirm email works)
router.get('/test-email', async (req, res) => {
  const nodemailer = require('nodemailer');
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      connectionTimeout: 10000,
      socketTimeout: 20000,
      greetingTimeout: 10000,
    });
    await transporter.verify();
    await transporter.sendMail({
      from: `"Connectify Test" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: '✅ Render SMTP Test',
      text: `SMTP working from Render at ${new Date().toISOString()}`,
    });
    res.json({ success: true, message: `Test email sent to ${process.env.GMAIL_USER}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, code: err.code });
  }
});

router.get('/users', authMiddleware, controllers.getUsers);
router.get('/presence', controllers.getPresence);
router.get('/users/status', controllers.getUsersStatus);
router.get('/users/me', authMiddleware, controllers.getMe);

// TEMPORARY GLOBAL DB SEED ROUTE
router.get('/seed-global', async (req, res) => {
  const User = require('../models/User');
  const bcrypt = require('bcryptjs');
  
  const profiles = [
    { name: "Priya Sharma", username: "priya_s", about: "Coffee lover and travel enthusiast ☕✈️", imgNum: 44, auraColor: "#FF6B6B" },
    { name: "Ananya Patel", username: "ananya_p", about: "Digital creator and foodie 🍕📱", imgNum: 45, auraColor: "#4ECDC4" },
    { name: "Riya Singh", username: "riya_vibes", about: "Music is my escape 🎧", imgNum: 46, auraColor: "#FFD166" },
    { name: "Kavya Gupta", username: "kavya_g", about: "Software Engineer & Reader 📚💻", imgNum: 47, auraColor: "#6B5B95" },
    { name: "Neha Reddy", username: "neha.r", about: "Living life one adventure at a time 🌍", imgNum: 48, auraColor: "#FF9F1C" },
    { name: "Diya Desai", username: "diya_d", about: "Art, Yoga, and Peace 🧘‍♀️🎨", imgNum: 49, auraColor: "#2AB7CA" },
    { name: "Aditi Joshi", username: "aditi.j", about: "Aspiring photographer 📸", imgNum: 50, auraColor: "#F37736" },
    { name: "Sneha Kumar", username: "sneha_k", about: "Dog mom & nature lover 🐕🌲", imgNum: 51, auraColor: "#85E21F" },
    { name: "Meera Nair", username: "meera_n", about: "Fashion & Lifestyle ✨", imgNum: 52, auraColor: "#FE4A90" },
    { name: "Pooja Verma", username: "pooja_v", about: "Always looking for the next sunset 🌅", imgNum: 53, auraColor: "#9D4EDD" }
  ];

  try {
    const passwordHash = await bcrypt.hash('password123', 10);
    let count = 0;
    
    for (const profile of profiles) {
      const email = `${profile.username}@example.com`;
      const existing = await User.findOne({ email });
      if (existing) continue;

      await User.create({
        name: profile.name,
        username: profile.username,
        email: email,
        passwordHash: passwordHash,
        about: profile.about,
        avatar: `https://randomuser.me/api/portraits/women/${profile.imgNum}.jpg`,
        aura: {
          type: "focus",
          label: "Chill",
          color: profile.auraColor,
          icon: "✨",
        }
      });
      count++;
    }
    
    res.json({ message: `Successfully seeded global database with ${count} new generic profiles!` });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// TEMPORARY MEDIA CLEANUP ROUTE
router.get('/clean-legacy-media', async (req, res) => {
  const User = require('../models/User');
  const Message = require('../models/Message');

  try {
    // 1. Reset broken user avatars
    const userResult = await User.updateMany(
      { avatar: { $regex: /uploads\//i } },
      { $set: { avatar: null } }
    );

    // 2. Convert broken media messages to text
    const messageResult = await Message.updateMany(
      { 
        type: { $in: ['image', 'video', 'file', 'audio'] }, 
        fileUrl: { $regex: /uploads\//i } 
      },
      { 
        $set: { 
          type: 'text', 
          text: '📸 Media expired (legacy upload)', 
          fileUrl: null 
        } 
      }
    );

    res.json({ 
      success: true, 
      message: 'Legacy media cleaned successfully', 
      avatarsReset: userResult.modifiedCount,
      messagesFixed: messageResult.modifiedCount 
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/users/room-archives', authMiddleware, controllers.getRoomArchives);
router.put('/users/profile', authMiddleware, controllers.updateProfile);
router.post('/users/avatar', authMiddleware, upload.single('avatar'), controllers.uploadAvatar);
router.delete('/users/delete-account', authMiddleware, controllers.deleteAccount);

module.exports = router;
