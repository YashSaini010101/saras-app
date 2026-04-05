/**
 * Saras Calculator — Express API + MongoDB
 * Serves the static frontend from the parent folder so one process works for local dev and deployment.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");
const passwordRoutes = require("./routes/passwordRoutes");
const billRoutes = require("./routes/billRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// --- CORS: allow frontend (same origin when using this server, or configured CLIENT_URL) ---
const clientUrl = process.env.CLIENT_URL;
app.use(
  cors({
    origin: clientUrl || true,
    credentials: true,
  })
);

app.use(express.json());

// --- API routes (exact paths as required) ---
app.use(authRoutes);
app.use(passwordRoutes);
app.use(billRoutes);

// --- Global error handler for unexpected errors ---
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Something went wrong on the server.",
  });
});

// --- Serve static frontend (HTML, images) from project root ---
const publicDir = path.join(__dirname, "..");
app.use(express.static(publicDir));

// --- MongoDB connection ---
async function start() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI in .env — create backend/.env from .env.example");
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error("Missing JWT_SECRET in .env — set a long random string for production.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open the app at http://localhost:${PORT}/index.html`);
    console.log(
      `API routes include: POST /signup, POST /login, POST /forgot-password, POST /reset-password, …`
    );
  });
}

start();
