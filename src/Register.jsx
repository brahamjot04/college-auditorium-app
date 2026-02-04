// src/Register.jsx
import { useState } from "react";
import { auth, db } from "./firebase"; // Import db
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; // Import Firestore functions
import { useNavigate, Link } from "react-router-dom";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // No navigate here because we don't want to auto-login pending users

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

      // 2. Save User to Firestore with 'pending' status
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        role: "pending", // <--- Key change
        createdAt: new Date(),
      });

      setSuccess(true);
      // Determine if we sign them out immediately so they can't browse
      await auth.signOut();
    } catch (err) {
      setError(err.message);
    }
  };

  if (success) {
    return (
      <div className="container d-flex justify-content-center align-items-center vh-100">
        <div className="card shadow p-5 text-center">
          <h3 className="text-success">Registration Successful!</h3>
          <p className="lead mt-3">
            Your account is pending approval from an administrator.
          </p>
          <p>Please check back later.</p>
          <Link to="/" className="btn btn-primary mt-3">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="card shadow-lg border-0" style={{ width: "450px" }}>
        <div className="card-header bg-dark text-white text-center py-3">
          <h4 className="mb-0">Admin Registration</h4>
        </div>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleRegister}>
            <div className="mb-3">
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-control"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-4">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-success">
                Submit for Approval
              </button>
              <Link to="/" className="btn btn-outline-secondary">
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;
