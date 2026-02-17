const { RateLimiterRedis } = require("rate-limiter-flexible");
const { createClient } = require("redis");
require("dotenv").config();

// Create a dedicated Redis client for Rate Limiting
const rateLimiterClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  enableOfflineQueue: false, // Recommended for Rate Limiters
});

rateLimiterClient.on("error", (err) =>
  console.error("❌ RateLimit Redis Error", err),
);

// Connect immediately
(async () => {
  try {
    await rateLimiterClient.connect();
    console.log("✅ Rate Limiter Redis Connected");
  } catch (err) {
    console.error("❌ Failed to connect Rate Limiter Redis", err);
  }
})();

// 1. Auth Limiter (Strict)
const authLimiter = new RateLimiterRedis({
  storeClient: rateLimiterClient,
  keyPrefix: "middleware:auth",
  points: 10,
  duration: 15 * 60,
});

// 2. Upload Limiter (Moderate)
const uploadLimiter = new RateLimiterRedis({
  storeClient: rateLimiterClient,
  keyPrefix: "middleware:upload",
  points: 10,
  duration: 60,
});

// 3. Socket Message Limiter (Relaxed for Dev)
const socketLimiter = new RateLimiterRedis({
  storeClient: rateLimiterClient,
  keyPrefix: "middleware:socket",
  points: 20,
  duration: 60,
});

module.exports = { authLimiter, uploadLimiter, socketLimiter };
