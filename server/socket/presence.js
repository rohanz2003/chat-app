module.exports = (io, socket, users, userProfiles) => {
  socket.on("join", (data) => {
    // Handle both old string format and new object format
    const userId = typeof data === 'string' ? data : data?.email;
    const profilePic = typeof data === 'object' ? data?.profilePic : null;

    if (!userId || userId.trim() === "") {
      console.log("❌ Invalid userId received");
      return;
    }

    users[userId] = socket.id;
    
    // Join a personal room named after the email to handle multiple tabs/reconnects
    socket.join(userId);

    // Store profile picture if provided
    if (profilePic) {
      userProfiles[userId] = profilePic;
      console.log(`👤 ${userId} profile picture updated`);
    }

    console.log(`✅ ${userId} is online`);
    console.log(`📊 Current online users: ${Object.keys(users).join(", ")}`);
    
    // Broadcast profile picture update to all clients
    if (profilePic) {
      io.emit("user-profile-update", {
        email: userId,
        profilePic: profilePic
      });
    }
    
    // Broadcast to all clients the updated online users list
    io.emit("online-users", Object.keys(users));
  });
};