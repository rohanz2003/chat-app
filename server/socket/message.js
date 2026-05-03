const Message = require("../models/Message");

const getRoomId = (user1, user2) => {
  return [user1, user2].sort().join("_");
};

// Track which users are in which rooms
const roomUsers = {};

module.exports = (io, socket, users) => {

  // JOIN ROOM
  socket.on("join-room", ({ user1, user2 }) => {
    const roomId = getRoomId(user1, user2);
    
    // Leave previous rooms
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });
    
    // Join new room
    socket.join(roomId);
    
    // Track who is in this room
    if (!roomUsers[roomId]) {
      roomUsers[roomId] = [];
    }
    if (!roomUsers[roomId].includes(user1)) {
      roomUsers[roomId].push(user1);
    }
    
    console.log(`✅ ${user1} joined room: ${roomId}`);
    console.log(`Room users:`, roomUsers[roomId]);
  });

  // SEND MESSAGE
  socket.on("send-message", async (data) => {
    const { sender, receiver, text } = data;
    const roomId = getRoomId(sender, receiver);

    try {
      let message = { 
        sender, 
        receiver, 
        text,
        timestamp: new Date()
      };
      
      // Try to save to DB
      try {
        message = await Message.create({
          sender,
          receiver,
          text,
        });
      } catch (dbErr) {
        console.log("📝 Message not saved to DB (MongoDB offline), broadcasting in real-time only");
        message._id = Date.now().toString();
      }

      // Send to all users in the room
      io.to(roomId).emit("receive-message", message);
      console.log(`✅ Message broadcasted to room ${roomId}`);
      console.log(`   From: ${sender}, To: ${receiver}, Text: "${text}"`);
      
    } catch (err) {
      console.error("❌ Error sending message:", err.message);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // SEEN MESSAGE
  socket.on("seen-message", async ({ sender, receiver }) => {
    try {
      await Message.updateMany(
        { sender, receiver, seen: false },
        { seen: true }
      );

      const roomId = getRoomId(sender, receiver);
      io.to(roomId).emit("message-seen", { sender, receiver });
    } catch (err) {
      console.log("Could not mark as seen:", err.message);
    }
  });

  // Clean up on disconnect
  socket.on("disconnect", () => {
    for (let roomId in roomUsers) {
      roomUsers[roomId] = roomUsers[roomId].filter(user => users[user] !== socket.id);
      if (roomUsers[roomId].length === 0) {
        delete roomUsers[roomId];
      }
    }
  });
};