const { createClient } = require("redis");
require("dotenv").config();

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

redisClient.on("error", (err) => console.log("❌ Redis Client Error", err));

// Connect immediately
(async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("✅ Redis Client Connected for Caching");

    // --- NEW: Clear DB on startup (Dev only) ---
    // This fixes the "I waited 24h but still blocked" issue
    if (process.env.NODE_ENV === "development") {
      await redisClient.flushAll();
      console.log("🧹 Redis Database Flushed (Clean Start)");
    }
  }
})();

module.exports = redisClient;
