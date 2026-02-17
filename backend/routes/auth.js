const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authLimiter } = require("../lib/rateLimiter");

// Destructure cleanly
const { register, login } = authController;

// Middleware Wrapper for HTTP
const rateLimitMiddleware = (limiter) => async (req, res, next) => {
  try {
    if (limiter) {
      await limiter.consume(req.ip);
    }
    next();
  } catch (rejRes) {
    res.status(429).json({ message: "Too many attempts. Try again later." });
  }
};

// Debug Check
if (!register || !login) {
  console.error("❌ CRITICAL ERROR: Auth Controller functions are missing!");
}

// --- BYPASS RATE LIMITER FOR DEV ---
// passing 'null' or removing the middleware wrapper effectively disables it
router.post("/register", register); // <--- REMOVED rateLimitMiddleware
router.post("/login", login); // <--- REMOVED rateLimitMiddleware

module.exports = router;
