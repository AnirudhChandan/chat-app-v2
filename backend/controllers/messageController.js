const {
  Message,
  User,
  MessageReaction,
  ConversationParticipant,
  Sequelize,
} = require("../db/models");
const redisClient = require("../lib/redis");

const CACHE_TTL = 3600; // Cache for 1 hour (in seconds)

// --- GET MESSAGES (With Read Receipts) ---
exports.getMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    // 1. Fetch Participant Read Status for the Blue Ticks
    // We need to know "User X read up to Message Y"
    const participants = await ConversationParticipant.findAll({
      where: { conversationId: channelId },
      attributes: ["userId", "lastReadMessageId"],
    });

    // Convert to a simple map: { userId: lastReadId }
    const readStatus = {};
    participants.forEach((p) => {
      readStatus[p.userId] = p.lastReadMessageId;
    });

    const cacheKey = `messages:channel:${channelId}`;

    // 2. Try Cache (Only for Page 1)
    if (page == 1) {
      const cachedData = await redisClient.lRange(cacheKey, 0, limit - 1);

      if (cachedData && cachedData.length > 0) {
        console.log(`⚡ Cache HIT for ${cacheKey}`);
        const messages = cachedData.map((item) => JSON.parse(item));

        return res.json({
          messages: messages.reverse(),
          hasMore: messages.length === limit,
          readStatus, // Pass read status even on cache hit
        });
      }
    }

    console.log(`🐢 Cache MISS for ${cacheKey} (Page ${page})`);

    // 3. Fetch from DB
    const messages = await Message.findAll({
      where: { conversationId: channelId },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["username", "avatar"],
        },
        {
          model: MessageReaction,
          as: "reactions",
          attributes: ["id", "emoji", "userId"],
          include: [{ model: User, as: "user", attributes: ["username"] }],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: limit,
      offset: offset,
    });

    // 4. Format Data
    const formatted = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      attachmentUrl: msg.attachmentUrl,
      sender: msg.sender.username,
      senderId: msg.senderId,
      time: new Date(msg.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      reactions: msg.reactions || [],
    }));

    // 5. Update Cache (Warmup) - Only for Page 1
    if (page == 1 && formatted.length > 0) {
      await redisClient.del(cacheKey);
      const strings = formatted.map((m) => JSON.stringify(m));
      await redisClient.rPush(cacheKey, strings);
      await redisClient.expire(cacheKey, CACHE_TTL);
    }

    // 6. Response
    res.json({
      messages: formatted.reverse(),
      hasMore: messages.length === limit,
      readStatus, // Pass read status on DB fetch
    });
  } catch (error) {
    console.error("GetMessages Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// --- REACT TO MESSAGE ---
exports.reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji, userId } = req.body;

    const targetMessage = await Message.findByPk(messageId);
    if (!targetMessage)
      return res.status(404).json({ message: "Message not found" });

    const existing = await MessageReaction.findOne({
      where: { messageId, userId, emoji },
    });

    let result;
    if (existing) {
      await existing.destroy();
      result = { action: "removed", messageId, emoji, userId };
    } else {
      const newReaction = await MessageReaction.create({
        messageId,
        userId,
        emoji,
      });
      result = { action: "added", reaction: newReaction };
    }

    // INVALIDATE CACHE
    const cacheKey = `messages:channel:${targetMessage.conversationId}`;
    await redisClient.del(cacheKey);
    console.log(`🗑️ Invalidated Cache: ${cacheKey}`);

    return res.json(result);
  } catch (error) {
    console.error("Reaction Error:", error);
    res.status(500).json({ message: "Reaction failed" });
  }
};

// --- SEARCH MESSAGES (Prefix Support) ---
exports.searchMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({ messages: [] });
    }

    // Sanitize and Format for Prefix Search (e.g., "Hello World" -> "Hello:* & World:*")
    const formattedQuery = q
      .trim()
      .split(/\s+/)
      .map((term) => {
        const cleanTerm = term.replace(/[^\w]/g, "");
        return cleanTerm ? `${cleanTerm}:*` : "";
      })
      .filter(Boolean)
      .join(" & ");

    if (!formattedQuery) {
      return res.json({ messages: [] });
    }

    const messages = await Message.findAll({
      where: {
        conversationId: channelId,
        [Sequelize.Op.and]: Sequelize.literal(
          `"searchVector" @@ to_tsquery('english', '${formattedQuery}')`,
        ),
      },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["username", "avatar"],
        },
        {
          model: MessageReaction,
          as: "reactions",
          include: [{ model: User, as: "user", attributes: ["username"] }],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 50,
    });

    const formatted = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      attachmentUrl: msg.attachmentUrl,
      sender: msg.sender.username,
      senderId: msg.senderId,
      time: new Date(msg.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      reactions: msg.reactions || [],
    }));

    res.json({ messages: formatted });
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ message: "Search failed" });
  }
};
