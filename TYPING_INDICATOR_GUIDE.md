# Typing Indicator - Complete Implementation Guide

## How It Works

### Architecture Flow

```
Client A (typing)
    ↓
Emits: socket.emit("typing", {from: "user_a@email.com", to: "user_b@email.com"})
    ↓
Server receives and validates
    ↓
Server broadcasts: io.to("user_b@email.com").emit("typing", {from: "user_a@email.com"})
    ↓
Client B joins room "user_b@email.com" on login
    ↓
Client B receives event and sets typingUser state
    ↓
TypingIndicator renders animation
```

## Key Components

### 1. Server: `server/socket/typing.js`
- **Receives**: `typing` event with `{from, to}` payload
- **Validates**: Checks if both emails are provided
- **Broadcasts**: Sends to personal room of target user (named after their email)
- **Logs**: Detailed logging for debugging

### 2. Client: `client/src/components/Chat.js`
- **handleTyping()**: Emits typing event when user types
- **Socket listeners**: Receive and process typing/stop-typing events
- **typingUser state**: Tracks who is typing
- **stopTyping()**: Sends stop-typing event after 3 seconds of inactivity

### 3. Client: `client/src/components/TypingIndicator.js`
- Basic component that renders typing animation (currently not used - inline in Chat.js)

## Debugging Steps

### Check 1: Browser Console Logs

When typing, you should see in **Client A's console**:
```
📤 Emitting typing: {from: "user_a@email.com", to: "user_b@email.com"}
```

When Client B receives:
```
📨 Typing listener triggered: from=user_a@email.com, activeChat=user_a@email.com, match=true
✅ Typing indicator set for user_a@email.com
```

### Check 2: Server Console Logs

You should see:
```
📨 Typing event received - from: user_a@email.com, to: user_b@email.com
✅ Target user user_b@email.com online: true
📤 Broadcasting typing from user_a@email.com to room: user_b@email.com
👥 Sockets in room user_b@email.com: [socket_id_1, socket_id_2, ...]
```

### Check 3: Network Tab

In DevTools Network tab, you should see WebSocket messages:
- `typing` message when typing
- `stop-typing` message after 3 seconds of inactivity

## Troubleshooting

### Issue: Typing indicator not showing

**Step 1**: Check if both users are in a chat
```
Console should show:
✅ Socket Connected: [socket_id]
```

**Step 2**: Verify socket connection
```javascript
// In browser console
socket.connected // Should be true
socket.id // Should show a socket ID
```

**Step 3**: Check room membership
```javascript
// Server-side check (in any handler)
io.sockets.adapter.rooms // Shows all rooms and members
```

**Step 4**: Verify email normalization
- Emails are converted to lowercase and trimmed
- Example: "User@EXAMPLE.COM" → "user@example.com"

### Issue: Typing indicator stuck (not clearing)

**Causes**:
1. User switches chat without stopping typing
2. Stop-typing event not received
3. typingUser state not clearing properly

**Solution**: 
- The auto-clear timeout is set to 3 seconds
- Switching chats now sends explicit stop-typing event
- typingUser is cleared when selectedUser changes

### Issue: Typing shows for wrong user

**Check**:
1. Email normalization is working
2. Room membership is correct
3. Socket connections are valid

Run this in browser console:
```javascript
// Check current state
console.log("Current user:", user?.email);
console.log("Selected user:", selectedUser);
console.log("Typing user:", typingUser);
```

## Testing Checklist

- [ ] **Single browser test**:
  - Open same chat in two tabs
  - Type in one tab, see indicator in other
  - Stop typing, indicator clears after 3 seconds

- [ ] **Two browsers test**:
  - Open in two different browsers
  - Log in with different accounts
  - Start conversation and test typing
  - Check console logs match expected flow

- [ ] **Network offline test**:
  - Turn off network in DevTools
  - Try typing - should show socket disconnection warning
  - Turn network back on - should reconnect

- [ ] **Chat switching test**:
  - Type in one chat
  - Switch to another chat
  - Indicator should clear
  - Original chat should see stop-typing event

- [ ] **Rapid typing test**:
  - Type quickly and continuously
  - Indicator should stay active
  - Stop typing, indicator clears after 3 seconds

## Console Output Examples

### Successful Typing Flow

**Sender (Client A)**:
```
📤 Emitting typing: {from: "alice@example.com", to: "bob@example.com"}
```

**Server**:
```
📨 Typing event received - from: alice@example.com, to: bob@example.com
✅ Target user bob@example.com online: true
📤 Broadcasting typing from alice@example.com to room: bob@example.com
👥 Sockets in room bob@example.com: [abc123, def456]
```

**Receiver (Client B)**:
```
📨 Typing listener triggered: from=alice@example.com, activeChat=alice@example.com, match=true
✅ Typing indicator set for alice@example.com
```

### Stop Typing Flow

**Sender (Client A)**:
```
📤 Emitting stop-typing: {from: "alice@example.com", to: "bob@example.com"}
```

**Server**:
```
📨 Stop-typing event received - from: alice@example.com, to: bob@example.com
📤 Broadcasting stop-typing from alice@example.com to room: bob@example.com
```

**Receiver (Client B)**:
```
📨 Stop-typing listener triggered: from=alice@example.com, activeChat=alice@example.com, match=true
✅ Typing indicator cleared
```

## Performance Considerations

1. **Typing events are sent every keystroke**: Up to user's keyboard speed
2. **Auto-clear after 3 seconds**: Prevents stuck indicators
3. **Stop-typing on:** 
   - Empty input
   - 3 second timeout
   - Chat switch
   - Input blur

## CSS Animation

The typing indicator uses CSS keyframe animations:
```css
@keyframes typing-pulse {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-8px);
  }
}
```

Each dot pulses with a 0.2s delay for smooth animation effect.

## Related Files

- Server: `server/socket/typing.js`
- Server: `server/socket/socket.js` (initializes typing handler)
- Server: `server/socket/presence.js` (joins personal rooms)
- Client: `client/src/components/Chat.js` (typing listeners and handlers)
- Client: `client/src/components/TypingIndicator.js` (simple UI component)
- Styles: `client/src/components/Chat.css` (typing-indicator styles)

## Quick Fixes

**Typing not working after deployment?**
1. Check CORS settings in server/socket/socket.js
2. Verify Socket.IO version compatibility
3. Check browser console for errors
4. Review server logs for event reception

**Clear up test data**:
```javascript
// In browser console
localStorage.removeItem("chatHistory_your@email.com");
localStorage.removeItem("unread_your@email.com");
// Reload page
```
