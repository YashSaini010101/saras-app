/**
 * Gmail SMTP via nodemailer — uses EMAIL_USER and EMAIL_PASS from .env.
 *
 * Gmail does NOT accept your normal password for SMTP. You must:
 * 1. Enable 2-Step Verification on the Google account
 * 2. Create an "App password" (Google Account → Security → App passwords)
 * 3. Paste the 16-character app password into EMAIL_PASS (spaces optional — we strip them)
 *
 * If email still fails, read the full error in the terminal where `npm start` runs.
 */
const nodemailer = require("nodemailer");

/** Trim user; app passwords are often shown as "xxxx xxxx ..." — Gmail expects 16 chars, no spaces */
function normalizeAuth() {
  const user = (process.env.EMAIL_USER || "").trim();
  let pass = process.env.EMAIL_PASS || "";
  pass = pass.replace(/\s/g, "");
  return { user, pass };
}

/** Build transporter; returns null if email env vars are missing */
function getTransporter() {
  const { user, pass } = normalizeAuth();
  if (!user || !pass) {
    return null;
  }

  // Explicit SMTP often works more reliably than service: "gmail" alone on some networks
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    tls: {
      // Use Gmail's certificate (default); set to false only if you know you need it
      rejectUnauthorized: true,
    },
  });
}

/**
 * Send HTML email with the reset OTP visible.
 * @returns {Promise<void>}
 */
async function sendPasswordResetOtp(toEmail, otp) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error("Email is not configured on the server (EMAIL_USER / EMAIL_PASS).");
  }

  const { user: fromAddr } = normalizeAuth();
  const subject = "Your Saras Calculator password reset code";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h1 style="color: #6200ea; font-size: 20px; margin: 0 0 16px;">Password reset</h1>
    <p style="color: #333; line-height: 1.5;">Use this one-time code to reset your password. It expires in <strong>10 minutes</strong>.</p>
    <div style="text-align: center; margin: 28px 0;">
      <span style="display: inline-block; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #6200ea; background: #ede7f6; padding: 16px 24px; border-radius: 8px;">${otp}</span>
    </div>
    <p style="color: #666; font-size: 14px;">If you did not request this, you can ignore this email.</p>
  </div>
</body>
</html>`;

  const info = await transporter.sendMail({
    from: `"Saras Calculator" <${fromAddr}>`,
    to: toEmail,
    subject,
    html,
    text: `Your password reset code is: ${otp}. It expires in 10 minutes.`,
  });

  // Helpful when debugging "I didn't get the email"
  console.log(
    "[mail] Password reset message sent. messageId=%s to=%s",
    info.messageId,
    toEmail
  );
}

async function sendSignupVerificationOtp(toEmail, otp) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error("Email is not configured on the server (EMAIL_USER / EMAIL_PASS).");
  }

  const { user: fromAddr } = normalizeAuth();
  const subject = "Verify your Saras Calculator account";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h1 style="color: #6200ea; font-size: 20px; margin: 0 0 16px;">Verify your email</h1>
    <p style="color: #333; line-height: 1.5;">Use this one-time code to finish creating your account. It expires in <strong>10 minutes</strong>.</p>
    <div style="text-align: center; margin: 28px 0;">
      <span style="display: inline-block; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #6200ea; background: #ede7f6; padding: 16px 24px; border-radius: 8px;">${otp}</span>
    </div>
    <p style="color: #666; font-size: 14px;">If you did not try to sign up, you can ignore this email.</p>
  </div>
</body>
</html>`;

  const info = await transporter.sendMail({
    from: `"Saras Calculator" <${fromAddr}>`,
    to: toEmail,
    subject,
    html,
    text: `Your Saras Calculator verification code is: ${otp}. It expires in 10 minutes.`,
  });

  console.log(
    "[mail] Signup verification message sent. messageId=%s to=%s",
    info.messageId,
    toEmail
  );
}

module.exports = {
  getTransporter,
  sendPasswordResetOtp,
  sendSignupVerificationOtp,
  normalizeAuth,
};
