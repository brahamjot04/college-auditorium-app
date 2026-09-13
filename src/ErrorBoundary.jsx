import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHardReload = () => {
    if ("caches" in window) {
      caches.keys().then((names) => {
        for (const name of names) caches.delete(name);
      });
    }
    window.location.href = window.location.origin + window.location.pathname + "?t=" + Date.now();
  };

  render() {
    if (this.state.hasError) {
      const isDarkMode =
        typeof localStorage !== "undefined" &&
        localStorage.getItem("login_theme") === "dark";

      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: isDarkMode
              ? "radial-gradient(ellipse at 50% 0%, rgba(30, 58, 138, 0.3) 0%, transparent 70%), #070c18"
              : "radial-gradient(ellipse at 50% 0%, rgba(191, 219, 254, 0.6) 0%, transparent 70%), #f8fafc",
            color: isDarkMode ? "#f8fafc" : "#0f172a",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              background: isDarkMode ? "rgba(15, 23, 42, 0.85)" : "#ffffff",
              border: isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.12)"
                : "1px solid rgba(226, 232, 240, 0.9)",
              borderRadius: "24px",
              padding: "36px 28px",
              boxShadow: isDarkMode
                ? "0 25px 60px rgba(0, 0, 0, 0.7)"
                : "0 20px 50px rgba(30, 58, 138, 0.12)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>⚠️</div>
            <h3 style={{ fontWeight: 800, margin: "0 0 8px 0", fontSize: "1.35rem" }}>
              Something went wrong
            </h3>
            <p
              style={{
                color: isDarkMode ? "#94a3b8" : "#64748b",
                fontSize: "0.9rem",
                lineHeight: 1.5,
                margin: "0 0 24px 0",
              }}
            >
              The portal encountered an unexpected error while rendering. Reloading usually restores normal operation.
            </p>

            {this.state.error && (
              <div
                style={{
                  background: isDarkMode ? "rgba(0, 0, 0, 0.4)" : "#f1f5f9",
                  border: isDarkMode
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  fontSize: "0.76rem",
                  fontFamily: "monospace",
                  textAlign: "left",
                  overflowX: "auto",
                  marginBottom: "24px",
                  maxHeight: "220px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                <div style={{ color: "#ef4444", fontWeight: 700 }}>
                  {this.state.error.toString()}
                </div>
                {this.state.error.stack && (
                  <div style={{ marginTop: "8px", color: isDarkMode ? "#cbd5e1" : "#475569", fontSize: "0.72rem" }}>
                    {this.state.error.stack}
                  </div>
                )}
                {this.state.errorInfo?.componentStack && (
                  <div style={{ marginTop: "8px", color: "#38bdf8", fontSize: "0.72rem" }}>
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "12px",
                  padding: "11px 18px",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
                }}
              >
                ↻ Reload Portal
              </button>

              <button
                type="button"
                onClick={this.handleHardReload}
                style={{
                  flex: 1,
                  background: isDarkMode
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.05)",
                  color: isDarkMode ? "#f8fafc" : "#0f172a",
                  border: isDarkMode
                    ? "1px solid rgba(255, 255, 255, 0.12)"
                    : "1px solid #cbd5e1",
                  borderRadius: "12px",
                  padding: "11px 18px",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ⚡ Fresh Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
