import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // To show spinner while checking
  const navigate = useNavigate();

  // 1. Auto-redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // We could double-check role here, but ProtectedRoute handles the rest
        navigate("/home");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // 2. Handle Login Logic
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Step A: Authenticate with Email/Password
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // Step B: Check Firestore for "Pending" status
      // We wrap this in a try/catch so if the DB is down, we don't just crash
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === "pending") {
            await signOut(auth); // Immediately kick them out
            setError("Access Denied: Your account is still pending approval.");
            setLoading(false);
            return;
          }
        }
      } catch (dbError) {
        console.error("Database check failed:", dbError);
        // Optional: Decide if you want to let them in or block them on DB error
        // For now, we continue to Home
      }

      // Step C: Success! Navigate to Home
      navigate("/home");
    } catch (err) {
      console.error(err);
      // specific error messages for better UX
      if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else {
        setError("Login failed: " + err.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow-lg border-0" style={{ width: "400px" }}>
        <div className="card-header bg-primary text-white text-center py-3">
          <h4 className="mb-0 fw-bold">Auditorium Admin</h4>
        </div>

        <div className="card-body p-4">
          {error && (
            <div className="alert alert-danger text-center" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-semibold">Email Address</label>
              <input
                type="email"
                className="form-control form-control-lg"
                placeholder="name@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold">Password</label>
              <input
                type="password"
                className="form-control form-control-lg"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="d-grid gap-2">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
              >
                {loading ? "Checking Access..." : "Login"}
              </button>
            </div>
          </form>

          <hr className="my-4" />

          <div className="text-center">
            <p className="mb-2 text-muted small">New staff member?</p>
            <Link to="/register" className="btn btn-outline-secondary btn-sm">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
