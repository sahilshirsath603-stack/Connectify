// Quick email test script — run with: node test_email.js
require('dotenv').config({ path: '.env.local' });

const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('\n📧 Testing Gmail SMTP...');
  console.log('GMAIL_USER:', process.env.GMAIL_USER);
  console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? `"${process.env.GMAIL_APP_PASSWORD}" (length: ${process.env.GMAIL_APP_PASSWORD.length})` : '❌ NOT SET');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('\n❌ Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env.local');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  // Step 1: Verify connection
  console.log('\n⏳ Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection OK!');
  } catch (err) {
    console.error('\n❌ SMTP connection FAILED!');
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);

    if (err.code === 'EAUTH') {
      console.error('\n🔑 FIX: Your App Password is wrong or 2FA is not enabled.');
      console.error('   1. Go to: myaccount.google.com/security');
      console.error('   2. Enable 2-Step Verification (if not already)');
      console.error('   3. Go to: myaccount.google.com/apppasswords');
      console.error('   4. Create a new App Password for "Mail"');
      console.error('   5. Paste the 16-char password (with spaces) into GMAIL_APP_PASSWORD');
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error('\n🌐 FIX: Network issue. Check your internet connection.');
    }
    process.exit(1);
  }

  // Step 2: Send test email
  console.log('\n⏳ Sending test email to', process.env.GMAIL_USER, '...');
  try {
    const info = await transporter.sendMail({
      from: `"Connectify Test" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: '✅ Connectify Email Test — OTP System Working!',
      html: `<div style="font-family:Arial;padding:20px;background:#1a1a2e;color:#fff;border-radius:10px;">
        <h2 style="color:#a78bfa;">✦ Connectify Email Test</h2>
        <p>If you see this — your email system is working correctly! 🎉</p>
        <p style="color:#888;font-size:12px;">Sent at: ${new Date().toISOString()}</p>
      </div>`,
      text: 'Connectify email test successful!',
    });
    console.log('\n✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('\n👉 Check your inbox (and Spam folder) for the test email.');
  } catch (err) {
    console.error('\n❌ Failed to send email!');
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testEmail();
