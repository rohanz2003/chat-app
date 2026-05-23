import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./components/Login";
import Chat from "./components/Chat";

// ✅ Protected Route
const PrivateRoute = ({ children, loading, user }) => {
  if (loading) return <div>Loading Security Session...</div>;
  return user ? children : <Navigate to="/" />;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Map Firebase user to your application format
        setUser({
          email: currentUser.email,
          profilePic: currentUser.photoURL,
          uid: currentUser.uid
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <Routes>
      <Route path="/" element={!user ? <Login /> : <Navigate to="/chat" />} />

      <Route
        path="/chat"
        element={
          <PrivateRoute loading={loading} user={user}>
            <Chat />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;