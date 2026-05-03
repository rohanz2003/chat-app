export const formatLastSeen = (time) => {
  if (!time) return "";
  const date = new Date(time);
  return "Last seen at " + date.toLocaleTimeString();
};