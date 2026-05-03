import axios from "axios";

export const fetchMessages = async (user1, user2) => {
  const res = await axios.get("http://localhost:5000/api/messages", {
    params: { user1, user2 },
  });
  return res.data;
};