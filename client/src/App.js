import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./components/Login";
import Chat from "./components/Chat";
import Landing from "./components/Landing";

// ✅ Protected Route
const PrivateRoute = ({ children, loading, user }) => {
  if (loading) return <div>Loading Security Session...</div>;
  return user ? children : <Navigate to="/login" />;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const mappedUser = {
          email: currentUser.email,
          profilePic: currentUser.photoURL || localStorage.getItem(`profilePic_${currentUser.email.toLowerCase()}`),
          uid: currentUser.uid
        };
        setUser(mappedUser);
        try {
          localStorage.setItem("user", JSON.stringify(mappedUser));
        } catch (storageError) {
          // If App.js fails to persist, clear some space
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('chatHistory_')) localStorage.removeItem(key);
          });
          console.warn("Storage quota exceeded: Could not persist user session.");
        }
      } else {
        setUser(null);
        localStorage.removeItem("user");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      
      <Route path="/login" element={<Login />} />

      <Route
        path="/chat"
        element={
          <PrivateRoute loading={loading} user={user}>
            <Chat user={user} />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;