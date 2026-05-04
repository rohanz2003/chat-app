module.exports = (io, socket, users) => {
  socket.on("join", (userId) => {
    if (!userId || userId.trim() === "") {
      console.log("❌ Invalid userId received");
      return;
    }

    users[userId] = socket.id;
    console.log(`✅ ${userId} is online`);
    console.log(`📊 Current online users: ${Object.keys(users).join(", ")}`);
    
    // Broadcast to all clients the updated online users list
    io.emit("online-users", Object.keys(users));
  });
};