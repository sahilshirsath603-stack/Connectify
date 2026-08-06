// Quick email test script — run with: node test_email.js <recipient_email>
require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

async function testEmail() {
  const host = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
  const port = parseInt(process.env.BREVO_SMTP_PORT, 10) || 587;
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS;
  const fromEmail = process.env.EMAIL_FROM;

  console.log('\n📧 Brevo SMTP Diagnostics:');
  console.log('BREVO_SMTP_HOST:', host);
  console.log('BREVO_SMTP_PORT:', port);
  console.log('BREVO_SMTP_USER:', user ? `SET (${user})` : '❌ NOT SET');
  console.log('BREVO_SMTP_PASS:', pass ? '✅ SET' : '❌ NOT SET');
  console.log('EMAIL_FROM:', fromEmail ? `✅ SET (${fromEmail})` : '❌ NOT SET');

  const toEmail = process.argv[2];
  if (!toEmail) {
    console.error('\n⚠️ Please provide recipient email address as an argument:');
    console.error('   node test_email.js recipient@example.com\n');
    process.exit(1);
  }

  if (!user || !pass) {
    console.error('\n❌ BREVO_SMTP_USER and BREVO_SMTP_PASS environment variables must be configured.');
    process.exit(1);
  }

  if (!fromEmail) {
    console.error('\n❌ EMAIL_FROM environment variable must be configured.');
    process.exit(1);
  }

  console.log(`\n⏳ Sending test email to ${toEmail} via Brevo SMTP...`);
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from: `Connectify Test <${fromEmail}>`,
      to: toEmail,
      subject: '✅ Connectify Email Test — Brevo SMTP Working!',
      html: `<div style="font-family:Arial;padding:20px;background:#1a1a2e;color:#fff;border-radius:10px;">
        <h2 style="color:#a78bfa;">✦ Connectify Email Test</h2>
        <p>If you see this — your Brevo SMTP configuration is working correctly! 🎉</p>
        <p style="color:#888;font-size:12px;">Sent at: ${new Date().toISOString()}</p>
      </div>`,
      text: 'Connectify email test successful via Brevo SMTP!',
    });

    console.log('\n✅ Email sent successfully via Brevo SMTP!');
    console.log('Message ID:', info.messageId);
  } catch (err) {
    console.error('\n❌ Failed to send email via Brevo SMTP!');
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testEmail();
