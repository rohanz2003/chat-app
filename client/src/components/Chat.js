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
  const [userProfiles, setUserProfiles] = useState({}); // Store user profile pictures

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) navigate("/");
    else {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      // Store current user's profile
      if (userData.profilePic) {
        setUserProfiles((prev) => ({
          ...prev,
          [userData.email]: userData.profilePic
        }));
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (!user || !socket) return;

    // Emit user join with profile picture
    socket.emit("join", {
      email: user.email,
      profilePic: user.profilePic || null
    });

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

    // Listen for profile picture updates
    socket.on("user-profile-update", (data) => {
      console.log("👤 Profile update:", data);
      setUserProfiles((prev) => ({
        ...prev,
        [data.email]: data.profilePic
      }));
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
      socket.off("user-profile-update");
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

  }, [selectedUser, user, socket, chatHistory]);

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

    // Create message object
    const newMsg = {
      sender: user.email,
      receiver: selectedUser,
      text: msgText,
      type: "text",
      timestamp: new Date().toISOString()
    };

    // Add to local state immediately (so you see your own message)
    setMessages((prev) => [...prev, newMsg]);
    setChatHistory((prev) => ({
      ...prev,
      [selectedUser]: [...(prev[selectedUser] || []), newMsg]
    }));

    // Send to server
    socket.emit("send-message", newMsg);

    setMessage("");
  };

  const handleMediaShare = (e) => {
    const file = e.target.files[0];
    if (!file || !user || !selectedUser || !socket) return;

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result
      };

      console.log(`📎 Sending file: ${file.name}`);

      // Create message object
      const newMsg = {
        sender: user.email,
        receiver: selectedUser,
        text: fileData,
        type: "media",
        mediaType: file.type.split('/')[0], // 'image', 'video', 'application'
        timestamp: new Date().toISOString()
      };

      // Add to local state immediately (so you see your own media message)
      setMessages((prev) => [...prev, newMsg]);
      setChatHistory((prev) => ({
        ...prev,
        [selectedUser]: [...(prev[selectedUser] || []), newMsg]
      }));

      // Send to server
      socket.emit("send-message", newMsg);
    };

    reader.readAsDataURL(file);
    e.target.value = null; // Reset input
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
                  {userProfiles[u] && (
                    <img src={userProfiles[u]} alt={u} className="user-avatar" />
                  )}
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
                  {userProfiles[u] && (
                    <img src={userProfiles[u]} alt={u} className="user-avatar" />
                  )}
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
          <div className="header-user-info">
            {selectedUser && userProfiles[selectedUser] && (
              <img src={userProfiles[selectedUser]} alt="Profile" className="header-profile-pic" />
            )}
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
                {msg.type === "media" ? (
                  <div className="media-message">
                    {msg.mediaType === "image" && (
                      <img src={msg.text.data} alt="Shared" className="media-image" />
                    )}
                    {msg.mediaType === "video" && (
                      <video controls className="media-video">
                        <source src={msg.text.data} type={msg.text.type} />
                        Your browser does not support video playback
                      </video>
                    )}
                    {msg.mediaType === "application" && (
                      <div className="media-file">
                        <span>📎 {msg.text.name}</span>
                        <a href={msg.text.data} download={msg.text.name} className="download-btn">
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  msg.text
                )}
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
          <label htmlFor="media-input" className="media-button" title="Share photo, video, or file">
            📎
          </label>
          <input
            id="media-input"
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            onChange={handleMediaShare}
            disabled={!selectedUser}
            style={{ display: 'none' }}
          />
          <button onClick={sendMessage} disabled={!selectedUser}>➤</button>
        </div>

      </div>
    </div>
  );
}

export default Chat;
