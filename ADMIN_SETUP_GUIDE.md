# 🔐 Admin Dashboard Setup Guide

## Overview
The Admin Dashboard allows you to manage and monitor all chat system data including messages, feedback, and user profiles with professional styling and secure authentication.

## Features
- ✅ **Secure Authentication** - Token-based access control
- 📊 **Dashboard Statistics** - View total messages, feedback, users, and ratings
- 💬 **Message Management** - Browse all chat messages with sender/receiver info
- ⭐ **Feedback Review** - View all user feedback with ratings
- 👥 **User Management** - See all registered users and their activity
- 📈 **Analytics** - Top message senders statistics
- 🎨 **Professional Styling** - Modern UI with responsive design

## Setup Instructions

### 1. Backend Setup

#### Step 1: Configure Environment Variable
Add the following to your `.env` file in the server directory:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
ADMIN_TOKEN=your_secure_admin_token_here
```

**IMPORTANT:** Replace `your_secure_admin_token_here` with a strong, random token. Example:
```
ADMIN_TOKEN=admin_secure_token_2024_xyz789abc123
```

You can generate a secure token using:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Step 2: Verify Backend Routes
The following admin routes are now available:

- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/messages` - All messages
- `GET /api/admin/feedback` - All feedback
- `GET /api/admin/users` - All users
- `GET /api/admin/message-stats` - Top message senders

All routes require the `Authorization: Bearer {ADMIN_TOKEN}` header.

### 2. Frontend Setup

#### Step 1: Create Admin Component
The Admin component is already created at:
- Component: `client/src/components/Admin.js`
- Styles: `client/src/styles/Admin.css`

#### Step 2: Update App Routes
The admin route is already added to `client/src/App.js`:
```javascript
<Route path="/admin" element={<Admin />} />
```

#### Step 3: Configure API URL (Optional)
If your API is hosted on a different domain, set the `REACT_APP_API_URL` environment variable:

```env
# In client/.env
REACT_APP_API_URL=https://your-api-domain.com
```

Default: `http://localhost:5000`

### 3. Running the Application

#### Start Backend Server
```bash
cd server
npm start
```

#### Start Frontend Client
```bash
cd client
npm start
```

#### Access Admin Dashboard
1. Open browser and navigate to: `http://localhost:3000/admin`
2. Or click the hidden admin link (🔐) at the bottom right of the landing page
3. Enter your admin token (the one you set in `.env`)
4. You'll be redirected to the dashboard if token is valid

## Security Features

### 🔒 Authentication
- **Token-Based**: Uses a strong admin token for verification
- **localStorage**: Admin token is saved locally for session persistence
- **Automatic Logout**: Use the logout button to clear the session

### 🛡️ Data Protection
- All admin endpoints require authentication
- Middleware validates token on every request
- API returns 401 Unauthorized for invalid tokens

### 📝 Best Practices
1. **Change Token Regularly**: Rotate your admin token periodically
2. **Use HTTPS**: Always use HTTPS in production
3. **Secure Storage**: Store your token securely, never commit to git
4. **Strong Token**: Use a randomly generated strong token

## Admin Dashboard Tabs

### 📊 Dashboard Tab
Shows overview statistics:
- Total Messages count
- Total Feedback count
- Total Users count
- Average User Rating
- Top 10 Message Senders

### 💬 Messages Tab
Browse all messages with:
- Sender email
- Receiver email
- Message content
- Message type (text/media)
- Timestamp

### ⭐ Feedback Tab
View user feedback with:
- User name
- Email address
- Feedback message
- Rating (1-5 stars)
- Submission date

### 👥 Users Tab
Manage registered users:
- Email address
- Avatar/Profile picture
- Last seen timestamp
- User activity tracking

## API Response Examples

### GET /api/admin/stats
```json
{
  "totalMessages": 1250,
  "totalFeedback": 45,
  "totalUsers": 120,
  "averageRating": "4.5"
}
```

### GET /api/admin/messages
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "sender": "user1@gmail.com",
    "receiver": "user2@gmail.com",
    "text": "Hello, how are you?",
    "type": "text",
    "timestamp": "2024-01-15T10:30:00Z",
    "seen": true
  }
]
```

### GET /api/admin/feedback
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "name": "John Doe",
    "email": "john@gmail.com",
    "message": "Great app, very user-friendly!",
    "rating": 5,
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### GET /api/admin/users
```json
[
  {
    "_id": "507f1f77bcf86cd799439013",
    "email": "user@gmail.com",
    "avatarUrl": "https://example.com/avatar.jpg",
    "lastSeen": "2024-01-15T10:30:00Z"
  }
]
```

## Troubleshooting

### Issue: "Unauthorized: Invalid or missing admin token"
**Solution**: 
- Check that your token matches exactly in `.env`
- Make sure you're sending it in the Authorization header: `Bearer {token}`
- Clear browser cache and try again

### Issue: Admin page shows "Loading Security Session..."
**Solution**:
- Wait for the authentication check to complete
- Check browser console for errors
- Verify ADMIN_TOKEN is set in server `.env`

### Issue: Cannot fetch dashboard data
**Solution**:
- Verify backend server is running on `http://localhost:5000`
- Check network tab in browser DevTools
- Ensure CORS is enabled in server
- If using custom API URL, verify it's set correctly

### Issue: Admin token not saving to localStorage
**Solution**:
- Check if localStorage is available and not blocked
- Try clearing browser cache
- Check for storage quota issues
- Try in a different browser

## Production Deployment

### 1. Environment Setup
Create a strong admin token for production:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Backend Deployment
```bash
# Set environment variables on your hosting platform
MONGO_URI=your_production_mongodb_uri
ADMIN_TOKEN=your_production_admin_token
PORT=your_port
NODE_ENV=production
```

### 3. Frontend Deployment
```bash
# Build the frontend
npm run build

# Set environment variable
REACT_APP_API_URL=https://your-production-api-domain.com
```

### 4. HTTPS Configuration
- Always use HTTPS in production
- Install SSL certificate on your domain
- Update API URL to use HTTPS

## Files Modified/Created

### Backend Files
- ✅ `/server/middleware/adminAuth.js` - Admin authentication middleware
- ✅ `/server/controllers/adminController.js` - Admin controller with data fetching
- ✅ `/server/routes/adminRoutes.js` - Admin API routes
- ✅ `/server/index.js` - Updated to include admin routes

### Frontend Files
- ✅ `/client/src/components/Admin.js` - Main admin dashboard component
- ✅ `/client/src/styles/Admin.css` - Professional styling
- ✅ `/client/src/App.js` - Updated with admin route
- ✅ `/client/src/components/Landing.js` - Added hidden admin link

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review the API response examples
3. Check browser DevTools console for errors
4. Verify all environment variables are set correctly

## Next Steps

1. Set your admin token in `.env`
2. Restart both backend and frontend servers
3. Navigate to `/admin` page
4. Login with your admin token
5. Explore the dashboard!

---

**Last Updated**: June 2024
**Version**: 1.0.0
