const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// ROUTES
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");

// SOCKET
const initSocket = require("./socket/socket");

const app = express();
const server = http.createServer(app);

// 🔗 CONNECT SOCKET.IO
initSocket(server);

// 🧠 MIDDLEWARE
app.use(cors());
app.use(express.json());

// 📡 API ROUTES
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// 🏠 ROOT ROUTE
app.get("/", (req, res) => {
  res.send("Chat Server Running 🚀");
});

// 🔌 MONGODB CONNECTION
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => console.log("MongoDB Error ❌", err));

// 🚀 START SERVER
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});