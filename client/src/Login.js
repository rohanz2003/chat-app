import React, { useState } from "react";
import { auth, googleProvider } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  signInWithPopup 
} from "firebase/auth";
import "./Login.css";

function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const validateGmail = (email) => {
    return email.toLowerCase().endsWith("@gmail.com");
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!validateGmail(email)) {
      setError("Only valid Gmail addresses are allowed.");
      return;
    }

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setMessage("Verification email sent! Please check your Gmail to verify your account before logging in.");
        setIsRegistering(false);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          setError("Please verify your email before logging in. Check your Gmail inbox.");
          await auth.signOut();
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!validateGmail(result.user.email)) {
        setError("Access restricted to Gmail accounts only.");
        await auth.signOut();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login">
      <div className="login-container">
        <h2>{isRegistering ? "Create Account" : "Connect Login"}</h2>
        <p className="subtitle">Secure enterprise messaging for Gmail users</p>
        
        {error && <div className="error-banner">{error}</div>}
        {message && <div className="success-banner">{message}</div>}

        <form onSubmit={handleAuth}>
          <input
            type="email"
            placeholder="Gmail Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">
            {isRegistering ? "Register with Gmail" : "Sign In"}
          </button>
        </form>

        <div className="divider"><span>OR</span></div>

        <button className="google-btn" onClick={handleGoogleLogin}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
          Continue with Google
        </button>

        <p className="toggle-text">
          {isRegistering ? "Already have a verified account?" : "Need a secure account?"}{" "}
          <span onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "Login here" : "Register now"}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;