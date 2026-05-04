import React, { useEffect, useState } from "react";
import useSocket from "../hooks/useSocket";
import { formatLastSeen } from "../utils/timeFormatter";
import { useNavigate } from "react-router-dom";
import "./Chat.css";

function Chat() {
  const socket = useSocket();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [chatHistory, setChatHistory] = useState({}); // Store all chats by user
  const [typingUser, setTypingUser] = useState(null);
  const [lastSeen, setLastSeen] = useState({});
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState({}); // Track unread counts

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) navigate("/");
    else setUser(JSON.parse(storedUser));
  }, [navigate]);

  useEffect(() => {
    if (!user || !socket) return;

    socket.emit("join", user.email);
    socket.on("online-users", setOnlineUsers);

    socket.on("typing", (from) => setTypingUser(from));
    socket.on("stop-typing", () => setTypingUser(null));

    socket.on("last-seen", (data) => {
      setLastSeen((prev) => ({
        ...prev,
        [data.userId]: data.time,
      }));
    });

    // Listen for unread message updates from server
    socket.on("unread-update", (unreadData) => {
      console.log("📬 Unread messages updated:", unreadData);
      setUnreadMessages(unreadData);
    });

    // Listen for incoming messages globally (even when not in the room)
    const handleIncomingMessage = (msg) => {
      console.log("📨 Incoming message:", msg);
      
      // Update chat history
      setChatHistory((prev) => ({
        ...prev,
        [msg.sender]: [...(prev[msg.sender] || []), msg]
      }));

      // If this message is from the currently selected user, update messages display
      if (selectedUser === msg.sender) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on("receive-message", handleIncomingMessage);

    return () => {
      socket.off("online-users");
      socket.off("typing");
      socket.off("stop-typing");
      socket.off("last-seen");
      socket.off("unread-update");
      socket.off("receive-message", handleIncomingMessage);
    };
  }, [socket, user, selectedUser]);

  useEffect(() => {
    if (!user || !selectedUser || !socket) return;

    console.log(`📍 Joining room for conversation: ${user.email} ↔ ${selectedUser}`);

    // Join room when user is selected
    socket.emit("join-room", { user1: user.email, user2: selectedUser });
    
    // Mark messages as read
    socket.emit("mark-as-read", { user1: user.email, user2: selectedUser });
    
    // Load chat history for this user
    setMessages(chatHistory[selectedUser] || []);

  }, [selectedUser, user, socket]);

  const handleTyping = (e) => {
    if (!user) return;

    setMessage(e.target.value);

    if (selectedUser) {
      socket.emit("typing", { from: user.email, to: selectedUser });
      setTimeout(() => {
        socket.emit("stop-typing", { from: user.email, to: selectedUser });
      }, 1000);
    }
  };

  const sendMessage = () => {
    if (!user || !selectedUser || !message.trim() || !socket) return;

    const msgText = message;
    console.log(`📤 Sending message from ${user.email} to ${selectedUser}: "${msgText}"`);

    // Send to server
    socket.emit("send-message", {
      sender: user.email,
      receiver: selectedUser,
      text: msgText,
    });

    setMessage("");
  };

  const logout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const handleUserSelect = (u) => {
    console.log(`👤 Selected user: ${u}`);
    setSelectedUser(u);
    
    // Update messages when user is selected
    if (chatHistory[u]) {
      setMessages(chatHistory[u]);
    }
  };

  // Filter out current user from the user list
  const otherOnlineUsers = onlineUsers.filter(u => u !== user?.email);
  
  // Get recent chats sorted by latest message
  const recentChats = Object.keys(chatHistory)
    .filter(u => u !== user?.email)
    .sort((a, b) => {
      const timeA = chatHistory[a][chatHistory[a].length - 1]?.timestamp || 0;
      const timeB = chatHistory[b][chatHistory[b].length - 1]?.timestamp || 0;
      return new Date(timeB) - new Date(timeA);
    });

  const isUserOnline = (userEmail) => onlineUsers.includes(userEmail);

  // Get unread count for a user
  const getUnreadCount = (otherUser) => {
    if (!user) return 0;
    const key = `${otherUser}_${user.email}`;
    return unreadMessages[key] || 0;
  };

  if (!user) return <h2>Loading...</h2>;

  return (
    <div className="chat-layout">

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>💬 Chats</h3>
          <span className="user-badge">{user.email.split('@')[0]}</span>
        </div>

        {/* RECENT CHATS SECTION */}
        {recentChats.length > 0 && (
          <div className="section">
            <div className="section-title">Recent Chats</div>
            {recentChats.map((u, i) => {
              const unreadCount = getUnreadCount(u);
              return (
                <div 
                  key={`recent-${i}`}
                  className={`user-item ${selectedUser === u ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => handleUserSelect(u)}
                >
                  {unreadCount > 0 && <div className="unread-dot"></div>}
                  <div className="user-info">
                    <div className="user-name-with-badge">
                      {u}
                      {unreadCount > 0 && (
                        <span className="unread-badge">{unreadCount}</span>
                      )}
                    </div>
                    <div className="user-status">
                      {isUserOnline(u) ? '🟢 Online' : '⚫ Offline'}
                    </div>
                  </div>
                  {isUserOnline(u) && <span className="online-dot">●</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* ONLINE USERS SECTION */}
        <div className="section">
          <div className="section-title">Online Users</div>
          {otherOnlineUsers.length === 0 ? (
            <div className="no-users">No users online</div>
          ) : (
            otherOnlineUsers.map((u, i) => {
              const unreadCount = getUnreadCount(u);
              return (
                <div 
                  key={`online-${i}`}
                  className={`user-item ${selectedUser === u ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => handleUserSelect(u)}
                >
                  {unreadCount > 0 && <div className="unread-dot"></div>}
                  <div className="user-info">
                    <div className="user-name-with-badge">
                      {u}
                      {unreadCount > 0 && (
                        <span className="unread-badge">{unreadCount}</span>
                      )}
                    </div>
                    <div className="user-status">Online</div>
                  </div>
                  <span className="online-dot">●</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MAIN CHAT */}
      <div className="chat-container">

        {/* HEADER */}
        <div className="chat-header">
          <div>
            {selectedUser ? (
              <>
                <h2>{selectedUser}</h2>
                <div className="status">
                  {isUserOnline(selectedUser)
                    ? "🟢 Online"
                    : formatLastSeen(lastSeen[selectedUser])}
                </div>
              </>
            ) : (
              <h2>Select a chat to start messaging</h2>
            )}
          </div>

          <button onClick={logout}>Logout</button>
        </div>

        {/* MESSAGES */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-chat">
              {selectedUser ? '👋 Start the conversation!' : '👀 No chat selected'}
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`message ${
                  msg.sender === user.email ? "sent" : "received"
                }`}
              >
                {msg.text}
              </div>
            ))
          )}

          {typingUser && typingUser !== user.email && (
            <div className="typing">✍️ {typingUser} is typing...</div>
          )}
        </div>

        {/* INPUT */}
        <div className="chat-input">
          <input
            type="text"
            placeholder={selectedUser ? "Type a message..." : "Select a user first"}
            value={message}
            onChange={handleTyping}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            disabled={!selectedUser}
          />
          <button onClick={sendMessage} disabled={!selectedUser}>➤</button>
        </div>

      </div>
    </div>
  );
}

export default Chat;
