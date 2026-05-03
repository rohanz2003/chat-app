const Message = require("../models/Message");

exports.getMessages = async (req, res) => {
  const { user1, user2 } = req.query;

  const messages = await Message.find({
    $or: [
      { sender: user1, receiver: user2 },
      { sender: user2, receiver: user1 },
    ],
  }).sort({ createdAt: 1 });

  res.json(messages);
};