import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";

// Pages
import Login from "./Login";
import Home from "./Home";
import NotFound from "./NotFound";
import SeatingPage from "./SeatingPage";
import CheckInPage from "./CheckInPage";
import AddUserPage from "./AddUserPage";

function RouteLoader() {
  const isDarkMode = localStorage.getItem("login_theme") === "dark";
  return (
    <div
      style={{
        minHeight: "100vh",
        background: isDarkMode
          ? "linear-gradient(135deg, #070c18 0%, #0d1527 50%, #152238 100%)"
          : "linear-gradient(135deg, #eef2ff 0%, #f0f7ff 50%, #e0e7ff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: isDarkMode ? "#f8fafc" : "#0f172a",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "46px",
          height: "46px",
          borderRadius: "50%",
          border: isDarkMode
            ? "3px solid rgba(59, 130, 246, 0.2)"
            : "3px solid rgba(37, 99, 235, 0.15)",
          borderTopColor: isDarkMode ? "#60a5fa" : "#2563eb",
          animation: "auth-spin 0.85s linear infinite",
          marginBottom: "16px",
        }}
      />
      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
        Auditorium Management Portal
      </div>
      <div
        style={{
          fontSize: "0.8rem",
          color: isDarkMode ? "#94a3b8" : "#64748b",
          marginTop: "4px",
        }}
      >
        Verifying authorization...
      </div>
      <style>{`@keyframes auth-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// 🔒 Security Guard Component
function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, isAdmin, isUser, loading } = useAuth();

  if (loading) {
    return <RouteLoader />;
  }

  // If no user is logged in (e.g. clean logout or visiting /home while logged out)
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // If user is logged in, but account has no approved permissions (neither admin nor staff)
  if (!isAdmin && !isUser) {
    return <Navigate to="/?error=unauthorized" replace />;
  }

  // If admin permission is required but user is not admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
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

          {/* Protected Route: Check In Page */}
          <Route
            path="/checkin/:eventId"
            element={
              <ProtectedRoute>
                <CheckInPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Route: Add Admin / Member (Admin only) */}
          <Route
            path="/add-user"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AddUserPage />
              </ProtectedRoute>
            }
          />

          {/* 404 Catch-All Route (Handles /register and any invalid paths) */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
