module.exports = (io, socket, users) => {
  socket.on("join", (userId) => {
    users[userId] = socket.id;

    console.log(userId, "is online");

    io.emit("online-users", Object.keys(users));
  });
};