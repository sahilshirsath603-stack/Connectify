const nodemailer = require('nodemailer');

// ─── Transporter ────────────────────────────────────────────────────────────
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 10000,  // 10s to establish TCP connection
    socketTimeout: 20000,      // 20s for each socket operation
    greetingTimeout: 10000,    // 10s for server greeting
  });
};

// ─── Shared Email Styles ─────────────────────────────────────────────────────
const emailWrapper = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Connectify</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f0f1a; font-family: 'Inter', Arial, sans-serif; }
    .container { max-width: 480px; margin: 40px auto; background: #1a1a2e; border-radius: 16px; overflow: hidden; border: 1px solid rgba(124,92,255,0.2); }
    .header { background: linear-gradient(135deg, #7C5CFF, #a855f7); padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 28px; font-weight: 700; letter-spacing: 1px; }
    .header p  { color: rgba(255,255,255,0.8); margin-top: 6px; font-size: 14px; }
    .body { padding: 36px 40px; color: #ccc; font-size: 15px; line-height: 1.6; }
    .body h2 { color: #fff; font-size: 20px; margin-bottom: 12px; }
    .otp-box { display: flex; justify-content: center; gap: 10px; margin: 28px 0; }
    .otp-digit { background: rgba(124,92,255,0.15); border: 2px solid rgba(124,92,255,0.4); border-radius: 10px; width: 52px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #a78bfa; letter-spacing: 2px; text-align: center; }
    .otp-single { background: rgba(124,92,255,0.1); border: 2px solid rgba(124,92,255,0.5); border-radius: 12px; padding: 16px 32px; font-size: 36px; font-weight: 700; color: #a78bfa; letter-spacing: 8px; text-align: center; margin: 24px auto; display: block; width: fit-content; }
    .btn { display: block; width: 100%; text-align: center; background: linear-gradient(135deg, #7C5CFF, #a855f7); color: #fff; text-decoration: none; padding: 14px 0; border-radius: 10px; font-size: 16px; font-weight: 600; margin: 24px 0; }
    .note { background: rgba(255,255,255,0.04); border-left: 3px solid #7C5CFF; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #aaa; margin-top: 16px; }
    .footer { background: #111120; padding: 20px 40px; text-align: center; font-size: 12px; color: #555; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✦ Connectify</h1>
      <p>Connect with people who match your vibe</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Connectify. This email was sent to you because you have an account with us.<br/>
      If you didn't request this, please ignore this email.
    </div>
  </div>
</body>
</html>
`;

// ─── Send Verification OTP ───────────────────────────────────────────────────
const sendVerificationOTP = async (email, name, otp) => {
  const transporter = createTransporter();

  const digits = otp.toString().split('');
  const digitBoxes = digits.map(d => `<div class="otp-digit">${d}</div>`).join('');

  const html = emailWrapper(`
    <h2>👋 Welcome, ${name}!</h2>
    <p>You're almost there. Use the OTP below to verify your email address and activate your Connectify account.</p>
    <div class="otp-box">${digitBoxes}</div>
    <div class="note">
      ⏰ This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.
    </div>
  `);

  await transporter.sendMail({
    from: `"Connectify" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `${otp} is your Connectify verification code`,
    html,
    text: `Your Connectify verification OTP is: ${otp}. It expires in 10 minutes.`,
  });

  console.log(`✅ Verification OTP sent to ${email}`);
};

// ─── Send Password Reset Email ───────────────────────────────────────────────
const sendPasswordResetEmail = async (email, name, resetLink) => {
  const transporter = createTransporter();

  const html = emailWrapper(`
    <h2>🔐 Reset your password</h2>
    <p>Hi <strong>${name}</strong>, we received a request to reset your Connectify password.</p>
    <p style="margin-top: 16px;">Click the button below to choose a new password:</p>
    <a href="${resetLink}" class="btn">Reset My Password</a>
    <p style="font-size: 13px; color: #888;">Or paste this link in your browser:</p>
    <p style="font-size: 12px; color: #7C5CFF; word-break: break-all; margin-top: 6px;">${resetLink}</p>
    <div class="note">
      ⏰ This link expires in <strong>30 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.
    </div>
  `);

  await transporter.sendMail({
    from: `"Connectify" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Reset your Connectify password',
    html,
    text: `Reset your Connectify password using this link: ${resetLink}. It expires in 30 minutes.`,
  });

  console.log(`✅ Password reset email sent to ${email}`);
};

// ─── Send Welcome Email ──────────────────────────────────────────────────────
const sendWelcomeEmail = async (email, name) => {
  const transporter = createTransporter();

  const html = emailWrapper(`
    <h2>🎉 You're in, ${name}!</h2>
    <p>Your Connectify account is now verified and ready to use. Start connecting with people who match your vibe.</p>
    <p style="margin-top: 20px; color: #aaa;">Here's what you can do:</p>
    <ul style="margin-top: 12px; padding-left: 20px; color: #bbb; line-height: 2;">
      <li>Find and connect with new people</li>
      <li>Start conversations and share moments</li>
      <li>Set your Aura to express your current vibe</li>
    </ul>
  `);

  await transporter.sendMail({
    from: `"Connectify" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '✦ Welcome to Connectify!',
    html,
    text: `Welcome to Connectify, ${name}! Your account is now verified.`,
  });
};

module.exports = { sendVerificationOTP, sendPasswordResetEmail, sendWelcomeEmail };
