const { ConversationParticipant } = require("../db/models");
const redisClient = require("../lib/redis");

// How often to sync to DB (ms)
const FLUSH_INTERVAL = 10000;

const initReceiptWorker = () => {
  console.log("👀 Receipt Worker Started (Write-Behind Strategy)");

  setInterval(async () => {
    try {
      // 1. Get all "dirty" keys (users who have updated their read status)
      // We store keys as: "receipt:channel:{channelId}:user:{userId}"
      const keys = await redisClient.keys("receipt:channel:*:user:*");

      if (keys.length === 0) return;

      const updates = [];

      // 2. Gather values from Redis
      for (const key of keys) {
        const lastReadMessageId = await redisClient.get(key);
        if (!lastReadMessageId) continue;

        // Parse key: "receipt:channel:1:user:5"
        const parts = key.split(":");
        const channelId = parts[2];
        const userId = parts[4];

        updates.push({
          userId,
          conversationId: channelId,
          lastReadMessageId,
          key, // Keep key to delete later
        });
      }

      if (updates.length === 0) return;

      console.log(`💾 Flushing ${updates.length} read receipts to DB...`);

      // 3. Batch Upsert to Database
      // We loop because Sequelize bulkCreate with updateOnDuplicate is tricky across dialects
      // For safety and simplicity in this setup, we iterate.
      // In high-scale prod, you'd use a raw SQL "INSERT ... ON CONFLICT" query.
      for (const update of updates) {
        await ConversationParticipant.upsert({
          userId: update.userId,
          conversationId: update.conversationId,
          lastReadMessageId: update.lastReadMessageId,
        });

        // 4. Remove from Redis (Clean the buffer)
        // Only delete if DB write succeeded
        await redisClient.del(update.key);
      }
    } catch (error) {
      console.error("❌ Receipt Flush Error:", error);
    }
  }, FLUSH_INTERVAL);
};

module.exports = initReceiptWorker;
