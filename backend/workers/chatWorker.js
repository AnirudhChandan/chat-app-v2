const { Worker } = require("bullmq");
const { connection } = require("../lib/queue");
const { Message, User } = require("../db/models");
const redisClient = require("../lib/redis");

const initWorker = (io) => {
  const worker = new Worker(
    "chat-messages",
    async (job) => {
      // Extract tempId
      const { content, senderId, channelId, attachmentUrl, tempId } = job.data;
      console.log(
        `⚙️ Worker Processing: Message from ${senderId} in ${channelId}`,
      );

      try {
        // 1. DATABASE WRITE
        const newMessage = await Message.create({
          content: content || "",
          senderId,
          conversationId: channelId,
          attachmentUrl: attachmentUrl || null,
        });

        // 2. FETCH DETAILS
        const fullMessage = await Message.findOne({
          where: { id: newMessage.id },
          include: [
            { model: User, as: "sender", attributes: ["username", "avatar"] },
          ],
        });

        // 3. PREPARE PAYLOAD
        const broadcastData = {
          id: fullMessage.id,
          content: fullMessage.content,
          attachmentUrl: fullMessage.attachmentUrl,
          sender: fullMessage.sender.username,
          senderId: fullMessage.senderId,
          time: new Date(fullMessage.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          channelId: channelId,
          avatar: fullMessage.sender.avatar,
          reactions: [],
          tempId: tempId, // <--- Send back to client
        };

        // 4. CACHE UPDATE
        const cacheKey = `messages:channel:${channelId}`;
        const cacheExists = await redisClient.exists(cacheKey);

        if (cacheExists) {
          await redisClient.lPush(cacheKey, JSON.stringify(broadcastData));
          await redisClient.lTrim(cacheKey, 0, 49);
        }

        // 5. BROADCAST
        io.to(channelId).emit("receive_message", broadcastData);

        console.log(`✅ Worker Completed: Msg ${newMessage.id}`);
        return broadcastData;
      } catch (err) {
        console.error("❌ Worker Failed:", err);
        throw err;
      }
    },
    { connection },
  );

  worker.on("failed", (job, err) => {
    console.error(`Job ${job.id} failed: ${err.message}`);
  });

  console.log("👷 Chat Worker Started");
};

module.exports = initWorker;
