const { Queue } = require("bullmq");
require("dotenv").config();

// Configuration for Redis connection
const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
};

// Create the Queue instance
const messageQueue = new Queue("chat-messages", { connection });

module.exports = { messageQueue, connection };
