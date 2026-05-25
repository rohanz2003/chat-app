module.exports = (io, socket, users) => {
  const normalizeEmail = (email) => (email || "").toLowerCase().trim();

  socket.on("typing", ({ from, to }) => {
    const normalizedFrom = normalizeEmail(from);
    const target = normalizeEmail(to);
    console.log(`📨 Typing event received - from: ${normalizedFrom}, to: ${target}`);
    if (!normalizedFrom || !target) {
      console.warn(`⚠️ Invalid typing payload`);
      return;
    }
    console.log(`📤 Broadcasting typing to room: ${target}`);
    io.to(target).emit("typing", { from: normalizedFrom });
  });

  socket.on("stop-typing", ({ from, to }) => {
    const normalizedFrom = normalizeEmail(from);
    const target = normalizeEmail(to);
    console.log(`📨 Stop-typing event received - from: ${normalizedFrom}, to: ${target}`);
    if (!normalizedFrom || !target) {
      console.warn(`⚠️ Invalid stop-typing payload`);
      return;
    }
    console.log(`📤 Broadcasting stop-typing to room: ${target}`);
    io.to(target).emit("stop-typing", { from: normalizedFrom });
  });
};