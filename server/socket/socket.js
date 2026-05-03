const { Server } = require("socket.io");
const handlePresence = require("./presence");
const handleTyping = require("./typing");
const handleMessages = require("./message");

const initSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: ["http://localhost:3000", "http://localhost:3001"] },
  });

  // Global users tracking
  const users = {};

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    handlePresence(io, socket, users);
    handleTyping(io, socket, users);
    handleMessages(io, socket, users);

    // Handle disconnect
    socket.on("disconnect", () => {
      for (let userId in users) {
        if (users[userId] === socket.id) {
          delete users[userId];
          console.log(userId, "is offline");
          break;
        }
      }
      io.emit("online-users", Object.keys(users));
    });
  });
};

module.exports = initSocket;