import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { exportToCsv } from "./utils/exportCsv";

function ActivityLogsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [eventName, setEventName] = useState("Loading...");
  const [eventDate, setEventDate] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all"); // "all" | "bookings" | "checkins" | "blocks"

  // Theme synced with login_theme
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

  // 1. Listen to Event Details
  useEffect(() => {
    const unsubEvent = onSnapshot(
      doc(db, "events", eventId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setEventName(data.name || "Untitled Event");
          setEventDate(data.date || "");
        } else {
          setEventName("Event Not Found");
        }
      },
      (err) => {
        console.error("Error fetching event:", err);
        setErrorNotice("Failed to load event details.");
      },
    );

    return () => unsubEvent();
  }, [eventId]);

  // 2. Listen to Activity Logs in Real-time
  useEffect(() => {
    const q = query(
      collection(db, "events", eventId, "activityLogs"),
      orderBy("timestamp", "desc"),
    );

    const handleSnapshot = (snapshot) => {
      setErrorNotice("");
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setLogs(list);
      setLoading(false);
    };

    const handleLogsError = (err) => {
      console.warn(
        "Ordered activityLogs query failed, falling back to un-ordered snapshot:",
        err,
      );
      const fallbackUnsub = onSnapshot(
        collection(db, "events", eventId, "activityLogs"),
        (snapshot) => {
          const list = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          // Sort client-side by timestamp desc
          list.sort((a, b) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return timeB - timeA;
          });
          setLogs(list);
          setLoading(false);
        },
        (fallbackErr) => {
          console.error("Fallback activityLogs error:", fallbackErr);
          setErrorNotice("Failed to load activity logs.");
          setLoading(false);
        },
      );
      return fallbackUnsub;
    };

    let fallbackCleanup = null;
    const unsub = onSnapshot(q, handleSnapshot, (err) => {
      fallbackCleanup = handleLogsError(err);
    });

    return () => {
      unsub();
      if (fallbackCleanup) fallbackCleanup();
    };
  }, [eventId]);

  // 3. Format Date/Timestamp Helper
  const formatTimestamp = (ts) => {
    if (!ts) return "Just now";
    let d;
    if (ts.toDate && typeof ts.toDate === "function") {
      d = ts.toDate();
    } else if (ts instanceof Date) {
      d = ts;
    } else {
      d = new Date(ts);
    }

    if (isNaN(d.getTime())) return "Unknown time";

    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // 4. Filter & Search Logic
  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      // Action Category Filter
      if (actionFilter === "bookings") {
        if (item.type !== "SEAT_BOOKED" && item.type !== "SEAT_RELEASED") return false;
      } else if (actionFilter === "checkins") {
        if (item.type !== "GATE_CHECK_IN" && item.type !== "GATE_CHECK_OUT") return false;
      } else if (actionFilter === "blocks") {
        if (item.type !== "SEATS_BLOCKED" && item.type !== "SEATS_UNBLOCKED" && item.type !== "SEAT_UNBLOCKED") return false;
      }

      // Keyword Search
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;

      const staffName = item.performedByName?.toLowerCase() || "";
      const staffEmail = item.performedByEmail?.toLowerCase() || "";
      const studentName = item.studentName?.toLowerCase() || "";
      const studentContact = item.studentContact?.toLowerCase() || "";
      const seatLabel = item.seatLabel?.toLowerCase() || "";
      const seatId = item.seatId?.toLowerCase() || "";
      const type = item.type?.toLowerCase() || "";

      return (
        staffName.includes(term) ||
        staffEmail.includes(term) ||
        studentName.includes(term) ||
        studentContact.includes(term) ||
        seatLabel.includes(term) ||
        seatId.includes(term) ||
        type.includes(term)
      );
    });
  }, [logs, actionFilter, searchTerm]);

  // 5. CSV Export Handler
  const handleExportLogsCsv = () => {
    if (filteredLogs.length === 0) {
      alert("No logs to export matching your current filters.");
      return;
    }

    const headers = [
      { key: "timestampFormatted", label: "Date & Time" },
      { key: "actionLabel", label: "Action Type" },
      { key: "seatLabel", label: "Seat Label" },
      { key: "studentName", label: "Guest / Student Name" },
      { key: "studentContact", label: "Guest Contact" },
      { key: "performedByName", label: "Staff Member" },
      { key: "performedByEmail", label: "Staff Email" },
    ];

    const rows = filteredLogs.map((item) => {
      let actionLabel = item.type || "ACTIVITY";
      if (item.type === "SEAT_BOOKED") actionLabel = "Seat Booked";
      if (item.type === "SEAT_RELEASED") actionLabel = "Seat Released";
      if (item.type === "GATE_CHECK_IN") actionLabel = "Gate Check-In";
      if (item.type === "GATE_CHECK_OUT") actionLabel = "Check-In Reverted";
      if (item.type === "SEATS_BLOCKED") actionLabel = "Seats Blocked";
      if (item.type === "SEATS_UNBLOCKED") actionLabel = "Seats Unblocked";

      return {
        timestampFormatted: formatTimestamp(item.timestamp),
        actionLabel,
        seatLabel: item.seatLabel || item.seatId || "N/A",
        studentName: item.studentName || "N/A",
        studentContact: item.studentContact || "N/A",
        performedByName: item.performedByName || "Staff",
        performedByEmail: item.performedByEmail || "",
      };
    });

    const safeEventName = eventName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeEventName}_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(filename, headers, rows);
  };

  // 6. Theme Styling Tokens
  const theme = {
    bg: isDarkMode
      ? "radial-gradient(ellipse at 50% 0%, rgba(30, 58, 138, 0.28) 0%, transparent 65%), linear-gradient(135deg, #070c18 0%, #0d1527 45%, #152238 100%)"
      : "radial-gradient(ellipse at 50% 0%, rgba(191, 219, 254, 0.5) 0%, transparent 65%), linear-gradient(135deg, #dbeafe 0%, #e0e7ff 50%, #e2e8f0 100%)",
    cardBg: isDarkMode ? "rgba(15, 23, 42, 0.72)" : "rgba(255, 255, 255, 0.82)",
    cardBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(255, 255, 255, 0.85)",
    cardShadow: isDarkMode
      ? "0 18px 40px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04)"
      : "0 15px 35px -10px rgba(30, 58, 138, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.7)",
    textPrimary: isDarkMode ? "#f8fafc" : "#0f172a",
    textSecondary: isDarkMode ? "#94a3b8" : "#64748b",
    inputBg: isDarkMode ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.9)",
    inputBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.85)",
    inputText: isDarkMode ? "#f8fafc" : "#0f172a",
    pillBg: isDarkMode ? "rgba(30, 58, 138, 0.25)" : "rgba(219, 234, 254, 0.7)",
    pillBorder: isDarkMode
      ? "1px solid rgba(59, 130, 246, 0.3)"
      : "1px solid rgba(147, 197, 253, 0.8)",
  };

  // Helper for badge style per log type
  const getActionBadge = (type) => {
    switch (type) {
      case "SEAT_BOOKED":
        return {
          icon: "🟢",
          title: "Seat Booked",
          bg: isDarkMode ? "rgba(16, 185, 129, 0.16)" : "rgba(220, 252, 231, 0.9)",
          border: isDarkMode ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(134, 239, 172, 0.9)",
          color: isDarkMode ? "#6ee7b7" : "#15803d",
        };
      case "SEAT_RELEASED":
        return {
          icon: "🔴",
          title: "Seat Released",
          bg: isDarkMode ? "rgba(239, 68, 68, 0.16)" : "rgba(254, 226, 226, 0.9)",
          border: isDarkMode ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(252, 165, 165, 0.9)",
          color: isDarkMode ? "#fca5a5" : "#b91c1c",
        };
      case "GATE_CHECK_IN":
        return {
          icon: "🎟️",
          title: "Gate Check-In",
          bg: isDarkMode ? "rgba(59, 130, 246, 0.16)" : "rgba(219, 234, 254, 0.9)",
          border: isDarkMode ? "1px solid rgba(59, 130, 246, 0.35)" : "1px solid rgba(147, 197, 253, 0.9)",
          color: isDarkMode ? "#93c5fd" : "#1d4ed8",
        };
      case "GATE_CHECK_OUT":
        return {
          icon: "↩️",
          title: "Check-In Reverted",
          bg: isDarkMode ? "rgba(245, 158, 11, 0.16)" : "rgba(254, 243, 199, 0.9)",
          border: isDarkMode ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid rgba(252, 211, 77, 0.9)",
          color: isDarkMode ? "#fbbf24" : "#b45309",
        };
      case "SEATS_BLOCKED":
        return {
          icon: "🛡️",
          title: "Seats Blocked",
          bg: isDarkMode ? "rgba(168, 85, 247, 0.16)" : "rgba(243, 232, 255, 0.9)",
          border: isDarkMode ? "1px solid rgba(168, 85, 247, 0.35)" : "1px solid rgba(216, 180, 254, 0.9)",
          color: isDarkMode ? "#d8b4fe" : "#7e22ce",
        };
      case "SEATS_UNBLOCKED":
      case "SEAT_UNBLOCKED":
        return {
          icon: "🔓",
          title: "Seats Unblocked",
          bg: isDarkMode ? "rgba(100, 116, 139, 0.16)" : "rgba(241, 245, 249, 0.9)",
          border: isDarkMode ? "1px solid rgba(148, 163, 184, 0.25)" : "1px solid rgba(203, 213, 225, 0.9)",
          color: isDarkMode ? "#cbd5e1" : "#475569",
        };
      default:
        return {
          icon: "📝",
          title: type || "Activity",
          bg: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
          border: isDarkMode ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(0, 0, 0, 0.1)",
          color: theme.textPrimary,
        };
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
      {/* Universal Navbar */}
      <Navbar isDarkMode={isDarkMode} />

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
          style={{
            background: isDarkMode
              ? "rgba(15, 23, 42, 0.88)"
              : "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: theme.cardBorder,
            boxShadow: theme.cardShadow,
            borderRadius: "30px",
            padding: "9px 18px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            color: theme.textPrimary,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <span>{isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}</span>
        </button>
      </div>

      <div className="container py-4 flex-grow-1" style={{ maxWidth: "1060px" }}>
        {/* Navigation & Header Card */}
        <div
          style={{
            background: theme.cardBg,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: theme.cardBorder,
            borderRadius: "24px",
            padding: "24px 28px",
            boxShadow: theme.cardShadow,
            marginBottom: "28px",
          }}
        >
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            {/* Left: Back Buttons & Event Title */}
            <div className="d-flex align-items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/seats/${eventId}`)}
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
                  transition: "all 0.2s ease",
                }}
              >
                ← Seating Map
              </button>

              <button
                type="button"
                onClick={() => navigate(`/checkin/${eventId}`)}
                style={{
                  background: isDarkMode
                    ? "rgba(59, 130, 246, 0.14)"
                    : "rgba(219, 234, 254, 0.8)",
                  border: isDarkMode
                    ? "1px solid rgba(59, 130, 246, 0.35)"
                    : "1px solid rgba(147, 197, 253, 0.9)",
                  color: isDarkMode ? "#93c5fd" : "#1d4ed8",
                  borderRadius: "12px",
                  padding: "7px 14px",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                🎟️ Gate Check-In
              </button>

              <div>
                <div className="d-flex align-items-center gap-2">
                  <h3
                    style={{
                      fontSize: "1.35rem",
                      fontWeight: 800,
                      margin: 0,
                      letterSpacing: "-0.2px",
                      color: theme.textPrimary,
                    }}
                  >
                    {eventName}
                  </h3>
                  <span
                    style={{
                      background: theme.pillBg,
                      border: theme.pillBorder,
                      color: isDarkMode ? "#93c5fd" : "#1d4ed8",
                      borderRadius: "20px",
                      padding: "2px 10px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                    }}
                  >
                    📜 Audit Trail
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: theme.textSecondary,
                    margin: "3px 0 0 0",
                  }}
                >
                  {eventDate ? `📅 ${eventDate} • ` : ""}
                  Live chronological record of all seat allocations, releases, and gate check-ins.
                </p>
              </div>
            </div>

            {/* Right: Export Button & Count */}
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={handleExportLogsCsv}
                style={{
                  background: isDarkMode
                    ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                    : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "12px",
                  padding: "9px 16px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>📥</span>
                <span>Export Logs (CSV)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Notice */}
        {errorNotice && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.16)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: isDarkMode ? "#fca5a5" : "#991b1b",
              borderRadius: "16px",
              padding: "12px 18px",
              marginBottom: "20px",
            }}
          >
            ⚠️ {errorNotice}
          </div>
        )}

        {/* Controls Toolbar: Search & Action Filters */}
        <div
          style={{
            background: theme.cardBg,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: theme.cardBorder,
            borderRadius: "20px",
            padding: "16px 20px",
            boxShadow: theme.cardShadow,
            marginBottom: "24px",
          }}
        >
          <div className="row g-3 align-items-center">
            {/* Search Input */}
            <div className="col-12 col-md-6">
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: "14px",
                    color: theme.textSecondary,
                    fontSize: "0.95rem",
                    pointerEvents: "none",
                  }}
                >
                  🔍
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by staff, guest name, contact, or seat (e.g. F-12)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: theme.inputBg,
                    border: theme.inputBorder,
                    color: theme.inputText,
                    borderRadius: "14px",
                    padding: "9px 14px 9px 40px",
                    fontSize: "0.88rem",
                    outline: "none",
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    style={{
                      position: "absolute",
                      right: "12px",
                      background: "none",
                      border: "none",
                      color: theme.textSecondary,
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills */}
            <div className="col-12 col-md-6 d-flex flex-wrap align-items-center justify-content-md-end gap-2">
              {[
                { id: "all", label: "All Actions" },
                { id: "bookings", label: "Bookings & Releases" },
                { id: "checkins", label: "Gate Check-Ins" },
                { id: "blocks", label: "VIP Blocks" },
              ].map((tab) => {
                const isActive = actionFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActionFilter(tab.id)}
                    style={{
                      background: isActive
                        ? isDarkMode
                          ? "rgba(37, 99, 235, 0.28)"
                          : "rgba(219, 234, 254, 0.95)"
                        : isDarkMode
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(255, 255, 255, 0.7)",
                      border: isActive
                        ? isDarkMode
                          ? "1px solid rgba(59, 130, 246, 0.55)"
                          : "1px solid rgba(147, 197, 253, 0.9)"
                        : theme.inputBorder,
                      color: isActive
                        ? isDarkMode
                          ? "#93c5fd"
                          : "#1d4ed8"
                        : theme.textSecondary,
                      borderRadius: "12px",
                      padding: "6px 14px",
                      fontSize: "0.82rem",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Logs Timeline List */}
        {loading ? (
          <div
            style={{
              background: theme.cardBg,
              borderRadius: "20px",
              padding: "48px 24px",
              textAlign: "center",
              color: theme.textSecondary,
              border: theme.cardBorder,
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "3px solid rgba(59, 130, 246, 0.2)",
                borderTopColor: "#3b82f6",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px auto",
              }}
            />
            <p style={{ margin: 0, fontWeight: 500 }}>Loading activity logs...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div
            style={{
              background: theme.cardBg,
              borderRadius: "24px",
              padding: "50px 24px",
              textAlign: "center",
              border: theme.cardBorder,
              boxShadow: theme.cardShadow,
            }}
          >
            <div style={{ fontSize: "2.4rem", marginBottom: "10px" }}>📜</div>
            <h5 style={{ fontWeight: 700, color: theme.textPrimary, marginBottom: "6px" }}>
              {searchTerm ? "No matching activity records found" : "No activity logged yet"}
            </h5>
            <p
              style={{
                color: theme.textSecondary,
                fontSize: "0.88rem",
                maxWidth: "420px",
                margin: "0 auto",
              }}
            >
              {searchTerm
                ? `No activity entries matched "${searchTerm}". Try another keyword or clear filters.`
                : "Actions such as seat reservations, cancellations, and gate admissions will appear here in real-time."}
            </p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {filteredLogs.map((item) => {
              const badge = getActionBadge(item.type);
              const formattedTime = formatTimestamp(item.timestamp);

              return (
                <div
                  key={item.id}
                  style={{
                    background: theme.cardBg,
                    border: theme.cardBorder,
                    borderRadius: "18px",
                    padding: "16px 20px",
                    boxShadow: theme.cardShadow,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "14px",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Left: Badge & Description */}
                  <div className="d-flex align-items-center gap-3" style={{ minWidth: "260px" }}>
                    <div
                      style={{
                        background: badge.bg,
                        border: badge.border,
                        color: badge.color,
                        borderRadius: "14px",
                        padding: "8px 12px",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{badge.icon}</span>
                      <span>{badge.title}</span>
                    </div>

                    <div>
                      {/* Seat Label */}
                      {(item.seatLabel || item.seatId) && (
                        <span
                          style={{
                            background: isDarkMode
                              ? "rgba(255, 255, 255, 0.08)"
                              : "rgba(0, 0, 0, 0.06)",
                            color: theme.textPrimary,
                            borderRadius: "8px",
                            padding: "2px 8px",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            marginRight: "8px",
                          }}
                        >
                          Seat: {item.seatLabel || item.seatId}
                        </span>
                      )}

                      {/* Guest / Student Details */}
                      {item.studentName && (
                        <span
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            color: theme.textPrimary,
                          }}
                        >
                          {item.studentName}
                          {item.studentContact ? ` (${item.studentContact})` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Staff Member & Timestamp */}
                  <div
                    className="d-flex flex-column align-items-md-end"
                    style={{ fontSize: "0.82rem" }}
                  >
                    <div className="d-flex align-items-center gap-1">
                      <span style={{ color: theme.textSecondary }}>Performed by:</span>
                      <strong style={{ color: theme.textPrimary }}>
                        {item.performedByName || "Staff"}
                      </strong>
                      {item.performedByEmail && (
                        <span
                          style={{
                            color: theme.textSecondary,
                            fontSize: "0.76rem",
                          }}
                        >
                          ({item.performedByEmail})
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        color: theme.textSecondary,
                        fontSize: "0.75rem",
                        marginTop: "3px",
                      }}
                    >
                      🕒 {formattedTime}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Bottom Footer */}
      <Footer isDarkMode={isDarkMode} />
    </div>
  );
}

export default ActivityLogsPage;
