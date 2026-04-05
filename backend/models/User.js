/**
 * User model — username, email (for password reset), bcrypt password,
 * and optional OTP fields for forgot-password flow.
 */
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Stored lowercase so sign-in is case-insensitive and usernames stay unique
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
    },
    // Used for OTP delivery; unique when set (existing accounts may omit until they add one)
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    resetOTP: { type: String, default: undefined },
    otpExpiry: { type: Date, default: undefined },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
