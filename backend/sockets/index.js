const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const redisClient = require("../lib/redis");
const { messageQueue } = require("../lib/queue");
const { socketLimiter } = require("../lib/rateLimiter");

module.exports = async (httpServer) => {
  const pubClient = createClient({ url: "redis://127.0.0.1:6379" });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);

  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
    },
    adapter: createAdapter(pubClient, subClient),
  });

  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    console.log(`✅ User Connected: ${socket.id}`);

    socket.on("user_connected", (userId) => {
      onlineUsers.set(userId, socket.id);
      socket.data.userId = userId;
      io.emit("update_online_users", Array.from(onlineUsers.keys()));
    });

    socket.on("join_channel", (channelId) => {
      socket.join(channelId);
    });

    // --- NEW: Handle Read Receipts (Write-Behind) ---
    socket.on("mark_read", async ({ channelId, messageId, userId }) => {
      // 1. Validation
      if (!channelId || !messageId || !userId) return;

      // 2. Buffer Update in Redis (Fast)
      // Key format: receipt:channel:{cid}:user:{uid}
      const key = `receipt:channel:${channelId}:user:${userId}`;

      // Only update if the new ID is greater than what's stored (Cursors only move forward)
      const currentRead = await redisClient.get(key);
      if (!currentRead || parseInt(messageId) > parseInt(currentRead)) {
        await redisClient.set(key, messageId);

        // 3. Broadcast to everyone in the channel immediately
        // "User X has read up to message Y"
        io.to(channelId).emit("user_read_update", {
          userId,
          channelId,
          lastReadMessageId: messageId,
        });
      }
    });

    socket.on("typing", (data) => {
      socket.to(data.channelId).emit("user_typing", data.username);
    });

    socket.on("stop_typing", (data) => {
      socket.to(data.channelId).emit("user_stop_typing", data.username);
    });

    socket.on("message_reaction", (data) => {
      io.to(data.channelId).emit("message_reaction_update", {
        messageId: data.messageId,
        userId: data.userId,
        emoji: data.emoji,
      });
    });

    socket.on("send_message", async (data) => {
      try {
        const limiterKey = data.senderId || socket.id;
        try {
          await socketLimiter.consume(limiterKey);
        } catch (limiterError) {
          if (limiterError instanceof Error) {
            console.error(
              "⚠️ Rate Limiter Error (Allowing Message):",
              limiterError.message,
            );
          } else {
            throw limiterError;
          }
        }

        console.log(
          `📥 Received Msg for ${data.channelId}, adding to Queue...`,
        );

        await messageQueue.add("process_message", {
          content: data.content,
          senderId: data.senderId,
          channelId: data.channelId,
          attachmentUrl: data.attachmentUrl,
          tempId: data.tempId,
        });

        socket.emit("message_queued", { status: "queued" });
      } catch (rejRes) {
        const timeToWait = Math.round(rejRes.msBeforeNext / 1000) || 1;
        console.warn(`🚫 User ${data.senderId} blocked.`);
        socket.emit("message_error", {
          error: `Sending too fast! Wait ${timeToWait} seconds.`,
        });
      }
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }
      io.emit("update_online_users", Array.from(onlineUsers.keys()));
    });
  });

  return io;
};
