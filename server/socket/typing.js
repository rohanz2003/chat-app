module.exports = (io, socket, users) => {
  socket.on("typing", ({ from, to }) => {
    const target = to?.toLowerCase().trim();
    if (users[target]) {
      // Emit to the room named after the email address
      io.to(target).emit("typing", { from });
    }
  });

  socket.on("stop-typing", ({ from, to }) => {
    const target = to?.toLowerCase().trim();
    if (users[target]) {
      io.to(target).emit("stop-typing", { from });
    }
  });
};