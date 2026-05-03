module.exports = (io, socket, users) => {
  socket.on("typing", ({ from, to }) => {
    if (users[to]) {
      io.to(users[to]).emit("typing", from);
    }
  });

  socket.on("stop-typing", ({ from, to }) => {
    if (users[to]) {
      io.to(users[to]).emit("stop-typing");
    }
  });
};