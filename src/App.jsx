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
import Register from "./Register";
import SeatingPage from "./SeatingPage";
import CheckInPage from "./CheckInPage";
import AddUserPage from "./AddUserPage";

// 🔒 Security Guard Component
function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, isAdmin, isUser, loading } = useAuth();

  if (loading) {
    return <div className="text-center mt-5 pt-5">Loading...</div>;
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

          {/* Public Route: Self Registration */}
          <Route path="/register" element={<Register />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
