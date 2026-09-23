import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";
import Footer from "./Footer";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [error, setError] = useState(() => {
    return searchParams.get("error") === "unauthorized"
      ? "Access Denied: Your account does not have permission to access this system. Please contact an administrator."
      : "";
  });
  const [message, setMessage] = useState(() => {
    return searchParams.get("logged_out") === "true"
      ? "You have been successfully logged out."
      : "";
  });
  const [loading, setLoading] = useState(false);

  // Theme state: defaults to light mode for new visitors, saved in localStorage
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

  // Process redirect result if returning from Google redirect sign-in
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          setLoading(true);
        }
      })
      .catch((err) => {
        console.error("getRedirectResult error:", err);
        if (err.code === "auth/account-exists-with-different-credential") {
          setError(
            "An account already exists with this email using a password. Please sign in with your email and password above, or enable account linking in Firebase Console.",
          );
        } else {
          setError("Google sign-in failed: " + err.message);
        }
      });
  }, []);

  // 1. Auto-redirect if already logged in AND strictly authorized
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          let userData = userDoc.exists() ? userDoc.data() : null;

          if (!userData) {
            try {
              const q = query(
                collection(db, "users"),
                where("email", "==", user.email),
              );
              const snap = await getDocs(q);
              if (!snap.empty) {
                userData = snap.docs[0].data();
                try {
                  await setDoc(userDocRef, {
                    ...userData,
                    name:
                      userData.name ||
                      user.displayName ||
                      user.email.split("@")[0],
                  });
                } catch {
                  // Non-blocking
                }
              }
            } catch {
              // Non-admin users cannot query users collection under standard security rules
            }
          }

          // ONLY redirect if user has an active superadmin, admin, or user role
          const isRoleApproved =
            userData &&
            ["superadmin", "admin", "user"].includes(userData.role);

          if (isRoleApproved) {
            navigate("/home");
          } else {
            // User does not have permissions -> force sign out and show error
            await signOut(auth);
            if (userData?.role === "pending") {
              setError("Access Denied: Your account is still pending approval.");
            } else if (userData?.role === "revoked") {
              setError("Access Denied: Your account access has been revoked.");
            } else {
              setError(
                "Access Denied: Your account does not have permission to access this system. Please contact an administrator.",
              );
            }
          }
        } catch (err) {
          console.error("Permission check failed:", err);
          await signOut(auth);
          setError(
            "Access Denied: Your account does not have permission to access this system. Please contact an administrator.",
          );
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // 2. Handle Password Setup / Reset
  const handleResetPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError(
        "Please enter your email address in the field above first to set or reset your password.",
      );
      setMessage("");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setMessage(
        `A password setup email has been sent to ${cleanEmail}. Check your inbox!`,
      );
      setError("");
    } catch (err) {
      console.error("Password reset error:", err);
      setError("Failed to send password setup email: " + err.message);
      setMessage("");
    }
  };

  // 3. Handle Login Logic (Email / Password)
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      // Step A: Authenticate with Email/Password
      const cleanEmail = email.trim();
      const userCredential = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );
      const user = userCredential.user;

      // Step B: Check Firestore for valid role
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      let userData = userDoc.exists() ? userDoc.data() : null;

      if (!userData) {
        try {
          const q = query(
            collection(db, "users"),
            where("email", "==", user.email),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            userData = snap.docs[0].data();
            await setDoc(userDocRef, {
              ...userData,
              name:
                userData.name || user.displayName || user.email.split("@")[0],
            });
          }
        } catch {
          // Fallback query might be restricted by rules
        }
      }

      // STRICT PERMISSION CHECK: Must be superadmin, admin, or user
      const isRoleApproved =
        userData && ["superadmin", "admin", "user"].includes(userData.role);

      if (!isRoleApproved) {
        await signOut(auth);
        if (userData?.role === "pending") {
          setError("Access Denied: Your account is still pending approval.");
        } else if (userData?.role === "revoked") {
          setError("Access Denied: Your account access has been revoked.");
        } else {
          setError(
            "Access Denied: Your account does not have permission to access this system. Please contact an administrator.",
          );
        }
        setLoading(false);
        return;
      }

      // Step C: Authorized! Navigate to Home
      navigate("/home");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else {
        setError("Login failed: " + err.message);
      }
      setLoading(false);
    }
  };

  // 4. Handle Google Sign-In with Access Guard & Redirect Fallback
  const handleGoogleLogin = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user is registered in Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      let userData = null;

      if (userDoc.exists()) {
        userData = userDoc.data();
      } else {
        // Also check by email in case pre-registered by an admin
        try {
          const q = query(
            collection(db, "users"),
            where("email", "==", user.email),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            userData = snap.docs[0].data();
            // Save under current UID so future lookups are immediate
            await setDoc(userDocRef, {
              ...userData,
              name:
                userData.name || user.displayName || user.email.split("@")[0],
            });
          }
        } catch {
          // Fallback query might be restricted by rules
        }
      }

      // STRICT PERMISSION CHECK: Must be superadmin, admin, or user
      const isRoleApproved =
        userData && ["superadmin", "admin", "user"].includes(userData.role);

      if (!isRoleApproved) {
        await signOut(auth);
        if (userData?.role === "revoked") {
          setError("Access Denied: Your account access has been revoked.");
        } else if (userData?.role === "pending") {
          setError("Access Denied: Your account is still pending approval.");
        } else {
          setError(
            "Access Denied: Your account does not have permission to access this system. Please contact an administrator.",
          );
        }
        setLoading(false);
        return;
      }

      navigate("/home");
    } catch (err) {
      console.error("Google sign-in error:", err);
      // If the popup is blocked by the browser, ad-blocker, or cross-origin restrictions,
      // seamlessly transition to redirect sign-in.
      if (
        err.code === "auth/popup-blocked" ||
        err.code === "auth/cancelled-popup-request"
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          console.error("Redirect fallback error:", redirectErr);
          setError("Google sign-in redirect failed: " + redirectErr.message);
          setLoading(false);
          return;
        }
      }

      if (err.code === "auth/account-exists-with-different-credential") {
        setError(
          "An account already exists with this email using a password. Please sign in with your email and password above, or enable account linking in Firebase Console.",
        );
      } else if (err.code !== "auth/popup-closed-by-user") {
        setError("Google sign-in failed: " + err.message);
      }
      setLoading(false);
    }
  };

  // Color Tokens based on Theme
  const theme = {
    bg: isDarkMode
      ? "radial-gradient(ellipse at 50% 12%, rgba(30, 58, 138, 0.35) 0%, transparent 65%), linear-gradient(135deg, #070c18 0%, #0d1527 45%, #152238 100%)"
      : "radial-gradient(ellipse at 50% 12%, rgba(191, 219, 254, 0.55) 0%, transparent 65%), linear-gradient(135deg, #dbeafe 0%, #e0e7ff 50%, #e2e8f0 100%)",
    cardBg: isDarkMode ? "rgba(15, 23, 42, 0.75)" : "rgba(255, 255, 255, 0.82)",
    cardBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(255, 255, 255, 0.8)",
    cardShadow: isDarkMode
      ? "0 25px 60px -15px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)"
      : "0 20px 45px -12px rgba(30, 58, 138, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.6)",
    textPrimary: isDarkMode ? "#f8fafc" : "#0f172a",
    textSecondary: isDarkMode ? "#94a3b8" : "#64748b",
    inputBg: isDarkMode ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.85)",
    inputBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.85)",
    inputText: isDarkMode ? "#f8fafc" : "#0f172a",
    inputPlaceholder: isDarkMode ? "#94a3b8" : "#64748b",
    dividerColor: isDarkMode
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(0, 0, 0, 0.09)",
    googleBtnBg: isDarkMode
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(255, 255, 255, 0.95)",
    googleBtnBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.8)",
    googleBtnText: isDarkMode ? "#f8fafc" : "#1e293b",
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

  return (
    <div
      style={{
        background: theme.bg,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "32px 16px 0 16px",
        transition: "background 0.4s ease, color 0.4s ease",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Scoped Dynamic Styles for Inputs & Placeholders across themes */}
      <style>{`
        .login-input::placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
        .login-input::-webkit-input-placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
        .login-input::-moz-placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
        .login-input:-ms-input-placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
      `}</style>

      {/* Centered Glassmorphic Login Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: theme.cardBg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: theme.cardBorder,
          boxShadow: theme.cardShadow,
          borderRadius: "24px",
          padding: "36px 32px",
          margin: "auto 0",
          color: theme.textPrimary,
          transition: "all 0.3s ease",
        }}
      >
        {/* Emblem & Branding */}
        <div className="text-center mb-4">
          <div
            className="d-inline-flex align-items-center justify-content-center mb-3"
            style={{
              width: "62px",
              height: "62px",
              borderRadius: "18px",
              background: isDarkMode
                ? "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)"
                : "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
              boxShadow: isDarkMode
                ? "0 8px 24px rgba(59, 130, 246, 0.35)"
                : "0 8px 20px rgba(37, 99, 235, 0.25)",
            }}
          >
            {/* Auditorium Theater Stage SVG Icon */}
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 10s3-3 3-8"></path>
              <path d="M22 10s-3-3-3-8"></path>
              <path d="M10 2c0 4.418-2.239 8-5 8"></path>
              <path d="M14 2c0 4.418 2.239 8 5 8"></path>
              <path d="M2 10h20"></path>
              <path d="M5 10v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"></path>
              <path d="M9 15h6"></path>
              <path d="M9 18h6"></path>
            </svg>
          </div>
          <h3
            style={{
              fontWeight: 700,
              letterSpacing: "-0.5px",
              color: theme.textPrimary,
              marginBottom: "4px",
              fontSize: "1.65rem",
            }}
          >
            Cultural Committee GNDEC
          </h3>
          <p
            style={{
              color: theme.textSecondary,
              fontSize: "0.88rem",
              fontWeight: 500,
              marginBottom: 0,
            }}
          >
            Auditorium Event Management System
          </p>
        </div>

        {/* Status Alerts */}
        {message && (
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
              padding: "10px 14px",
              fontSize: "0.85rem",
              textAlign: "center",
              marginBottom: "18px",
            }}
            role="alert"
          >
            {message}
          </div>
        )}

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
              padding: "10px 14px",
              fontSize: "0.85rem",
              textAlign: "center",
              marginBottom: "18px",
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: "100%",
            background: theme.googleBtnBg,
            border: theme.googleBtnBorder,
            color: theme.googleBtnText,
            borderRadius: "14px",
            padding: "11px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            fontWeight: 600,
            fontSize: "0.92rem",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            marginBottom: "20px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = isDarkMode
              ? "0 4px 16px rgba(0, 0, 0, 0.4)"
              : "0 4px 14px rgba(30, 58, 138, 0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {/* Official Google 4-color SVG logo */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
            />
          </svg>
          <span>Sign in with Google</span>
        </button>

        {/* Divider */}
        <div className="d-flex align-items-center mb-4">
          <hr
            style={{
              flexGrow: 1,
              margin: 0,
              borderColor: theme.dividerColor,
              opacity: 1,
            }}
          />
          <span
            style={{
              padding: "0 12px",
              color: theme.textSecondary,
              fontSize: "0.8rem",
              fontWeight: 500,
            }}
          >
            or sign in with credentials
          </span>
          <hr
            style={{
              flexGrow: 1,
              margin: 0,
              borderColor: theme.dividerColor,
              opacity: 1,
            }}
          />
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleLogin}>
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
              className="form-control login-input"
              placeholder="name@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                background: theme.inputBg,
                border: theme.inputBorder,
                color: theme.inputText,
                borderRadius: "14px",
                padding: "11px 14px",
                fontSize: "0.93rem",
                boxShadow: "none",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#3b82f6";
                e.target.style.boxShadow =
                  "0 0 0 3px rgba(59, 130, 246, 0.25)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = isDarkMode
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(203, 213, 225, 0.85)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <div className="mb-2">
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "0.84rem",
                fontWeight: 600,
                color: theme.textPrimary,
              }}
            >
              Password
            </label>
            <div
              className="input-group"
              style={{
                background: theme.inputBg,
                border: theme.inputBorder,
                borderRadius: "14px",
                overflow: "hidden",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              id="password-group"
            >
              <input
                type={showPassword ? "text" : "password"}
                className="form-control border-0 login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  background: "transparent",
                  color: theme.inputText,
                  padding: "11px 14px",
                  fontSize: "0.93rem",
                  boxShadow: "none",
                }}
                onFocus={() => {
                  const grp = document.getElementById("password-group");
                  if (grp) {
                    grp.style.borderColor = "#3b82f6";
                    grp.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.25)";
                  }
                }}
                onBlur={() => {
                  const grp = document.getElementById("password-group");
                  if (grp) {
                    grp.style.borderColor = isDarkMode
                      ? "rgba(255, 255, 255, 0.12)"
                      : "rgba(203, 213, 225, 0.85)";
                    grp.style.boxShadow = "none";
                  }
                }}
              />
              <button
                type="button"
                className="btn border-0"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
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

          {/* Forgot / Set Password Button */}
          <div className="d-flex justify-content-end mb-4">
            <button
              type="button"
              onClick={handleResetPassword}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: isDarkMode ? "#60a5fa" : "#2563eb",
                fontSize: "0.82rem",
                fontWeight: 500,
                cursor: "pointer",
                textDecoration: "none",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.textDecoration = "underline")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.textDecoration = "none")
              }
            >
              Forgot / Set Password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: isDarkMode
                ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              boxShadow: isDarkMode
                ? "0 8px 20px rgba(37, 99, 235, 0.35)"
                : "0 8px 20px rgba(37, 99, 235, 0.25)",
              border: "none",
              color: "#ffffff",
              borderRadius: "14px",
              padding: "12px",
              fontWeight: 600,
              fontSize: "0.95rem",
              letterSpacing: "0.2px",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow =
                  "0 10px 24px rgba(37, 99, 235, 0.45)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = isDarkMode
                ? "0 8px 20px rgba(37, 99, 235, 0.35)"
                : "0 8px 20px rgba(37, 99, 235, 0.25)";
            }}
          >
            {loading ? "Checking Access..." : "Sign In"}
          </button>
        </form>
      </div>

      {/* Interactive Footer */}
      <Footer isDarkMode={isDarkMode} />

      {/* Floating Bottom-Right Dark / Light Mode Switcher */}
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
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = isDarkMode
              ? "0 12px 30px rgba(0, 0, 0, 0.6)"
              : "0 12px 28px rgba(30, 58, 138, 0.16)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = theme.pillShadow;
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

export default Login;
