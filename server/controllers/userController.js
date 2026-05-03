const User = require("../models/User");

exports.updateLastSeen = async (userId) => {
  await User.findOneAndUpdate(
    { email: userId },
    { lastSeen: new Date() },
    { upsert: true }
  );
};