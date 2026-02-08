import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

// Pages
import Login from "./Login";
import Home from "./Home";
import Register from "./Register";
import SeatingPage from "./SeatingPage";
import CheckInPage from "./CheckInPage";

// 🔒 1. Create the Security Guard Component
function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This listener runs every time the app loads to check if you are logged in
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // While checking, show a simple loading text (or a spinner)
  if (loading) {
    return <div className="text-center mt-5 pt-5">Loading...</div>;
  }

  // ⛔ If no user is found, Kick them back to Login
  if (!user) {
    return <Navigate to="/" />;
  }

  // ✅ If user is found, allow them to see the page
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Route: Login */}
        <Route path="/" element={<Login />} />

        {/* Protected Route: Home */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* Protected Route: Seating Page */}
        <Route
          path="/seats/:eventId"
          element={
            <ProtectedRoute>
              <SeatingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/checkin/:eventId"
          element={
            <ProtectedRoute>
              <CheckInPage />
            </ProtectedRoute>
          }
        />

        {/* Protected Route: Register Admin */}
        <Route
          path="/register"
          element={
            <ProtectedRoute>
              <Register />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
