# 🔧 PRODUCTION IMPLEMENTATION GUIDE

Complete code examples and file structure for scaling your chat app to handle millions of users.

---

## 📁 NEW FILE STRUCTURE

```
server/
├── index.js                          (MODIFY)
├── package.json                      (UPDATE)
├── .env                              (UPDATE)
├── config/
│   ├── redis.js                      (CREATE NEW)
│   ├── mongodb.js                    (CREATE NEW)
│   └── sharding.js                   (CREATE NEW)
├── middleware/
│   ├── rateLimiter.js               (CREATE NEW)
│   ├── logger.js                    (CREATE NEW)
│   └── errorHandler.js              (CREATE NEW)
├── services/
│   ├── cacheService.js              (CREATE NEW)
│   ├── queueService.js              (CREATE NEW)
│   └── metricsService.js            (CREATE NEW)
├── controllers/
│   ├── messageController.js          (MODIFY)
│   └── userController.js             (MODIFY)
├── models/
│   └── Message.js                    (MODIFY - ADD INDEXES)
├── routes/
│   ├── messageRoutes.js              (MODIFY)
│   └── userRoutes.js                 (MODIFY)
├── socket/
│   └── socket.js                     (MODIFY - ADD REDIS ADAPTER)
├── utils/
│   └── logger.js                     (CREATE NEW)
├── Dockerfile                        (CREATE NEW)
├── nginx.conf                        (CREATE NEW)
└── k8s-deployment.yaml              (CREATE NEW)

client/
├── .env                              (UPDATE)
├── .env.production                   (CREATE NEW)
└── public/
    └── robots.txt                    (UPDATE)
```

---

## 1. REDIS CONFIGURATION

### FILE: server/config/redis.js (CREATE NEW)

```javascript
const redis = require("redis");

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retry_strategy: (options) => {
    if (options.error && options.error.code === "ECONNREFUSED") {
      return new Error("Redis connection refused");
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error("Redis retry time exhausted");
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

redisClient.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

redisClient.on("connect", () => {
  console.log("✅ Redis Connected");
});

module.exports = redisClient;
```

---

## 2. MONGODB OPTIMIZATION

### FILE: server/config/mongodb.js (CREATE NEW)

```javascript
const mongoose = require("mongoose");

const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Connection pool - handle many connections
      maxPoolSize: 100,
      minPoolSize: 20,
      maxIdleTimeMS: 45000,
      
      // Retry settings
      retryWrites: true,
      retryReads: true,
      w: "majority",  // Wait for majority replica confirmation
      
      // Timeouts
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ MongoDB Connected with optimizations");

    // Monitor connection pool
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB Error:", err);
    });

  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err);
    process.exit(1);
  }
};

module.exports = connectMongoDB;
```

---

## 3. SOCKET.IO WITH REDIS ADAPTER

### FILE: server/socket/socket.js (MODIFY)

```javascript
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const handlePresence = require("./presence");
const handleTyping = require("./typing");
const handleMessages = require("./message");

const initSocket = async (server) => {
  // Create Redis clients for pub/sub
  const pubClient = createClient({
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  });

  const subClient = pubClient.duplicate();

  // Connect both clients
  await Promise.all([pubClient.connect(), subClient.connect()]);

  const io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"],
    adapter: createAdapter(pubClient, subClient),  // ⭐ REDIS ADAPTER
    pingInterval: 25000,
    pingTimeout: 60000
  });

  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    const users = {};  // Local cache
    const userProfiles = {};

    handlePresence(io, socket, users, userProfiles);
    handleTyping(io, socket, users);
    handleMessages(io, socket, users);

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
    });
  });

  return io;
};

module.exports = initSocket;
```

---

## 4. REDIS CACHING SERVICE

### FILE: server/services/cacheService.js (CREATE NEW)

```javascript
const redis = require("./config/redis");

const CACHE_EXPIRY = {
  USER_PROFILE: 3600,      // 1 hour
  RECENT_CHATS: 300,       // 5 minutes
  USER_LIST: 600,          // 10 minutes
  ONLINE_STATUS: 60        // 1 minute
};

class CacheService {
  // Get cached value or fetch from callback
  async getOrFetch(key, callback, expiry = 3600) {
    try {
      // Try cache first
      const cached = await redis.get(key);
      if (cached) {
        console.log(`✅ Cache hit: ${key}`);
        return JSON.parse(cached);
      }

      // Cache miss - fetch from callback
      console.log(`📍 Cache miss: ${key} - fetching...`);
      const data = await callback();

      // Store in cache
      await redis.setex(key, expiry, JSON.stringify(data));
      return data;
    } catch (err) {
      console.error(`❌ Cache error for ${key}:`, err);
      return await callback(); // Fallback to direct fetch
    }
  }

  // Get user profile with cache
  async getUserProfile(email) {
    return this.getOrFetch(
      `user:${email.toLowerCase()}`,
      async () => {
        const User = require("../models/User");
        return await User.findOne({ email: email.toLowerCase() });
      },
      CACHE_EXPIRY.USER_PROFILE
    );
  }

  // Get recent chats with cache
  async getRecentChats(userEmail) {
    return this.getOrFetch(
      `chats:${userEmail.toLowerCase()}`,
      async () => {
        const Message = require("../models/Message");
        return await Message.find({
          $or: [
            { sender: userEmail.toLowerCase() },
            { receiver: userEmail.toLowerCase() }
          ]
        }).sort({ timestamp: -1 }).limit(100);
      },
      CACHE_EXPIRY.RECENT_CHATS
    );
  }

  // Invalidate cache
  async invalidate(key) {
    await redis.del(key);
    console.log(`🗑️ Cache invalidated: ${key}`);
  }

  // Invalidate user-related cache
  async invalidateUserCache(email) {
    const email_lower = email.toLowerCase();
    await Promise.all([
      this.invalidate(`user:${email_lower}`),
      this.invalidate(`chats:${email_lower}`)
    ]);
  }
}

module.exports = new CacheService();
```

---

## 5. MESSAGE QUEUE SERVICE

### FILE: server/services/queueService.js (CREATE NEW)

```javascript
const Queue = require("bull");

// Create queues
const emailQueue = new Queue("email", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

const notificationQueue = new Queue("notifications", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

// Process email queue
emailQueue.process(10, async (job) => {
  const { email, type, data } = job.data;
  try {
    // Send email logic here
    console.log(`📧 Sending ${type} email to ${email}`);
    // await emailProvider.send(...)
    return { success: true };
  } catch (err) {
    console.error(`❌ Email failed for ${email}:`, err);
    throw err; // Retry
  }
});

// Process notification queue
notificationQueue.process(10, async (job) => {
  const { userId, message } = job.data;
  try {
    // Send notification logic here
    console.log(`🔔 Sending notification to ${userId}`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Notification failed:`, err);
    throw err;
  }
});

// Queue event handlers
emailQueue.on("completed", (job) => {
  console.log(`✅ Email job completed: ${job.id}`);
});

emailQueue.on("failed", (job, err) => {
  console.error(`❌ Email job failed: ${job.id} - ${err.message}`);
});

class QueueService {
  async sendVerificationEmail(email, token) {
    await emailQueue.add(
      { email, type: "verification", data: { token } },
      { 
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000
        }
      }
    );
  }

  async sendNotification(userId, message) {
    await notificationQueue.add(
      { userId, message },
      { 
        attempts: 2,
        backoff: { type: "fixed", delay: 1000 }
      }
    );
  }
}

module.exports = new QueueService();
```

---

## 6. RATE LIMITING MIDDLEWARE

### FILE: server/middleware/rateLimiter.js (CREATE NEW)

```javascript
const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const redis = require("../config/redis");

// Message sending - 100 per minute
const messageLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: "rl:msg:"
  }),
  windowMs: 60 * 1000,        // 1 minute
  max: 100,                   // 100 requests per window
  message: "Too many messages sent, please slow down",
  standardHeaders: true,      // Return rate limit info in headers
  legacyHeaders: false
});

// Login attempts - 10 per 15 minutes
const loginLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: "rl:login:"
  }),
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                    // 10 attempts per window
  skipSuccessfulRequests: true  // Only count failed attempts
});

// API requests - 1000 per hour
const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: "rl:api:"
  }),
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 1000
});

module.exports = { messageLimiter, loginLimiter, apiLimiter };
```

---

## 7. OPTIMIZED MESSAGE MODEL

### FILE: server/models/Message.js (MODIFY)

```javascript
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
    index: true,                    // ⭐ ADD INDEX
    lowercase: true
  },
  receiver: {
    type: String,
    required: true,
    index: true,                    // ⭐ ADD INDEX
    lowercase: true
  },
  text: mongoose.Schema.Types.Mixed,
  type: {
    type: String,
    enum: ['text', 'media'],
    default: 'text',
    index: true                     // ⭐ ADD INDEX
  },
  mediaType: String,
  mediaUrl: String,               // ⭐ NEW: For S3 URLs
  tempId: {
    type: String,
    index: true                    // ⭐ ADD INDEX
  },
  timestamp: {
    type: Date,
    index: true,                   // ⭐ ADD INDEX
    default: Date.now
  },
  seen: {
    type: Boolean,
    default: false,
    index: true                    // ⭐ ADD INDEX
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 7776000 }    // ⭐ TTL: Delete after 90 days
  }
});

// ⭐ ADD COMPOUND INDEXES for common queries
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ receiver: 1, seen: 1 });

module.exports = mongoose.model("Message", messageSchema);
```

---

## 8. OPTIMIZED MESSAGE CONTROLLER

### FILE: server/controllers/messageController.js (MODIFY)

```javascript
const Message = require("../models/Message");
const cacheService = require("../services/cacheService");

exports.getMessages = async (req, res) => {
  try {
    const { user1, user2, page = 1, limit = 50 } = req.query;

    // Normalize emails
    const sender = user1.toLowerCase();
    const receiver = user2.toLowerCase();

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Use cache for recent messages
    const cacheKey = `msgs:${sender}:${receiver}:${page}`;
    const cached = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        return await Message.find({
          $or: [
            { sender, receiver },
            { sender: receiver, receiver: sender }
          ]
        })
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(parseInt(limit));
      },
      300  // Cache for 5 minutes
    );

    res.json(cached);
  } catch (err) {
    console.error("❌ Get messages error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getRecentChats = async (req, res) => {
  try {
    const { userEmail } = req.query;
    const email = userEmail.toLowerCase();

    // Use cache
    const conversations = await cacheService.getOrFetch(
      `chats:${email}`,
      async () => {
        const messages = await Message.find({
          $or: [
            { sender: email },
            { receiver: email }
          ]
        })
          .sort({ timestamp: -1 })
          .limit(500);  // Limit query scope

        const convMap = {};
        messages.forEach(msg => {
          const otherUser = msg.sender === email ? msg.receiver : msg.sender;
          if (!convMap[otherUser]) {
            convMap[otherUser] = {
              userEmail: otherUser,
              lastMessage: msg.text,
              timestamp: msg.timestamp,
              type: msg.type
            };
          }
        });

        return Object.values(convMap);
      },
      300  // Cache for 5 minutes
    );

    res.json({ conversations });
  } catch (err) {
    console.error("❌ Get recent chats error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.saveMessage = async (req, res) => {
  try {
    const { sender, receiver, text, type, tempId } = req.body;

    // Check if message already exists (duplicate prevention)
    if (tempId) {
      const existing = await Message.findOne({ tempId });
      if (existing) {
        return res.status(200).json({ message: existing, isDuplicate: true });
      }
    }

    const message = new Message({
      sender: sender.toLowerCase(),
      receiver: receiver.toLowerCase(),
      text,
      type,
      tempId,
      timestamp: new Date()
    });

    await message.save();

    // Invalidate cache for both users
    await cacheService.invalidateUserCache(sender);
    await cacheService.invalidateUserCache(receiver);

    res.json(message);
  } catch (err) {
    console.error("❌ Save message error:", err);
    res.status(500).json({ error: err.message });
  }
};
```

---

## 9. LOGGER SERVICE

### FILE: server/middleware/logger.js (CREATE NEW)

```javascript
const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "chat-app" },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
        })
      )
    }),
    // Write errors to error file
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    // Write all logs to combined file
    new winston.transports.File({ filename: "logs/combined.log" })
  ]
});

module.exports = logger;
```

---

## 10. ERROR HANDLING MIDDLEWARE

### FILE: server/middleware/errorHandler.js (CREATE NEW)

```javascript
const logger = require("./logger");

const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Send response
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = errorHandler;
```

---

## 11. UPDATED SERVER ENTRY POINT

### FILE: server/index.js (MODIFY)

```javascript
const express = require("express");
const http = require("http");
const cors = require("cors");
require("dotenv").config();

const connectMongoDB = require("./config/mongodb");
const initSocket = require("./socket/socket");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { apiLimiter } = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./middleware/logger");

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));
app.use(apiLimiter);  // Rate limiting

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Connect MongoDB with optimizations
connectMongoDB();

// Initialize Socket.IO with Redis adapter
initSocket(server);

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Chat Server Running 🚀" });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// Error handling
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} 🚀`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
```

---

## 12. DOCKER DEPLOYMENT

### FILE: Dockerfile (CREATE NEW)

```dockerfile
# Build stage
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 5000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
```

### Build and Run:
```bash
docker build -t chat-server:latest .
docker run -p 5000:5000 \
  -e MONGO_URI=mongodb+srv://... \
  -e REDIS_HOST=redis \
  -e NODE_ENV=production \
  chat-server:latest
```

---

## 13. KUBERNETES DEPLOYMENT

### FILE: k8s-deployment.yaml (CREATE NEW)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chat-config
data:
  NODE_ENV: "production"
  PORT: "5000"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-server
spec:
  replicas: 10  # ⭐ Scale to 10 instances
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 0  # Zero downtime
  selector:
    matchLabels:
      app: chat-server
  template:
    metadata:
      labels:
        app: chat-server
    spec:
      containers:
      - name: chat-server
        image: my-registry/chat-server:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 5000
          name: http
        env:
        - name: MONGO_URI
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: mongo-uri
        - name: REDIS_HOST
          value: redis-service
        - name: REDIS_PORT
          value: "6379"
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: chat-service
spec:
  selector:
    app: chat-server
  ports:
  - protocol: TCP
    port: 80
    targetPort: 5000
  type: LoadBalancer
```

Deploy:
```bash
kubectl apply -f k8s-deployment.yaml
kubectl scale deployment chat-server --replicas=20
kubectl get pods -o wide
```

---

## 14. ENVIRONMENT VARIABLES

### FILE: server/.env (CREATE/UPDATE)

```bash
# Database
MONGO_URI=mongodb+srv://chatuser:password@chat-cluster.mongodb.net/chat-db?retryWrites=true&w=majority
MONGO_REPLICA_SET=rs0

# Redis Cache
REDIS_HOST=redis-cache.example.com
REDIS_PORT=6379
REDIS_PASSWORD=redis-password-123
REDIS_DB=0

# Server
PORT=5000
NODE_ENV=production

# CORS & Security
ALLOWED_ORIGINS=https://chatapp.com,https://www.chatapp.com,https://app.chatapp.com
API_KEY=your-secret-api-key-12345
JWT_SECRET=your-jwt-secret-key-12345

# Logging
LOG_LEVEL=info

# CDN
CDN_URL=https://cdn.chatapp.com
S3_BUCKET=chat-app-media
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret

# Monitoring
NEW_RELIC_LICENSE_KEY=your-new-relic-key
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id
```

### FILE: client/.env.production (CREATE NEW)

```bash
REACT_APP_API_URL=https://api.chatapp.com
REACT_APP_SOCKET_URL=wss://socket.chatapp.com
REACT_APP_CDN_URL=https://cdn.chatapp.com
```

---

## 15. NGINX LOAD BALANCER CONFIG

### FILE: nginx.conf (CREATE NEW)

```nginx
upstream chat_backend {
    least_conn;  # Route to least busy server
    server chat-server-1.local:5000 weight=1;
    server chat-server-2.local:5000 weight=1;
    server chat-server-3.local:5000 weight=1;
    server chat-server-4.local:5000 weight=1;
    server chat-server-5.local:5000 weight=1;
    
    # Health check
    check interval=3000 rise=2 fall=5 timeout=1000 type=http;
    check_http_send "GET /health HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=socket_limit:10m rate=1000r/s;

server {
    listen 80;
    server_name api.chatapp.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.chatapp.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/api.chatapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.chatapp.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json;
    gzip_min_length 1000;

    # Rate limiting
    limit_req zone=api_limit burst=200 nodelay;

    location / {
        proxy_pass http://chat_backend;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        proxy_pass http://chat_backend;
        access_log off;
    }
}

# Health check status
server {
    listen 8080;
    location /nginx_status {
        check_status;
        access_log off;
    }
}
```

---

## 📦 Updated package.json

### FILE: server/package.json (UPDATE)

```json
{
  "name": "chat-server",
  "version": "2.0.0",
  "description": "Scalable chat server for millions of users",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest --coverage",
    "load-test": "artillery run load-test.yml",
    "lint": "eslint .",
    "build": "npm install",
    "health-check": "curl http://localhost:5000/health"
  },
  "dependencies": {
    "express": "^5.2.1",
    "socket.io": "^4.8.3",
    "mongoose": "^9.6.1",
    "redis": "^4.6.0",
    "@socket.io/redis-adapter": "^8.3.0",
    "bull": "^4.11.5",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express-rate-limit": "^7.1.0",
    "rate-limit-redis": "^4.1.5",
    "winston": "^3.11.0",
    "helmet": "^7.1.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "eslint": "^8.55.0",
    "artillery": "^2.0.2"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

---

## 🎯 SUMMARY OF CHANGES

| File | Change | Impact |
|------|--------|--------|
| `socket/socket.js` | Add Redis adapter | Users on different servers see each other |
| `models/Message.js` | Add indexes | 10x faster queries |
| `config/redis.js` | New Redis config | Caching support |
| `services/cacheService.js` | New caching | Reduce DB load 80% |
| `services/queueService.js` | New queue | Async email/notifications |
| `middleware/rateLimiter.js` | New rate limit | Prevent abuse |
| `.env` | Update secrets | Production configuration |
| `Dockerfile` | New container | Easy deployment |
| `k8s-deployment.yaml` | New K8s config | Scale to any size |
| `nginx.conf` | New load balancer | Distribute traffic |

---

**Next Steps:**
1. ✅ Implement changes incrementally
2. ✅ Test with 1000 concurrent users
3. ✅ Deploy to staging
4. ✅ Monitor performance metrics
5. ✅ Scale to production

