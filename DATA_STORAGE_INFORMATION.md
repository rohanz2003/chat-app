# 📊 Chat Application - Data Storage & Architecture Guide

---

## 🎯 Overview

Your chat application uses a **multi-layered data storage system** with:
- **Firebase** for authentication
- **MongoDB** for persistent data storage
- **Socket.IO** for real-time communication
- **Browser localStorage** for client-side data

---

## 📍 Data Storage Locations

### 1. **Authentication Data** 🔐

#### Where: **Firebase Authentication**
- **Provider**: Google Firebase (Cloud-based)
- **Project ID**: `chat-app-1f9c3`
- **Service**: `getAuth()` from Firebase SDK
- **Configuration File**: 
  - Client: [`client/src/firebase.js`](client/src/firebase.js)
  - Server: [`server/socket/firebase.js`](server/socket/firebase.js)

#### Stored Information:
- **Email addresses** (required: Gmail only)
- **Passwords** (encrypted by Firebase)
- **UID** (Unique user identifier)
- **Email verification status**
- **Photo URL** (optional)

#### How It's Used:
```javascript
// Authentication Methods:
- signInWithEmailAndPassword()    // Login with email
- createUserWithEmailAndPassword()  // Register new user
- sendEmailVerification()          // Email verification
- signOut()                        // Logout
```

#### Access:
- **Frontend**: `auth` object in `client/src/firebase.js`
- **Console**: https://console.firebase.google.com

---

### 2. **User Data (Persistent)** 👤

#### Where: **MongoDB Database**
- **Connection**: MongoDB Atlas (Cloud-hosted)
- **URI**: `mongodb+srv://chatuser:yourpassword123@chat-app.qgjuxhv.mongodb.net/?appName=Chat-app`
- **Database Name**: Configured in MongoDB Atlas
- **Collection Name**: `users`
- **Model File**: [`server/models/User.js`](server/modules/User.js)

#### Data Stored:
```javascript
{
  _id: ObjectId,           // MongoDB unique ID
  email: String,           // User's email address
  lastSeen: Date,          // Last activity timestamp
  __v: Number             // Version field
}
```

#### Database Schema:
| Field | Type | Description |
|-------|------|-------------|
| `email` | String | User's Gmail address |
| `lastSeen` | Date | When user was last active |

#### How It's Updated:
```javascript
// File: server/controllers/userController.js
// Updates on every socket connection/activity
User.findOneAndUpdate(
  { email: userId },
  { lastSeen: new Date() },
  { upsert: true }  // Creates if doesn't exist
);
```

---

### 3. **Message Data** 💬

#### Where: **MongoDB Database**
- **Collection Name**: `messages`
- **Model File**: [`server/models/Message.js`](server/models/Message.js)
- **API Endpoints**: [`server/routes/messageRoutes.js`](server/routes/messageRoutes.js)
- **Controller**: [`server/controllers/messageController.js`](server/controllers/messageController.js)

#### Data Stored:
```javascript
{
  _id: ObjectId,              // MongoDB unique ID
  sender: String,             // Sender's email
  receiver: String,           // Receiver's email
  text: String/Object,        // Message content or media data
  type: String,               // 'text' or 'media'
  mediaType: String,          // 'image', 'video', 'application'
  tempId: String,             // Prevents duplicate messages
  timestamp: Date,            // When message was sent
  seen: Boolean,              // Read status (default: false)
  createdAt: Date             // Server creation time
}
```

#### Database Schema:
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `sender` | String | Required | Who sent the message |
| `receiver` | String | Required | Who receives the message |
| `text` | String/Object | Required | Message content |
| `type` | String | 'text' | Message type classification |
| `mediaType` | String | Optional | Type of attached media |
| `tempId` | String | Optional | Client-side deduplication ID |
| `timestamp` | Date | Required | When sent (matches client) |
| `seen` | Boolean | false | Has it been read? |
| `createdAt` | Date | Date.now() | Server timestamp |

#### Query Examples:
```javascript
// Get all messages between two users:
GET /api/messages?user1=user1@gmail.com&user2=user2@gmail.com

// Get recent conversations (chats list):
GET /api/messages/recent-chats?userEmail=user@gmail.com

// Response:
{
  conversations: {
    "otheruser@gmail.com": {
      userEmail: "otheruser@gmail.com",
      lastMessage: "Hello!",
      timestamp: "2026-05-26T10:30:00Z",
      type: "text",
      messageId: "ObjectId"
    }
  }
}
```

---

### 4. **Real-Time Session Data** ⚡

#### Where: **Memory (Socket.IO Server)**
- **File**: [`server/socket/socket.js`](server/socket/socket.js)
- **Handlers**: 
  - Presence: [`server/socket/presence.js`](server/socket/presence.js)
  - Typing: [`server/socket/typing.js`](server/socket/typing.js)
  - Messages: [`server/socket/message.js`](server/socket/message.js)

#### Data Stored (Non-Persistent):
```javascript
// Users object - stores online users
const users = {
  "user1@gmail.com": Set<socket.id>,    // Socket IDs
  "user2@gmail.com": Set<socket.id>
};

// User profiles - stores profile pictures
const userProfiles = {
  "user1@gmail.com": "data:image/jpeg;base64,...",
  "user2@gmail.com": "..."
};
```

#### Information Tracked:
- **Online Users**: Email addresses of connected users
- **Socket IDs**: WebSocket connection identifiers
- **Profile Pictures**: Base64 encoded images
- **Typing Status**: Who is typing in what conversation
- **User Status**: Online/Offline in real-time

#### Socket Events:
| Event | Direction | Data |
|-------|-----------|------|
| `join` | Client → Server | { email, profilePic } |
| `leave` | Client → Server | { email } |
| `online-users` | Server → Clients | [ "user1@gmail.com", "user2@gmail.com" ] |
| `user-profile-update` | Server → Clients | { email, profilePic } |
| `send-message` | Client → Server | Message object |
| `receive-message` | Server → Clients | Message object |
| `typing` | Client → Server | { sender, receiver } |
| `stop-typing` | Client → Server | { sender, receiver } |
| `user-typing` | Server → Clients | { email } |
| `user-stop-typing` | Server → Clients | { email } |

**⚠️ IMPORTANT**: This data is **NOT persisted**. It's cleared when:
- Server restarts
- User refreshes/closes browser
- Connection drops

---

### 5. **Client-Side Storage** 🖥️

#### Where: **Browser localStorage**
- **File**: [`client/src/components/Login.js`](client/src/components/Login.js)
- **Scope**: Per browser, per domain

#### Data Stored:

| Key | Value | Purpose |
|-----|-------|---------|
| `profilePic_<email>` | Base64 image | User's profile picture |
| User authentication token | JWT | Session management (from Firebase) |

#### Example:
```javascript
// Storing profile picture
localStorage.setItem(
  `profilePic_user1@gmail.com`, 
  "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
);

// Retrieving profile picture
const profilePic = localStorage.getItem(`profilePic_user1@gmail.com`);
```

#### Size Limits:
- **Typical limit**: 5-10 MB per domain
- **Warning**: App shows message if quota is exceeded
- **Automatic cleanup**: Not cleared by default

---

## 🔄 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                       │
├─────────────────────────────────────────────────────────────┤
│  localStorage                                               │
│  ├── Profile Pictures (Base64)                             │
│  └── Firebase Auth Token                                   │
│                                                             │
│  Memory (during session)                                    │
│  └── User object (email, uid, profilePic)                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    ┌───▼────┐          ┌────▼────┐
    │Firebase│          │Socket.IO│
    │  Auth  │          │ Server  │
    └───┬────┘          └────┬────┘
        │                    │
        │          (real-time data)
        │          online users,
        │          typing status,
        │          messages broadcast
        │                    │
        └────────┬───────────┘
                 │
        ┌────────▼──────────┐
        │   MongoDB Atlas   │
        ├──────────────────┤
        │ Collection:      │
        │ ├── users        │ (email, lastSeen)
        │ └── messages     │ (sender, receiver, text,
        │                  │  timestamp, seen, etc.)
        └──────────────────┘
```

---

## 🔑 Environment Variables

#### Location: `.env` file in server directory

```bash
# MongoDB Connection
MONGO_URI=mongodb+srv://chatuser:yourpassword123@chat-app.qgjuxhv.mongodb.net/?appName=Chat-app

# Server Configuration
PORT=5000
```

#### Firebase Configuration (Hardcoded in Files):
- **Client Config**: [`client/src/firebase.js`](client/src/firebase.js)
- **Server Config**: [`server/socket/firebase.js`](server/socket/firebase.js)

```javascript
{
  apiKey: "AIzaSyBQxTF0Xs2XewA7K1MVlPNvSOPtBcEQ88U",
  authDomain: "chat-app-1f9c3.firebaseapp.com",
  projectId: "chat-app-1f9c3",
  storageBucket: "chat-app-1f9c3.firebasestorage.app",
  messagingSenderId: "535968986106",
  appId: "1:535968986106:web:b14203e7b0b5498c656a43",
  measurementId: "G-51DCTJ8TPB"
}
```

---

## 📡 API Endpoints

### User Routes
**File**: [`server/routes/userRoutes.js`](server/routes/userRoutes.js)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/users/all` | Get all users |
| GET | `/api/users/:email` | Get specific user |
| POST | `/api/users` | Create/update user |

### Message Routes
**File**: [`server/routes/messageRoutes.js`](server/routes/messageRoutes.js)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/messages` | Get messages between users |
| GET | `/api/messages/recent-chats` | Get conversation list |
| POST | `/api/messages` | Save new message |

---

## 🔐 Security Considerations

### ✅ What's Protected:
- **Passwords**: Firebase handles encryption
- **Email**: Required validation (Gmail only)
- **Authentication**: JWT tokens from Firebase

### ⚠️ What's Not Protected:
- **Profile Pictures**: Stored as base64 (accessible to all)
- **Online Status**: Visible to all connected users
- **Message Text**: Not encrypted in MongoDB
- **Firebase Config**: Hardcoded in client (this is normal for client-side Firebase)

### Recommendations:
1. ✅ HTTPS only in production
2. ✅ MongoDB IP whitelist configured
3. ❌ Consider encrypting messages end-to-end
4. ❌ Consider hashing/storing profile pictures securely

---

## 🗄️ Database Collections

### MongoDB Collections Overview

#### Collection: `users`
```javascript
db.users.find()
// Output:
[
  {
    _id: ObjectId("..."),
    email: "user1@gmail.com",
    lastSeen: ISODate("2026-05-26T10:30:00Z"),
    __v: 0
  },
  {
    _id: ObjectId("..."),
    email: "user2@gmail.com",
    lastSeen: ISODate("2026-05-26T10:31:00Z"),
    __v: 0
  }
]
```

#### Collection: `messages`
```javascript
db.messages.find()
// Output:
[
  {
    _id: ObjectId("..."),
    sender: "user1@gmail.com",
    receiver: "user2@gmail.com",
    text: "Hello, how are you?",
    type: "text",
    tempId: "msg_123",
    timestamp: ISODate("2026-05-26T10:30:45Z"),
    seen: true,
    createdAt: ISODate("2026-05-26T10:30:45Z"),
    __v: 0
  },
  {
    _id: ObjectId("..."),
    sender: "user2@gmail.com",
    receiver: "user1@gmail.com",
    text: "I'm doing great!",
    type: "text",
    tempId: "msg_124",
    timestamp: ISODate("2026-05-26T10:31:00Z"),
    seen: false,
    createdAt: ISODate("2026-05-26T10:31:00Z"),
    __v: 0
  }
]
```

---

## 📊 Data Persistence Summary

| Data Type | Storage | Persistent | Scope |
|-----------|---------|-----------|-------|
| **Passwords** | Firebase | ✅ Yes | Global (all devices) |
| **Email & UID** | Firebase + MongoDB | ✅ Yes | Global (all devices) |
| **Messages** | MongoDB | ✅ Yes | Global (shared) |
| **User Last Seen** | MongoDB | ✅ Yes | Global |
| **Online Status** | Socket.IO Memory | ❌ No | Current server only |
| **Typing Indicator** | Socket.IO Memory | ❌ No | Current session only |
| **Profile Pictures** | localStorage + Memory | ⚠️ Mixed | Per browser |

---

## 🚀 Accessing Your Data

### MongoDB Atlas:
1. Go to: https://www.mongodb.com/cloud/atlas
2. Login with your account
3. Find cluster: `chat-app`
4. Database: Find your database name
5. Collections: `users` and `messages`

### Firebase Console:
1. Go to: https://console.firebase.google.com
2. Select project: `chat-app-1f9c3`
3. **Authentication**: View all users registered
4. **Firestore** (if used): View stored documents

### Browser DevTools:
```javascript
// Check localStorage
localStorage.getItem('profilePic_user@gmail.com')

// Check session data (must be during active session)
// Open DevTools → Application → Storage
```

---

## 📝 Notes

- **User Privacy**: All user emails are visible to each other (part of chat functionality)
- **Message History**: All messages are permanently stored in MongoDB
- **Profile Pictures**: Limited to 150x150px compressed images
- **Validation**: Only Gmail addresses are allowed
- **Real-time Updates**: Socket.IO provides instant updates across all connected clients

---

**Last Updated**: May 26, 2026  
**Version**: 1.0  
**Status**: Production Ready
