import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MessageCircle,
  PlusCircle,
  BellRing,
  Settings,
  Smile,
  Paperclip,
  Home,
  Send,
  Trash2,
  Users,
  Layers,
  Sun,
  Moon
} from "lucide-react";
import { auth } from "../firebase";
import useSocket from "../hooks/useSocket";
import { formatLastSeen, formatMessageTime } from "../utils/timeFormatter";
import { fetchMessages } from "../services/messageService";
import { useNavigate } from "react-router-dom";
import "./Chat.css";

function Chat({ user: currentUser }) {
  const socket = useSocket();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [chatHistory, setChatHistory] = useState({}); // Store all chats by user
  const [typingUser, setTypingUser] = useState(null);
  const [lastSeen, setLastSeen] = useState({});
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState({}); // Track unread counts
  const [userProfiles, setUserProfiles] = useState({}); // Store user profile pictures
  const [isMediaSending, setIsMediaSending] = useState(false); // Track media upload state
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const typingTimeoutRef = useRef(null);

  // Use Ref to track selectedUser for the socket listener to avoid stale closures
  const selectedUserRef = useRef(selectedUser);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const formatDay = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric"
    });
  };

  // Helper to safely persist limited chat history without large media blobs or bloat
  const persistHistory = (historyObj, currentUserEmail) => {
    if (!currentUserEmail) return;
    try {
      const sanitized = {};
      Object.keys(historyObj).forEach(key => {
        // Cap to last 30 messages and strip heavy base64 media content for storage
        sanitized[key] = historyObj[key].slice(-30).map(m => ({
          ...m,
          text: m.type === 'media' ? { ...m.text, data: null, persisted: false } : m.text
        }));
      });
      localStorage.setItem(`chatHistory_${currentUserEmail}`, JSON.stringify(sanitized));
    } catch (e) {
      console.error("Failed to persist chat history", e);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate("/");
      return;
    }

    const userData = {
      email: currentUser.email,
      profilePic: currentUser.profilePic,
      uid: currentUser.uid
    };
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));

    if (userData.profilePic) {
      setUserProfiles((prev) => ({
        ...prev,
        [userData.email]: userData.profilePic
      }));
    }

    const savedPicFromReg = localStorage.getItem(`profilePic_${userData.email}`);
    if (savedPicFromReg && !userData.profilePic) {
      userData.profilePic = savedPicFromReg;
      localStorage.setItem("user", JSON.stringify(userData));
    }
  }, [currentUser, navigate]);

    if (storedUser) {
      const userData = JSON.parse(storedUser);
      const savedProfiles = localStorage.getItem(`userProfiles_${userData.email}`);
      if (savedProfiles) {
        try {
          setUserProfiles((prev) => ({
            ...prev,
            ...JSON.parse(savedProfiles)
          }));
        } catch (e) {
          console.error("Failed to restore profiles", e);
        }
      }
      const savedChatHistory = localStorage.getItem(`chatHistory_${userData.email}`);
      if (savedChatHistory) {
        try {
          setChatHistory(JSON.parse(savedChatHistory));
        } catch (e) {
          console.error("Failed to restore chat history", e);
        }
      }
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!user || !socket) return;

    // Restore unread counts from localStorage
    const storedUnread = localStorage.getItem(`unread_${user.email}`);
    if (storedUnread) {
      try { setUnreadMessages(JSON.parse(storedUnread)); } catch (e) { console.error('Failed to parse stored unread counts', e); }
    }

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
      setUserProfiles((prev) => {
        const updated = {
          ...prev,
          [data.email]: data.profilePic
        };
        // Save profiles to localStorage
        if (user) {
          localStorage.setItem(`userProfiles_${user.email}`, JSON.stringify(updated));
        }
        return updated;
      });
    });

    // Listen for chat cleared event
    socket.on("chat-cleared", ({ user1, user2 }) => {
      console.log(`✅ Chat between ${user1} and ${user2} has been cleared from database`);
    });

    // Listen for incoming messages globally (even when not in the room)
    const handleIncomingMessage = (msg) => {
      console.log("📨 Incoming message:", msg);
      
      const senderEmail = msg.sender.toLowerCase();
      const receiverEmail = msg.receiver.toLowerCase();
      const currentUserEmail = user.email.toLowerCase();
      const otherParty = senderEmail === currentUserEmail ? receiverEmail : senderEmail;
      
      // Update chat history
      setChatHistory((prev) => {
        const currentHistory = prev[otherParty] || [];
        
        // Avoid duplicates - check by _id, sender+text combo, or tempId
        const isDuplicate = currentHistory.some(m => 
          (msg._id && m._id === msg._id) || 
          (m.sender === msg.sender && m.receiver === msg.receiver && m.tempId === msg.tempId) ||
          (m.sender === msg.sender && m.receiver === msg.receiver && JSON.stringify(m.text) === JSON.stringify(msg.text) && m.type === msg.type)
        );
        
        if (isDuplicate) {
          console.log("⚠️ Duplicate message ignored");
          return prev;
        }

        const updated = {
          ...prev,
          [otherParty]: [...currentHistory, msg]
        };
        // Save sanitized history
        persistHistory(updated, user?.email);
        return updated;
      });

      // If this message is from the currently selected user, update messages display and mark as read
      if (selectedUserRef.current && selectedUserRef.current.toLowerCase() === otherParty) {
        setMessages((prev) => {
          const isDuplicate = prev.some(m =>
            (msg._id && m._id === msg._id) ||
            (msg.tempId && m.tempId === msg.tempId)
          );

          if (isDuplicate) return prev;
          return [...prev, msg].sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));
        });
        
        // Mark message as read since user is currently viewing this chat
        socket.emit("mark-as-read", { user1: user.email, user2: otherParty });
      } else {
        // Increment unread count for this conversation (client-side) and persist
        setUnreadMessages((prev) => {
          const key = `${otherParty.toLowerCase()}_${user.email.toLowerCase()}`;
          const newCounts = { ...prev, [key]: (prev[key] || 0) + 1 };
          try { localStorage.setItem(`unread_${user.email}`, JSON.stringify(newCounts)); } catch (e) { console.error('Failed to persist unread counts', e); }
          return newCounts;
        });
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
      socket.off("chat-cleared");
      socket.off("receive-message", handleIncomingMessage);
    };
  }, [socket, user]); // Removed selectedUser dependency to keep listener stable

  useEffect(() => {
    const syncChat = async () => {
      if (!user || !selectedUser || !socket) return;

      console.log(`📍 Joining room and fetching history: ${user.email} ↔ ${selectedUser}`);

      // 1. Join room
      socket.emit("join-room", { user1: user.email, user2: selectedUser });
      
      // 2. Mark messages as read on server
      socket.emit("mark-as-read", { user1: user.email, user2: selectedUser });
      
      // 3. Fetch full history from Database (Fixes the "no msg show" issue)
      try {
        const history = await fetchMessages(user.email, selectedUser) || [];
        
        setChatHistory(prev => ({ ...prev, [selectedUser]: history }));
        setMessages(prev => {
          // Merge history with any new messages that arrived via socket while fetching
          const historyIds = new Set(history.map(m => m._id).filter(Boolean));
          const historyTempIds = new Set(history.map(m => m.tempId).filter(Boolean));
          const uniqueLiveMessages = prev.filter(m => !historyIds.has(m._id) && !historyTempIds.has(m.tempId));
          const merged = [...history, ...uniqueLiveMessages];
          // Always sort to ensure chronological order regardless of fetch timing
          return merged.sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));
        });
      } catch (err) {
        console.error("Failed to fetch messages:", err);
        // Fallback: show no messages
        setMessages([]);
      }
    };

    syncChat();
  }, [selectedUser, user, socket]);

  const handleTyping = (e) => {
    const val = e.target.value;
    setMessage(val);

    if (user && selectedUser && socket) {
      socket.emit("typing", { from: user.email, to: selectedUser });
      
      // Debounce the stop-typing event and clear previous timers
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stop-typing", { from: user.email, to: selectedUser });
      }, 2000);
    }
  };

  const sendMessage = () => {
    if (!user || !selectedUser || !message.trim() || !socket) return;

    // Check if socket is connected
    if (!socket.connected) {
      alert("❌ You are offline. Please check your connection.");
      return;
    }

    const msgText = message;
    const tempId = `${Date.now()}-${Math.random()}`;
    console.log(`📤 Sending message from ${user.email} to ${selectedUser}: "${msgText}"`);

    // Create message object
    const newMsg = {
      sender: user.email,
      receiver: selectedUser,
      text: msgText,
      type: "text",
      tempId: tempId,
      timestamp: new Date().toISOString() // Ensure current time is captured precisely
    };

    // Send to server (don't add locally - wait for server broadcast to avoid duplicates)
    socket.emit("send-message", newMsg);

    setMessage("");
  };

  const handleMediaShare = (e) => {
    const file = e.target.files[0];
    if (!file || !user || !selectedUser || !socket) return;

    // Check if socket is connected
    if (!socket.connected) {
      alert("❌ You are offline. Please check your connection.");
      e.target.value = null;
      return;
    }

    // Prevent multiple sends
    if (isMediaSending) {
      alert("⏳ File is already being sent. Please wait...");
      e.target.value = null;
      return;
    }

    // Validate file size - REDUCED to prevent socket timeout
    const isImage = file.type.startsWith('image/');
    const maxSize = isImage ? 3 * 1024 * 1024 : 10 * 1024 * 1024; // 3MB images, 10MB others
    
    if (file.size > maxSize) {
      alert(`File size must be less than ${isImage ? '3MB' : '10MB'}. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      e.target.value = null;
      return;
    }

    setIsMediaSending(true);
    const tempId = `${Date.now()}-${Math.random()}`;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        // Don't send huge base64 strings - compress image if possible
        let fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result
        };

        console.log(`📎 Sending file: ${file.name} (${(file.size / 1024).toFixed(2)}KB)`);

        // Create message object
        const newMsg = {
          sender: user.email,
          receiver: selectedUser,
          text: fileData,
          type: "media",
          mediaType: file.type.split('/')[0],
          tempId: tempId,
          timestamp: new Date().toISOString()
        };

        // Send to server (don't add locally - wait for server broadcast to avoid duplicates)
        socket.emit("send-message", newMsg, (ack) => {
          if (ack) {
            console.log("✅ Media sent successfully");
          } else {
            console.error("❌ Media send failed - server did not acknowledge");
          }
        });
        
      } catch (err) {
        console.error("❌ Error processing file:", err);
        alert("❌ Error sending file. Please try again.");
      } finally {
        setIsMediaSending(false);
        e.target.value = null;
      }
    };

    reader.onerror = () => {
      console.error("❌ Error reading file");
      alert("❌ Error reading file. Please try again.");
      setIsMediaSending(false);
      e.target.value = null;
    };

    // Read file as base64 but with a safety check
    try {
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("❌ Cannot read file:", err);
      alert("❌ Cannot read this file. Please try another.");
      setIsMediaSending(false);
      e.target.value = null;
    }
  };

  const handleClearAllHistory = () => {
    if (!user) return;
    if (window.confirm("Are you sure you want to clear ALL chat history?")) {
      // Delete all messages from database for this user
      if (socket && socket.connected) {
        Object.keys(chatHistory).forEach(otherUser => {
          socket.emit("clear-chat", { user1: user.email, user2: otherUser });
        });
        console.log("🗑️ Clearing all chats from database");
      }
      
      // Clear localStorage
      localStorage.removeItem(`chatHistory_${user.email}`);
      setChatHistory({});
      setMessages([]);
      setSelectedUser(null);
      console.log("🗑️ All chat history cleared.");
    }
  };

  const logout = () => {
    auth.signOut().then(() => {
      localStorage.removeItem("user");
      navigate("/");
    });
  };

  const handleUserSelect = (u) => {
    console.log(`👤 Selected user: ${u}`);
    setSelectedUser(u);
    
    // Update messages when user is selected, ensuring chronological order
    if (chatHistory[u]) {
      setMessages(chatHistory[u].sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt)));
    }

    // Clear unread badge for this chat
    if (user) {
      setUnreadMessages(prev => {
        const key = `${u.toLowerCase()}_${user.email.toLowerCase()}`;
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        try { localStorage.setItem(`unread_${user.email}`, JSON.stringify(next)); } catch (e) { console.error('Failed to persist unread counts', e); }
        return next;
      });
    }
  };

  // Filter out current user from the user list
  const otherOnlineUsers = onlineUsers.filter(u => 
    u.toLowerCase().trim() !== user?.email?.toLowerCase().trim()
  );
  
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
    if (!user || !otherUser) return 0;
    const key = `${otherUser.toLowerCase()}_${user.email.toLowerCase()}`;
    return unreadMessages[key] || 0;
  };

  const searchValue = searchTerm.trim().toLowerCase();
  const filteredRecentChats = recentChats.filter((u) =>
    u.toLowerCase().includes(searchValue)
  );
  const filteredOnlineUsers = otherOnlineUsers.filter((u) =>
    u.toLowerCase().includes(searchValue)
  );

  if (!user) return <h2>Loading...</h2>;

  return (
    <div className={`chat-layout ${isDarkMode ? "dark" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-head">
            <div className="brand-mark">C</div>
            <div className="brand-copy">
              <strong>Connect</strong>
              <span>Enterprise messenger</span>
            </div>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setIsDarkMode((prev) => !prev)}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="sidebar-tabs">
          <button className="tab active">
            <MessageCircle size={16} /> Chats
          </button>
        </div>

        <div className="sidebar-search">
          <Search size={16} />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations"
          />
        </div>

        <div className="profile-card">
          <div className="profile-card-main">
            <img
              src={user.profilePic || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80"}
              alt={user.email}
              className="profile-card-avatar"
            />
            <div>
              <span className="profile-name">{user.email.split("@")[0]}</span>
              <span className="profile-meta">
                {isUserOnline(user.email) ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          <button
            className="primary-btn"
            onClick={() => setSelectedUser(null)}
          >
            <PlusCircle size={16} /> New Message
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Recent Chats</div>
          <div className="sidebar-list">
            {filteredRecentChats.length > 0 ? filteredRecentChats.map((u, i) => {
              const unreadCount = getUnreadCount(u);
              return (
                <button
                  key={`recent-${i}`}
                  className={`user-item ${selectedUser === u ? "active" : ""}`}
                  onClick={() => handleUserSelect(u)}
                >
                  <div className="avatar-wrap">
                    <img
                      src={userProfiles[u] || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80"}
                      alt={u}
                      className="user-avatar"
                    />
                    {isUserOnline(u) && <span className="status-dot" />}
                  </div>
                  <div className="user-item-copy">
                    <span className="user-name">{u}</span>
                    <span className="user-last">{isUserOnline(u) ? "Online" : "Last active"}</span>
                  </div>
                  {unreadCount > 0 && (
                    <span className="unread-badge">{unreadCount}</span>
                  )}
                </button>
              );
            }) : (
              <div className="empty-list">Try searching or start a new conversation.</div>
            )}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Online Users</div>
          <div className="sidebar-list">
            {filteredOnlineUsers.length > 0 ? filteredOnlineUsers.map((u, i) => (
              <button
                key={`online-${i}`}
                className={`user-item ${selectedUser === u ? "active" : ""}`}
                onClick={() => handleUserSelect(u)}
              >
                <div className="avatar-wrap">
                  <img
                    src={userProfiles[u] || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80"}
                    alt={u}
                    className="user-avatar"
                  />
                  <span className="status-dot online" />
                </div>
                <div className="user-item-copy">
                  <span className="user-name">{u}</span>
                  <span className="user-last">Available now</span>
                </div>
                {getUnreadCount(u) > 0 && (
                  <span className="unread-badge">{getUnreadCount(u)}</span>
                )}
              </button>
            )) : (
              <div className="empty-list">No contacts are available right now.</div>
            )}
          </div>
        </div>

        <div className="sidebar-actions">
          <button className="secondary-btn" onClick={handleClearAllHistory}>
            <Trash2 size={16} /> Archive
          </button>
          <button className="secondary-btn">
            <BellRing size={16} /> Help
          </button>
        </div>
      </aside>

      <main className="chat-panel">
        <div className="chat-panel-header">
          <div className="chat-panel-title">
            <div className="header-avatar-wrap">
              <img
                src={selectedUser ? userProfiles[selectedUser] || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80" : "https://images.unsplash.com/photo-1503416997304-3cc562acfdc5?auto=format&fit=crop&w=200&q=80"}
                alt={selectedUser || "Start"}
                className="header-avatar"
              />
            </div>
            <div>
              <h3>{selectedUser || "Welcome to Connect"}</h3>
              <p>{selectedUser ? (isUserOnline(selectedUser) ? "Online" : formatLastSeen(lastSeen[selectedUser])) : "Choose a conversation or create a new one."}</p>
            </div>
          </div>
          <div className="chat-header-actions">
            <button className="icon-btn" title="More options">
              <Settings size={18} />
            </button>
            <button className="logout-btn" onClick={logout}>Logout</button>
          </div>
        </div>

        <div className="chat-panel-body">
          {selectedUser ? (
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty-chat-state">
                  <MessageCircle size={32} />
                  <h4>No messages yet</h4>
                  <p>Send the first message to start the conversation.</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const previousMsg = messages[i - 1];
                  const showDay = !previousMsg || new Date(msg.timestamp || msg.createdAt).toDateString() !== new Date(previousMsg.timestamp || previousMsg.createdAt).toDateString();
                  return (
                    <React.Fragment key={msg._id || msg.tempId || `msg-${i}`}>
                      {showDay && (
                        <div className="day-separator">
                          <span>{formatDay(msg.timestamp || msg.createdAt)}</span>
                        </div>
                      )}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className={`message ${msg.sender === user.email ? "sent" : "received"}`}
                      >
                        <div className="message-content">
                          {msg.type === "media" ? (
                            <div className="media-message">
                              {msg.mediaType === "image" && msg.text?.data?.startsWith("data:image/") && (
                                <img src={msg.text.data} alt="Shared" className="media-image" />
                              )}
                              {msg.mediaType === "video" && msg.text?.data?.startsWith("data:video/") && (
                                <video controls className="media-video">
                                  <source src={msg.text.data} type={msg.text.type} />
                                  Your browser does not support video playback
                                </video>
                              )}
                              {msg.mediaType === "application" && msg.text?.data?.startsWith("data:application/") && (
                                <div className="media-file">
                                  <span>📎 {msg.text.name}</span>
                                  <a href={msg.text.data} download={msg.text.name} className="download-btn">Download</a>
                                </div>
                              )}
                            </div>
                          ) : (
                            msg.text
                          )}
                        </div>
                        <div className="message-meta">
                          <span>{formatMessageTime(msg.timestamp || msg.createdAt)}</span>
                          {msg.sender === user.email && <span className="read-receipt">✓✓</span>}
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                })
              )}

              <AnimatePresence>
                {typingUser && typingUser !== user.email && (
                  <motion.div
                    className="typing-indicator"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                  >
                    <span />
                    <span />
                    <span />
                    {typingUser} is typing...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <div className="welcome-panel">
                <h2>Welcome back, {user.email.split("@")[0]} 👋</h2>
                <p>Pick a chat or start messaging a colleague from the sidebar.</p>
              </div>
            </div>
          )}
        </div>

        <div className="chat-panel-footer">
          <button className="secondary-icon-btn" title="Emoji">
            <Smile size={18} />
          </button>
          <button className="secondary-icon-btn" title="Attach file">
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            placeholder={selectedUser ? "Write a message..." : "Select a conversation to send a message"}
            value={message}
            onChange={handleTyping}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            disabled={!selectedUser}
          />
          <label htmlFor="media-input" className="secondary-icon-btn" title="Upload media">
            <PlusCircle size={18} />
          </label>
          <input
            id="media-input"
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            onChange={handleMediaShare}
            disabled={!selectedUser}
            style={{ display: "none" }}
          />
          <button className="send-btn" onClick={sendMessage} disabled={!selectedUser}>
            <Send size={18} />
          </button>
        </div>
      </main>

      <aside className="dashboard-panel">
        <div className="dashboard-card welcome-card">
          <div className="dashboard-card-head">
            <div>
              <span className="eyebrow">Good day</span>
              <h4>Ready to connect?</h4>
            </div>
            <Home size={20} />
          </div>
          <p>Start a new chat, review mentions, and stay updated with your team activity.</p>
        </div>

        <div className="dashboard-card stats-card">
          <div className="dashboard-card-head">
            <span className="eyebrow">Analytics</span>
            <span>Live insights</span>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <span>24</span>
              <small>Active chats</small>
            </div>
            <div className="stat-item">
              <span>8</span>
              <small>Unread</small>
            </div>
            <div className="stat-item">
              <span>3</span>
              <small>New contacts</small>
            </div>
          </div>
          <div className="bar-chart" />
        </div>

        <div className="dashboard-card actions-card">
          <div className="dashboard-card-head">
            <span className="eyebrow">Quick actions</span>
            <span>Faster workflow</span>
          </div>
          <div className="action-list">
            <button className="action-pill"><PlusCircle size={16} /> Start new chat</button>
            <button className="action-pill"><Users size={16} /> Invite team member</button>
            <button className="action-pill"><Layers size={16} /> View activity</button>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {isMediaSending && (
          <motion.div
            className="toast-notice"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            Uploading file...
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="bottom-nav">
        <button className="bottom-nav-btn active"><MessageCircle size={18} /><span>Chat</span></button>
        <button className="bottom-nav-btn"><Users size={18} /><span>Contacts</span></button>
        <button className="bottom-nav-btn"><BellRing size={18} /><span>Alerts</span></button>
        <button className="bottom-nav-btn"><Settings size={18} /><span>More</span></button>
      </nav>
    </div>
  );
}

export default Chat;
