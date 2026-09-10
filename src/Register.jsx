// src/Register.jsx
import { useState } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import Footer from "./Footer";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // 1. Create User in Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // 2. Set user display name
      await updateProfile(user, { displayName: name });

      // 3. Save User to Firestore with default 'user' role
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: user.email,
        role: "user", // Default role
        createdAt: new Date(),
      });

      setSuccess(true);
      await auth.signOut();
    } catch (err) {
      setError(err.message);
    }
  };

  const [isDarkMode] = useState(() => {
    const saved = localStorage.getItem("login_theme");
    return saved !== null ? saved === "dark" : false;
  });

  if (success) {
    return (
      <div className="min-vh-100 d-flex flex-column justify-content-between">
        <div className="flex-grow-1 d-flex justify-content-center align-items-center p-3">
          <div className="card shadow p-5 text-center" style={{ maxWidth: "450px" }}>
            <h3 className="text-success">Registration Successful!</h3>
            <p className="lead mt-3">
              Welcome, {name}! Your account has been registered with Staff Member access.
            </p>
            <p className="text-muted">You can now log in to access the system.</p>
            <Link to="/" className="btn btn-primary mt-3">
              Go to Login
            </Link>
          </div>
        </div>
        <Footer isDarkMode={isDarkMode} />
      </div>
    );
  }

  return (
    <div className="min-vh-100 d-flex flex-column justify-content-between">
      <div className="flex-grow-1 d-flex justify-content-center align-items-center p-3">
        <div className="card shadow-lg border-0" style={{ width: "450px" }}>
        <div className="card-header bg-dark text-white text-center py-3">
          <h4 className="mb-0">Staff Registration</h4>
        </div>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleRegister}>
            <div className="mb-3">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Alex Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-control"
                placeholder="name@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-4">
              <label className="form-label">Password</label>
              <div className="input-group">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-primary">
                Register Account
              </button>
              <Link to="/" className="btn btn-outline-secondary">
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
      </div>
      <Footer isDarkMode={isDarkMode} />
    </div>
  );
}

export default Register;
