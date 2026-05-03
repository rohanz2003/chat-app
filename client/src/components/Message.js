import React from "react";
import { format } from "date-fns";

function Message({ msg, currentUser }) {
  const messageTime = msg.timestamp ? format(new Date(msg.timestamp), "p") : ""; // 'p' for short time, e.g., 4:59 PM

  return (
    <div className={`message ${msg.sender === currentUser ? "sent" : "received"}`}>
      <div className="message-content">{msg.text}</div>
      <div className="message-details">
        <span className="message-time">{messageTime}</span>
        {msg.sender === currentUser && (
          <span className="message-status">
            {msg.seen ? "✓✓" : "✓"}
          </span>
        )}
      </div>
    </div>
  );
}

export default Message;