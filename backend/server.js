const dotenv = require("dotenv");
dotenv.config(); // <--- MOVE THIS TO THE TOP (Line 1 & 2)

const express = require("express");
const http = require("http");
const cors = require("cors");
// const dotenv = require("dotenv"); // <--- DELETE THIS LINE (Moved up)
const db = require("./db/models");
const initSocket = require("./sockets");
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const initWorker = require("./workers/chatWorker");
const initReceiptWorker = require("./workers/receiptWorker");

const {
  getMessages,
  reactToMessage,
  searchMessages,
} = require("./controllers/messageController");

// dotenv.config(); // <--- DELETE THIS LINE (Moved up)

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);

// Messages Routes
app.get("/api/messages/:channelId/search", searchMessages);
app.get("/api/messages/:channelId", getMessages);
app.post("/api/messages/:messageId/react", reactToMessage);

const PORT = process.env.PORT || 5001;

initSocket(server).then((io) => {
  app.set("socketio", io);

  // Start Background Workers
  initWorker(io);
  initReceiptWorker();

  db.sequelize
    .authenticate()
    .then(() => {
      console.log("✅ Database connected successfully.");
      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("❌ Unable to connect to the database:", err);
    });
});
