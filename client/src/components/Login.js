import React, { useState } from "react";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [previewPic, setPreviewPic] = useState(null);

  const navigate = useNavigate();

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert("Please select an image file");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result);
        setPreviewPic(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      alert("Please fill all fields");
      return;
    }

    if (!isLogin && !profilePic) {
      alert("Please select a profile picture");
      return;
    }

    setLoading(true);

    try {
      let userCredential;

      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }

      // ✅ Get logged-in user
      const user = userCredential.user;

      // ✅ Save to localStorage (IMPORTANT)
      localStorage.setItem(
        "user",
        JSON.stringify({
          email: user.email,
          uid: user.uid,
          profilePic: profilePic || null
        })
      );

      // ✅ Redirect to chat
      navigate("/chat");

    } catch (err) {
      alert(err.message);
    }

    setLoading(false);
  };

  return (
    <div className="login">
      <div className="login-container">
        <h2>{isLogin ? "💬 Login" : "👤 Create Account"}</h2>

        <input
          type="email"
          placeholder="Enter Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Enter Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {!isLogin && (
          <>
            <div className="profile-pic-section">
              <label htmlFor="profilePic" className="profile-pic-label">
                {previewPic ? (
                  <img src={previewPic} alt="Profile" className="profile-pic-preview" />
                ) : (
                  <div className="profile-pic-placeholder">
                    📸 Click to Upload Profile Picture
                  </div>
                )}
              </label>
              <input
                id="profilePic"
                type="file"
                accept="image/*"
                onChange={handleProfilePicChange}
                style={{ display: 'none' }}
              />
            </div>
            <p className="pic-info">Upload a profile picture (JPG, PNG, max 5MB)</p>
          </>
        )}

        <button onClick={handleAuth} disabled={loading}>
          {loading ? "Please wait..." : isLogin ? "Login" : "Sign Up"}
        </button>

        <p
          style={{ marginTop: "10px", cursor: "pointer", color: "#1e88e5" }}
          onClick={() => {
            setIsLogin(!isLogin);
            setProfilePic(null);
            setPreviewPic(null);
          }}
        >
          {isLogin
            ? "Don't have an account? Sign Up"
            : "Already have an account? Login"}
        </p>
      </div>
    </div>
  );
}

export default Login;