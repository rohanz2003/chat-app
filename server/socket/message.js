const Message = require("../models/Message");

const getRoomId = (user1, user2) => {
  return [user1, user2].sort().join("_");
};

// Track which users are in which rooms
const roomUsers = {};
// Track unread messages
const unreadMessages = {};

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
    
    // Mark messages as read when user enters the room
    const key = `${user2}_${user1}`; // unread from user2 to user1
    if (unreadMessages[key]) {
      unreadMessages[key] = 0;
      console.log(`✓✓ Marked messages as read for ${user1} from ${user2}`);
      io.emit("unread-update", unreadMessages);
    }
  });

  // SEND MESSAGE
  socket.on("send-message", async (data, callback) => {
    const { sender, receiver, text, type, mediaType, tempId } = data;
    const roomId = getRoomId(sender, receiver);

    try {
      let message = { 
        sender, 
        receiver, 
        text,
        type: type || 'text',
        mediaType: mediaType || null,
        tempId: tempId,
        timestamp: new Date(),
        seen: false
      };
      
      // Try to save to DB
      try {
        message = await Message.create({
          sender,
          receiver,
          text,
          type: type || 'text',
          mediaType: mediaType || null,
          tempId: tempId,
          seen: false
        });
      } catch (dbErr) {
        console.log("📝 Message not saved to DB (MongoDB offline), broadcasting in real-time only");
        message._id = Date.now().toString();
      }

      // Track unread message
      const unreadKey = `${sender}_${receiver}`;
      unreadMessages[unreadKey] = (unreadMessages[unreadKey] || 0) + 1;
      console.log(`📨 Unread from ${sender} to ${receiver}: ${unreadMessages[unreadKey]}`);

      // Send to all users in the room
      io.to(roomId).emit("receive-message", message);
      
      // Send unread count update to all clients
      io.emit("unread-update", unreadMessages);
      
      // Send acknowledgment back to sender
      if (callback) callback(true);
      
      console.log(`✅ Message broadcasted to room ${roomId}`);
      console.log(`   From: ${sender}, To: ${receiver}, Type: ${type}`);
      
    } catch (err) {
      console.error("❌ Error sending message:", err.message);
      socket.emit("error", { message: "Failed to send message" });
      if (callback) callback(false);
    }
  });

  // MARK MESSAGES AS READ
  socket.on("mark-as-read", ({ user1, user2 }) => {
    const unreadKey = `${user2}_${user1}`;
    if (unreadMessages[unreadKey]) {
      unreadMessages[unreadKey] = 0;
      console.log(`✓✓ Marked messages as read for ${user1} from ${user2}`);
      io.emit("unread-update", unreadMessages);
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

  // CLEAR CHAT (Delete messages from database)
  socket.on("clear-chat", async ({ user1, user2 }) => {
    try {
      // Delete all messages between these two users
      const result = await Message.deleteMany({
        $or: [
          { sender: user1, receiver: user2 },
          { sender: user2, receiver: user1 }
        ]
      });
      
      console.log(`🗑️ Deleted ${result.deletedCount} messages between ${user1} and ${user2}`);
      socket.emit("chat-cleared", { user1, user2 });
    } catch (err) {
      console.error("❌ Error clearing chat:", err.message);
      socket.emit("error", { message: "Failed to clear chat" });
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