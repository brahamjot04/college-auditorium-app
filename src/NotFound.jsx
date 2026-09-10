import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Footer from "./Footer";

function NotFound() {
  const { user } = useAuth();

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

  const theme = {
    bg: isDarkMode
      ? "radial-gradient(ellipse at 50% 0%, rgba(30, 58, 138, 0.28) 0%, transparent 65%), linear-gradient(135deg, #070c18 0%, #0d1527 45%, #152238 100%)"
      : "radial-gradient(ellipse at 50% 0%, rgba(191, 219, 254, 0.5) 0%, transparent 65%), linear-gradient(135deg, #dbeafe 0%, #e0e7ff 50%, #e2e8f0 100%)",
    cardBg: isDarkMode ? "rgba(15, 23, 42, 0.75)" : "rgba(255, 255, 255, 0.85)",
    cardBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(255, 255, 255, 0.85)",
    cardShadow: isDarkMode
      ? "0 25px 60px -15px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)"
      : "0 20px 45px -12px rgba(30, 58, 138, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.6)",
    textPrimary: isDarkMode ? "#f8fafc" : "#0f172a",
    textSecondary: isDarkMode ? "#94a3b8" : "#64748b",
    pillBg: isDarkMode ? "rgba(30, 41, 59, 0.85)" : "rgba(255, 255, 255, 0.85)",
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
        color: theme.textPrimary,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        transition: "background 0.4s ease, color 0.4s ease",
      }}
    >
      {/* Centered Glassmorphic 404 Card */}
      <main className="flex-grow-1 d-flex align-items-center justify-content-center p-3">
        <div
          style={{
            maxWidth: "460px",
            width: "100%",
            background: theme.cardBg,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: theme.cardBorder,
            boxShadow: theme.cardShadow,
            borderRadius: "24px",
            padding: "44px 32px",
            textAlign: "center",
            animation: "notFoundFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <style>{`
            @keyframes notFoundFadeIn {
              from { opacity: 0; transform: scale(0.96) translateY(12px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>

          {/* Icon Badge */}
          <div
            style={{
              width: "76px",
              height: "76px",
              borderRadius: "22px",
              background: isDarkMode
                ? "rgba(59, 130, 246, 0.18)"
                : "rgba(219, 234, 254, 0.85)",
              border: isDarkMode
                ? "1px solid rgba(59, 130, 246, 0.35)"
                : "1px solid rgba(147, 197, 253, 0.8)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.4rem",
              marginBottom: "20px",
              boxShadow: isDarkMode
                ? "0 0 30px rgba(59, 130, 246, 0.2)"
                : "0 0 25px rgba(37, 99, 235, 0.12)",
            }}
          >
            🧭
          </div>

          <h3
            style={{
              fontWeight: 800,
              fontSize: "1.6rem",
              marginBottom: "10px",
              letterSpacing: "-0.02em",
            }}
          >
            404 - Page Not Found
          </h3>

          <p
            style={{
              color: theme.textSecondary,
              fontSize: "0.92rem",
              lineHeight: 1.5,
              marginBottom: "28px",
            }}
          >
            The page you are looking for doesn't exist, has been retired, or is no longer accessible.
          </p>

          <div className="d-grid gap-2">
            <Link
              to={user ? "/home" : "/"}
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                border: "none",
                borderRadius: "14px",
                padding: "12px",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.95rem",
                textDecoration: "none",
                textAlign: "center",
                boxShadow: "0 8px 20px rgba(37, 99, 235, 0.3)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow =
                  "0 12px 26px rgba(37, 99, 235, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 8px 20px rgba(37, 99, 235, 0.3)";
              }}
            >
              {user ? "← Return to Dashboard" : "← Go to Login"}
            </Link>
          </div>

          <div
            style={{
              marginTop: "24px",
              paddingTop: "18px",
              borderTop: isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.08)"
                : "1px solid rgba(0, 0, 0, 0.08)",
              fontSize: "0.78rem",
              color: theme.textSecondary,
            }}
          >
            Cultural Committee GNDEC • Auditorium System
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <Footer isDarkMode={isDarkMode} />

      {/* FLOATING THEME SWITCHER */}
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

export default NotFound;
