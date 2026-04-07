/**
 * Signup and login routes — passwords hashed with bcrypt; login returns JWT + userId.
 */
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { sendSignupVerificationOtp } = require("../utils/mail");

const router = express.Router();

const SALT_ROUNDS = 10;
const googleClient = new OAuth2Client();

/** Create JWT for a user id (used after login). */
function signToken(userId) {
  return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

/** Simple email format check. */
function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str).trim());
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function buildBaseUsername(profile) {
  const emailName = String(profile.email || "").split("@")[0];
  const nameValue = String(profile.name || "");
  const candidate = emailName || nameValue || "user";
  const cleaned = candidate
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);

  if (cleaned.length >= 3) return cleaned;
  return (cleaned + "user").slice(0, 12);
}

async function generateUniqueUsername(profile) {
  const base = buildBaseUsername(profile);
  let username = base;
  let counter = 0;

  while (await User.exists({ username })) {
    counter += 1;
    username = (base + counter).slice(0, 24);
  }

  return username;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.get("/auth/google/config", (req, res) => {
  return res.json({
    success: true,
    clientId: process.env.GOOGLE_CLIENT_ID || "",
  });
});

// POST /signup — create account in pending state and verify email with OTP
router.post("/signup", async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required.",
      });
    }

    const normalizedUser = normalizeUsername(username);
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const existingUser = await User.findOne({ username: normalizedUser });
    const existingEmail = await User.findOne({ email: normalizedEmail });

    if (existingUser && existingUser.isEmailVerified) {
      return res.status(409).json({
        success: false,
        message: "That username is already taken. Try another.",
      });
    }

    if (
      existingEmail &&
      existingEmail.isEmailVerified &&
      existingEmail.username !== normalizedUser
    ) {
      return res.status(409).json({
        success: false,
        message: "That email is already registered.",
      });
    }

    let user = existingUser || existingEmail;

    if (user && user.googleId && user.isEmailVerified) {
      return res.status(409).json({
        success: false,
        message: "That email is already registered with Google login.",
      });
    }

    if (user) {
      user.username = normalizedUser;
      user.email = normalizedEmail;
      user.password = hashed;
      user.isEmailVerified = false;
      user.emailVerificationOTP = otp;
      user.emailVerificationExpiry = otpExpiry;
      await user.save();
    } else {
      user = await User.create({
        username: normalizedUser,
        email: normalizedEmail,
        password: hashed,
        isEmailVerified: false,
        emailVerificationOTP: otp,
        emailVerificationExpiry: otpExpiry,
      });
    }

    await sendSignupVerificationOtp(normalizedEmail, otp);

    return res.status(201).json({
      success: true,
      message: "We sent a verification code to your email.",
      requiresVerification: true,
      username: user.username,
      email: user.email,
    });
  } catch (err) {
    console.error("Signup error:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "That username or email is already registered.",
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message || "Could not create account. Please try again.",
    });
  }
});

// POST /verify-signup
router.post("/verify-signup", async (req, res) => {
  try {
    const { username, otp } = req.body;

    if (!username || !otp) {
      return res.status(400).json({
        success: false,
        message: "Username and verification code are required.",
      });
    }

    const user = await User.findOne({ username: normalizeUsername(username) });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification request.",
      });
    }

    const code = String(otp).trim();
    const now = new Date();

    if (
      !user.emailVerificationOTP ||
      !user.emailVerificationExpiry ||
      user.emailVerificationOTP !== code ||
      now > user.emailVerificationExpiry
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code.",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationExpiry = undefined;
    await user.save();

    const token = signToken(user._id);

    return res.json({
      success: true,
      message: "Account verified successfully.",
      userId: user._id.toString(),
      username: user.username,
      token,
    });
  } catch (err) {
    console.error("Verify signup error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Verification failed. Please try again.",
    });
  }
});

// POST /login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    const user = await User.findOne({
      username: normalizeUsername(username),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "This account uses Google sign-in. Continue with Google instead.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    const token = signToken(user._id);

    return res.json({
      success: true,
      message: "Logged in successfully.",
      userId: user._id.toString(),
      username: user.username,
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Login failed. Please try again.",
    });
  }
});

// POST /auth/google
router.post("/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;
    const audience = process.env.GOOGLE_CLIENT_ID;

    if (!audience) {
      return res.status(500).json({
        success: false,
        message: "Google login is not configured on the server.",
      });
    }

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Missing Google credential.",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: audience,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Google login could not be verified.",
      });
    }

    const googleId = String(payload.sub);
    const email = String(payload.email).trim().toLowerCase();
    const emailVerified = !!payload.email_verified;

    if (!emailVerified) {
      return res.status(401).json({
        success: false,
        message: "Your Google account email is not verified.",
      });
    }

    let user = await User.findOne({
      $or: [{ googleId: googleId }, { email: email }],
    });

    if (!user) {
      user = await User.create({
        username: await generateUniqueUsername(payload),
        email: email,
        googleId: googleId,
        isEmailVerified: true,
      });
    } else {
      let changed = false;
      if (!user.googleId) {
        user.googleId = googleId;
        changed = true;
      }
      if (!user.email) {
        user.email = email;
        changed = true;
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        changed = true;
      }
      if (changed) {
        await user.save();
      }
    }

    const token = signToken(user._id);

    return res.json({
      success: true,
      message: "Logged in with Google successfully.",
      userId: user._id.toString(),
      username: user.username,
      token,
    });
  } catch (err) {
    console.error("Google login error:", err);
    return res.status(401).json({
      success: false,
      message: "Google login failed. Please try again.",
    });
  }
});

module.exports = router;
