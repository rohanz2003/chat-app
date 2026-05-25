module.exports = (io, socket, users) => {
  const normalizeEmail = (email) => (email || "").toLowerCase().trim();

  socket.on("typing", ({ from, to }) => {
    const normalizedFrom = normalizeEmail(from);
    const target = normalizeEmail(to);
    if (!normalizedFrom || !target) return;
    io.to(target).emit("typing", { from: normalizedFrom });
  });

  socket.on("stop-typing", ({ from, to }) => {
    const normalizedFrom = normalizeEmail(from);
    const target = normalizeEmail(to);
    if (!normalizedFrom || !target) return;
    io.to(target).emit("stop-typing", { from: normalizedFrom });
  });
};