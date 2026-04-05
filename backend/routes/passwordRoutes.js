/**
 * Forgot / reset password using email OTP (6 digits, 10 minute expiry).
 * OTP is never returned in JSON responses.
 */
const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const { sendPasswordResetOtp } = require("../utils/mail");

const router = express.Router();
const SALT_ROUNDS = 10;

/** Same user-facing message whether the account exists or not (limits account enumeration). */
const FORGOT_SUCCESS_MSG =
  "If an account exists with that information, we sent a one-time code to the email on file.";

/** Basic email format check */
function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str).trim());
}

/** Normalize username (lowercase trim) */
function normalizeUsername(str) {
  return String(str || "").trim().toLowerCase();
}

/** Find user by username OR email */
async function findUserByUsernameOrEmail(usernameOrEmail) {
  const raw = String(usernameOrEmail || "").trim();
  if (!raw) return null;

  if (isValidEmail(raw)) {
    return User.findOne({ email: raw.toLowerCase() });
  }
  return User.findOne({ username: normalizeUsername(raw) });
}

/** Generate a 6-digit OTP string */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /forgot-password — body: { usernameOrEmail }
router.post("/forgot-password", async (req, res) => {
  try {
    const { usernameOrEmail } = req.body;

    if (
      usernameOrEmail === undefined ||
      usernameOrEmail === null ||
      String(usernameOrEmail).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter your username or email.",
      });
    }

    const user = await findUserByUsernameOrEmail(usernameOrEmail);

    // Same JSON for security, but log so you can see in the terminal why no mail went out
    if (!user || !user.email) {
      console.log(
        "[forgot-password] No user found or account has no email in DB — no email sent (response is still generic)."
      );
      return res.json({
        success: true,
        message: FORGOT_SUCCESS_MSG,
      });
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.resetOTP = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    try {
      await sendPasswordResetOtp(user.email, otp);
    } catch (mailErr) {
      console.error("Send OTP email failed:", mailErr.message);
      if (mailErr.response) {
        console.error("SMTP response:", mailErr.response);
      }
      if (mailErr.code) {
        console.error("Error code:", mailErr.code);
      }
      await User.updateOne(
        { _id: user._id },
        { $unset: { resetOTP: "", otpExpiry: "" } }
      );
      return res.status(503).json({
        success: false,
        message:
          "Could not send email right now. Check server email settings or try again later.",
      });
    }

    // Do not include OTP in the response
    return res.json({
      success: true,
      message: FORGOT_SUCCESS_MSG,
    });
  } catch (err) {
    console.error("forgot-password error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Something went wrong. Please try again.",
    });
  }
});

// POST /reset-password — body: { usernameOrEmail, otp, newPassword }
router.post("/reset-password", async (req, res) => {
  try {
    const { usernameOrEmail, otp, newPassword } = req.body;

    if (!usernameOrEmail || String(usernameOrEmail).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Username or email is required.",
      });
    }
    if (!otp || String(otp).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "OTP is required.",
      });
    }
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    const user = await findUserByUsernameOrEmail(usernameOrEmail);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired code. Please request a new one.",
      });
    }

    const code = String(otp).trim();
    const now = new Date();

    if (
      !user.resetOTP ||
      !user.otpExpiry ||
      user.resetOTP !== code ||
      now > user.otpExpiry
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired code. Please request a new one.",
      });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await User.updateOne(
      { _id: user._id },
      { $set: { password: hashed }, $unset: { resetOTP: "", otpExpiry: "" } }
    );

    return res.json({
      success: true,
      message: "Password updated. You can log in with your new password.",
    });
  } catch (err) {
    console.error("reset-password error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Something went wrong. Please try again.",
    });
  }
});

module.exports = router;
