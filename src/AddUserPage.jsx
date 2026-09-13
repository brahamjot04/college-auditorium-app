import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getFirestore } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useAuth } from "./AuthContext";
import Navbar from "./Navbar";
import Footer from "./Footer";
import CustomSelect from "./CustomSelect";

function AddUserPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState("user");
  const [error, setError] = useState("");

  const roleOptions = [
    {
      value: "user",
      label: "Staff Member (Gate Check-In & Seat Booking only)",
      description: "Gate check-in & seat booking access",
      icon: "👤",
    },
    {
      value: "admin",
      label: "Administrator (Full Event & Member Management)",
      description: "Full event control, member promotions & seat blocking",
      icon: "🛡️",
    },
  ];
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Theme state synced with other pages (defaults to light)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("login_theme");
    return saved !== null ? saved === "dark" : false;
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("login_theme", next ? "dark" : "light");
      return next;
    });
  };

  const theme = {
    bg: isDarkMode
      ? "radial-gradient(ellipse at 50% 0%, rgba(30, 58, 138, 0.28) 0%, transparent 65%), linear-gradient(135deg, #070c18 0%, #0d1527 45%, #152238 100%)"
      : "radial-gradient(ellipse at 50% 0%, rgba(191, 219, 254, 0.5) 0%, transparent 65%), linear-gradient(135deg, #dbeafe 0%, #e0e7ff 50%, #e2e8f0 100%)",
    cardBg: isDarkMode ? "rgba(15, 23, 42, 0.75)" : "rgba(255, 255, 255, 0.85)",
    cardBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(255, 255, 255, 0.85)",
    cardShadow: isDarkMode
      ? "0 22px 50px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)"
      : "0 20px 45px -10px rgba(30, 58, 138, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.7)",
    textPrimary: isDarkMode ? "#f8fafc" : "#0f172a",
    textSecondary: isDarkMode ? "#94a3b8" : "#64748b",
    inputBg: isDarkMode ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.9)",
    inputBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.85)",
    inputText: isDarkMode ? "#f8fafc" : "#0f172a",
    inputPlaceholder: isDarkMode ? "#94a3b8" : "#64748b",
    pillBg: isDarkMode
      ? "rgba(30, 41, 59, 0.85)"
      : "rgba(255, 255, 255, 0.85)",
    pillBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.8)",
    pillShadow: isDarkMode
      ? "0 10px 25px rgba(0, 0, 0, 0.5)"
      : "0 10px 25px rgba(30, 58, 138, 0.1)",
    pillText: isDarkMode ? "#f8fafc" : "#1e293b",
  };

  if (loading) {
    return (
      <div
        style={{
          background: theme.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.textPrimary,
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ background: theme.bg, minHeight: "100vh" }}>
        <Navbar isDarkMode={isDarkMode} />
        <div className="container py-5 text-center">
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: isDarkMode ? "#fca5a5" : "#991b1b",
              borderRadius: "18px",
              padding: "32px 24px",
              maxWidth: "500px",
              margin: "0 auto",
            }}
          >
            <h4 style={{ fontWeight: 700, marginBottom: "8px" }}>
              Access Denied
            </h4>
            <p style={{ fontSize: "0.9rem", marginBottom: "18px" }}>
              Only administrators can access the member provisioning panel.
            </p>
            <Link
              to="/home"
              style={{
                background: "#2563eb",
                color: "#ffffff",
                padding: "10px 20px",
                borderRadius: "12px",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.88rem",
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      // Secondary app ensures logged in admin session is NEVER signed out
      const secondaryAppName = "SecondaryApp";
      const secondaryApp =
        getApps().find((app) => app.name === secondaryAppName) ||
        initializeApp(auth.app.options, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      let newUser = null;
      try {
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password,
        );
        newUser = userCredential.user;
      } catch (authErr) {
        if (authErr.code === "auth/email-already-in-use") {
          try {
            const userCredential = await signInWithEmailAndPassword(
              secondaryAuth,
              email,
              password,
            );
            newUser = userCredential.user;
          } catch {
            throw new Error(
              "This email already exists in Firebase Auth. Please verify the credentials or use a different email address.",
            );
          }
        } else {
          throw authErr;
        }
      }

      if (name) {
        try {
          await updateProfile(newUser, { displayName: name });
        } catch {
          // Non-blocking
        }
      }

      const secondaryDb = getFirestore(secondaryApp);
      try {
        await setDoc(doc(db, "users", newUser.uid), {
          name: name,
          email: newUser.email,
          role: selectedRole,
          createdAt: new Date(),
        });
      } catch (primaryErr) {
        console.warn("Writing via primary db failed, falling back to secondaryDb:", primaryErr);
        await setDoc(doc(secondaryDb, "users", newUser.uid), {
          name: name,
          email: newUser.email,
          role: selectedRole,
          createdAt: new Date(),
        });
      }

      await signOut(secondaryAuth);

      setSuccess(
        `Account successfully created for ${name} (${email}) with role "${selectedRole === "admin" ? "Administrator" : "Staff Member"}".`,
      );
      setName("");
      setEmail("");
      setPassword("");
      setSelectedRole("user");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters long.");
      } else {
        setError(err.message || "Failed to create account.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: theme.bg,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: theme.textPrimary,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        transition: "background 0.4s ease, color 0.4s ease",
      }}
    >
      {/* Dynamic Placeholder Styling */}
      <style>{`
        .add-input::placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
        .add-input::-webkit-input-placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
      `}</style>

      {/* TOP BAR WITH BRANDING, USER ROLE, MANAGE STAFF & LOGOUT CONFIRMATION */}
      <Navbar isDarkMode={isDarkMode} />

      {/* MAIN CONTAINER */}
      <main className="container py-5 flex-grow-1">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            {/* Header Navigation Link */}
            <div className="d-flex align-items-center mb-4">
              <button
                type="button"
                onClick={() => navigate("/home")}
                style={{
                  background: isDarkMode
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(255, 255, 255, 0.9)",
                  border: theme.inputBorder,
                  color: theme.textPrimary,
                  borderRadius: "12px",
                  padding: "7px 14px",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginRight: "16px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "#3b82f6")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = isDarkMode
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(203, 213, 225, 0.85)")
                }
              >
                ← Back to Dashboard
              </button>
            </div>

            {/* Glassmorphic Form Card */}
            <div
              style={{
                background: theme.cardBg,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: theme.cardBorder,
                borderRadius: "24px",
                padding: "36px 32px",
                boxShadow: theme.cardShadow,
              }}
            >
              <div className="mb-4 text-center">
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    background: isDarkMode
                      ? "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)"
                      : "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "14px",
                    boxShadow: isDarkMode
                      ? "0 8px 20px rgba(59, 130, 246, 0.35)"
                      : "0 8px 18px rgba(37, 99, 235, 0.25)",
                  }}
                >
                  <span style={{ fontSize: "1.6rem" }}>👤</span>
                </div>
                <h3
                  style={{
                    fontWeight: 700,
                    letterSpacing: "-0.4px",
                    color: theme.textPrimary,
                    marginBottom: "4px",
                    fontSize: "1.45rem",
                  }}
                >
                  Add Staff / Administrator
                </h3>
                <p
                  style={{
                    color: theme.textSecondary,
                    fontSize: "0.86rem",
                    margin: 0,
                  }}
                >
                  Provision authorized credentials for the auditorium system
                </p>
              </div>

              {/* Status Alerts */}
              {error && (
                <div
                  style={{
                    background: isDarkMode
                      ? "rgba(239, 68, 68, 0.16)"
                      : "rgba(239, 68, 68, 0.1)",
                    border: isDarkMode
                      ? "1px solid rgba(239, 68, 68, 0.35)"
                      : "1px solid rgba(239, 68, 68, 0.25)",
                    color: isDarkMode ? "#fca5a5" : "#991b1b",
                    borderRadius: "14px",
                    padding: "12px 16px",
                    fontSize: "0.86rem",
                    marginBottom: "20px",
                    textAlign: "center",
                  }}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  style={{
                    background: isDarkMode
                      ? "rgba(16, 185, 129, 0.16)"
                      : "rgba(16, 185, 129, 0.12)",
                    border: isDarkMode
                      ? "1px solid rgba(16, 185, 129, 0.35)"
                      : "1px solid rgba(16, 185, 129, 0.3)",
                    color: isDarkMode ? "#6ee7b7" : "#065f46",
                    borderRadius: "14px",
                    padding: "12px 16px",
                    fontSize: "0.86rem",
                    marginBottom: "20px",
                    textAlign: "center",
                  }}
                >
                  {success}
                </div>
              )}

              {/* Provisioning Form */}
              <form onSubmit={handleAddUser}>
                {/* Full Name */}
                <div className="mb-3">
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      color: theme.textPrimary,
                    }}
                  >
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="form-control add-input"
                    placeholder="e.g. Manpreet Singh"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      background: theme.inputBg,
                      border: theme.inputBorder,
                      color: theme.inputText,
                      borderRadius: "14px",
                      padding: "11px 14px",
                      fontSize: "0.92rem",
                      boxShadow: "none",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Email Address */}
                <div className="mb-3">
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      color: theme.textPrimary,
                    }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control add-input"
                    placeholder="staff@gndec.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      background: theme.inputBg,
                      border: theme.inputBorder,
                      color: theme.inputText,
                      borderRadius: "14px",
                      padding: "11px 14px",
                      fontSize: "0.92rem",
                      boxShadow: "none",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Temporary Password */}
                <div className="mb-3">
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      color: theme.textPrimary,
                    }}
                  >
                    Temporary Password
                  </label>
                  <div
                    className="input-group"
                    style={{
                      background: theme.inputBg,
                      border: theme.inputBorder,
                      borderRadius: "14px",
                      overflow: "hidden",
                    }}
                  >
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control border-0 add-input"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{
                        background: "transparent",
                        color: theme.inputText,
                        padding: "11px 14px",
                        fontSize: "0.92rem",
                        boxShadow: "none",
                      }}
                    />
                    <button
                      type="button"
                      className="btn border-0"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Hide password" : "Show password"}
                      style={{
                        background: "transparent",
                        color: theme.textSecondary,
                        fontSize: "1.05rem",
                        padding: "0 14px",
                      }}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                {/* Role Selection */}
                <div className="mb-4">
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      color: theme.textPrimary,
                    }}
                  >
                    System Role & Permissions
                  </label>
                  <CustomSelect
                    id="system-role-select"
                    value={selectedRole}
                    onChange={(val) => setSelectedRole(val)}
                    options={roleOptions}
                    isDarkMode={isDarkMode}
                  />

                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: theme.textSecondary,
                      marginTop: "8px",
                      lineHeight: "1.4",
                    }}
                  >
                    {selectedRole === "user"
                      ? "Staff users can scan and check in attendees at the gate and book available seats, but cannot edit/delete events."
                      : "Administrators have full event control, member promotion, seat range blocking, and audit access."}
                  </div>
                  <div
                    style={{
                      fontSize: "0.76rem",
                      color: isDarkMode ? "#93c5fd" : "#2563eb",
                      marginTop: "6px",
                      fontStyle: "italic",
                    }}
                  >
                    ℹ️ Note: Super Admin permissions are strictly assigned via the Firebase Console.
                  </div>
                </div>

                {/* Submit Controls */}
                <div className="d-grid gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      background: isDarkMode
                        ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                        : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                      boxShadow: isDarkMode
                        ? "0 8px 20px rgba(37, 99, 235, 0.35)"
                        : "0 8px 18px rgba(37, 99, 235, 0.22)",
                      border: "none",
                      color: "#ffffff",
                      borderRadius: "14px",
                      padding: "12px",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow =
                          "0 10px 24px rgba(37, 99, 235, 0.45)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = isDarkMode
                        ? "0 8px 20px rgba(37, 99, 235, 0.35)"
                        : "0 8px 18px rgba(37, 99, 235, 0.22)";
                    }}
                  >
                    {isSubmitting ? "Creating Account..." : "➕ Create Member Account"}
                  </button>
                  <Link
                    to="/home"
                    style={{
                      textAlign: "center",
                      color: theme.textSecondary,
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      padding: "8px",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = theme.textPrimary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = theme.textSecondary)
                    }
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <Footer isDarkMode={isDarkMode} />

      {/* Floating Theme Switcher */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 1050,
        }}
      >
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark and light theme"
          style={{
            background: theme.pillBg,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: theme.pillBorder,
            boxShadow: theme.pillShadow,
            borderRadius: "50px",
            padding: "9px 16px",
            color: theme.pillText,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.84rem",
            transition: "all 0.25s ease",
          }}
        >
          <span style={{ fontSize: "1.05rem" }}>
            {isDarkMode ? "☀️" : "🌙"}
          </span>
          <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>
    </div>
  );
}

export default AddUserPage;
