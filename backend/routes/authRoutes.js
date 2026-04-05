/**
 * Signup and login routes — passwords hashed with bcrypt; login returns JWT + userId.
 */
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

const SALT_ROUNDS = 10;

/** Create JWT for a user id (used after login). */
function signToken(userId) {
  return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

/** Simple email format check (same idea as password routes). */
function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str).trim());
}

// POST /signup — email is required so password reset can send OTP
router.post("/signup", async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required.",
      });
    }

    const normalizedUser = username.trim().toLowerCase();
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const existingUser = await User.findOne({ username: normalizedUser });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "That username is already taken. Try another.",
      });
    }

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "That email is already registered.",
      });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      username: normalizedUser,
      email: normalizedEmail,
      password: hashed,
    });

    const token = signToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      userId: user._id.toString(),
      username: user.username,
      token,
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
      username: username.trim().toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
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

module.exports = router;
