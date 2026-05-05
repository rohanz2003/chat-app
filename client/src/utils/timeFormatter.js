export const formatLastSeen = (time) => {
  if (!time) return "";
  const date = new Date(time);
  return "Last seen at " + date.toLocaleTimeString();
};

export const formatMessageTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now - date) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    // Today: show time like "2:30 PM"
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 48) {
    // Yesterday: show "Yesterday 2:30 PM"
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    // Older: show date and time like "Dec 25, 2:30 PM"
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
           ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};