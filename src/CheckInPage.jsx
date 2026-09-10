import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import Navbar from "./Navbar";
import Footer from "./Footer";

function CheckInPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, userName } = useAuth();

  const [attendees, setAttendees] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // "all" | "pending" | "checked_in"
  const [syncingId, setSyncingId] = useState(null);

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
    cardBg: isDarkMode ? "rgba(15, 23, 42, 0.72)" : "rgba(255, 255, 255, 0.85)",
    cardBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(255, 255, 255, 0.85)",
    cardShadow: isDarkMode
      ? "0 18px 40px -10px rgba(0, 0, 0, 0.65)"
      : "0 18px 40px -10px rgba(30, 58, 138, 0.12)",
    textPrimary: isDarkMode ? "#f8fafc" : "#0f172a",
    textSecondary: isDarkMode ? "#94a3b8" : "#64748b",
    inputBg: isDarkMode ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.9)",
    inputBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.85)",
    inputText: isDarkMode ? "#f8fafc" : "#0f172a",
    inputPlaceholder: isDarkMode ? "#94a3b8" : "#64748b",
    pillBg: isDarkMode ? "rgba(30, 41, 59, 0.85)" : "rgba(255, 255, 255, 0.85)",
    pillBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.8)",
    pillShadow: isDarkMode
      ? "0 10px 25px rgba(0, 0, 0, 0.5)"
      : "0 10px 25px rgba(30, 58, 138, 0.1)",
    pillText: isDarkMode ? "#f8fafc" : "#1e293b",
    headerBg: isDarkMode
      ? "rgba(13, 21, 39, 0.88)"
      : "rgba(255, 255, 255, 0.92)",
    headerBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(219, 234, 254, 0.8)",
    statCardBg: isDarkMode
      ? "rgba(15, 23, 42, 0.6)"
      : "rgba(255, 255, 255, 0.8)",
    statCardBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(219, 234, 254, 0.9)",
  };

  // 1. Fetch Event Info
  useEffect(() => {
    getDoc(doc(db, "events", eventId)).then((docSnap) => {
      if (docSnap.exists()) {
        setEventData(docSnap.data());
      }
    });
  }, [eventId]);

  // 2. Fetch Attendees (Booked seats)
  useEffect(() => {
    const q = query(
      collection(db, "events", eventId, "seats"),
      where("status", "==", "booked"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sorting numerically by seat number
      list.sort((a, b) => {
        try {
          const numA = parseInt(a.id.split("_")[1]);
          const numB = parseInt(b.id.split("_")[1]);
          if (isNaN(numA) || isNaN(numB)) return 0;

          if (numA === numB) {
            const rowA = parseInt(a.id.split("_")[2]);
            const rowB = parseInt(b.id.split("_")[2]);
            return isNaN(rowA) || isNaN(rowB) ? 0 : rowA - rowB;
          }
          return numA - numB;
        } catch {
          return 0;
        }
      });

      setAttendees(list);
    });

    return () => unsubscribe();
  }, [eventId]);

  // 3. Stats
  const totalBooked = attendees.length;
  const totalCheckedIn = attendees.filter((a) => a.hasCheckedIn).length;
  const totalPending = totalBooked - totalCheckedIn;
  const percentage =
    totalBooked > 0 ? Math.round((totalCheckedIn / totalBooked) * 100) : 0;

  // 4. Handle Check-In Toggle with guaranteed Firestore persistence
  const toggleCheckIn = async (attendee) => {
    if (navigator.vibrate) navigator.vibrate(50); // Tactile feedback

    const nextCheckedIn = !attendee.hasCheckedIn;
    const staffName =
      userName ||
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Staff";
    const staffEmail = user?.email || "";
    const staffUid = user?.uid || "";

    setSyncingId(attendee.id);

    const seatRef = doc(db, "events", eventId, "seats", attendee.id);
    try {
      // 1. Persist directly to Firestore
      await setDoc(
        seatRef,
        {
          hasCheckedIn: nextCheckedIn,
          checkInTime: nextCheckedIn ? serverTimestamp() : null,
          checkedInByName: nextCheckedIn ? staffName : null,
          checkedInByEmail: nextCheckedIn ? staffEmail : null,
          checkedInByUid: nextCheckedIn ? staffUid : null,
        },
        { merge: true },
      );

      // 2. Record immutable audit log
      await addDoc(collection(db, "events", eventId, "activityLogs"), {
        type: nextCheckedIn ? "GATE_CHECK_IN" : "GATE_CHECK_OUT",
        seatId: attendee.id,
        seatLabel: attendee.label,
        studentName: attendee.name,
        studentContact: attendee.contact,
        performedByName: staffName,
        performedByEmail: staffEmail,
        performedByUid: staffUid,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Check-in error:", err);
      alert("Error saving check-in to Firebase: " + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  // 5. Filter Logic (Search + Status Filter)
  const filteredList = attendees.filter((person) => {
    // Status Filter
    if (filterMode === "pending" && person.hasCheckedIn) return false;
    if (filterMode === "checked_in" && !person.hasCheckedIn) return false;

    // Search Query Filter
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    const name = person.name ? String(person.name).toLowerCase() : "";
    const contact = person.contact ? String(person.contact) : "";
    const label = person.label ? String(person.label).toLowerCase() : "";
    const bookedByName = person.bookedByName
      ? String(person.bookedByName).toLowerCase()
      : "";
    const checkedInByName = person.checkedInByName
      ? String(person.checkedInByName).toLowerCase()
      : "";

    return (
      name.includes(searchLower) ||
      contact.includes(searchTerm) ||
      label.includes(searchLower) ||
      bookedByName.includes(searchLower) ||
      checkedInByName.includes(searchLower)
    );
  });

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
      {/* Dynamic Placeholder Styles */}
      <style>{`
        .checkin-input::placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
        .checkin-input::-webkit-input-placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
        .checkin-card {
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .checkin-card:hover {
          transform: translateY(-3px);
        }
      `}</style>

      {/* TOP NAVIGATION BAR */}
      <Navbar isDarkMode={isDarkMode} />

      {/* STICKY EVENT CONTEXT & STATS HEADER */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1020,
          background: theme.headerBg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: theme.headerBorder,
          boxShadow: isDarkMode
            ? "0 10px 30px rgba(0, 0, 0, 0.4)"
            : "0 10px 30px rgba(30, 58, 138, 0.08)",
          transition: "background 0.3s ease",
        }}
      >
        <div className="container py-3">
          {/* Row 1: Back Button & Event Title */}
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div className="d-flex align-items-center gap-3">
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
                ← Back
              </button>

              <div>
                <h5
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: "1.15rem",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {eventData?.name || "Gate Check-In"}
                </h5>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: theme.textSecondary,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "2px",
                  }}
                >
                  <span>🎟️ Gate Check-In Desk</span>
                  {eventData?.date && <span>• 📅 {eventData.date}</span>}
                  <span>• 📍 Main Auditorium</span>
                </div>
              </div>
            </div>

            {/* Quick Actions (View Seating Map Link) */}
            <button
              type="button"
              onClick={() => navigate(`/seats/${eventId}`)}
              style={{
                background: isDarkMode
                  ? "rgba(59, 130, 246, 0.15)"
                  : "rgba(219, 234, 254, 0.8)",
                border: isDarkMode
                  ? "1px solid rgba(59, 130, 246, 0.35)"
                  : "1px solid rgba(147, 197, 253, 0.9)",
                color: isDarkMode ? "#93c5fd" : "#1d4ed8",
                borderRadius: "12px",
                padding: "7px 14px",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s ease",
              }}
            >
              🗺️ Open Seating Map
            </button>
          </div>

          {/* Row 2: Four Live Metric Stat Cards */}
          <div className="row g-2 mb-3">
            {/* 1. Total Reserved */}
            <div className="col-6 col-md-3">
              <div
                style={{
                  background: theme.statCardBg,
                  border: theme.statCardBorder,
                  borderRadius: "14px",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: theme.textSecondary,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Reserved
                  </div>
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: theme.textPrimary,
                    }}
                  >
                    {totalBooked}
                  </div>
                </div>
                <span style={{ fontSize: "1.35rem" }}>🎟️</span>
              </div>
            </div>

            {/* 2. Checked In */}
            <div className="col-6 col-md-3">
              <div
                style={{
                  background: isDarkMode
                    ? "rgba(16, 185, 129, 0.12)"
                    : "rgba(220, 252, 231, 0.8)",
                  border: isDarkMode
                    ? "1px solid rgba(16, 185, 129, 0.28)"
                    : "1px solid rgba(134, 239, 172, 0.8)",
                  borderRadius: "14px",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: isDarkMode ? "#6ee7b7" : "#15803d",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Checked In
                  </div>
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: isDarkMode ? "#a7f3d0" : "#166534",
                    }}
                  >
                    {totalCheckedIn}
                  </div>
                </div>
                <span style={{ fontSize: "1.35rem" }}>✅</span>
              </div>
            </div>

            {/* 3. Pending */}
            <div className="col-6 col-md-3">
              <div
                style={{
                  background: isDarkMode
                    ? "rgba(245, 158, 11, 0.12)"
                    : "rgba(254, 243, 199, 0.8)",
                  border: isDarkMode
                    ? "1px solid rgba(245, 158, 11, 0.28)"
                    : "1px solid rgba(252, 211, 77, 0.8)",
                  borderRadius: "14px",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: isDarkMode ? "#fcd34d" : "#b45309",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Pending
                  </div>
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: isDarkMode ? "#fde68a" : "#92400e",
                    }}
                  >
                    {totalPending}
                  </div>
                </div>
                <span style={{ fontSize: "1.35rem" }}>⏳</span>
              </div>
            </div>

            {/* 4. Attendance Rate */}
            <div className="col-6 col-md-3">
              <div
                style={{
                  background: theme.statCardBg,
                  border: theme.statCardBorder,
                  borderRadius: "14px",
                  padding: "10px 14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: theme.textSecondary,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Rate
                  </span>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: isDarkMode ? "#93c5fd" : "#2563eb",
                    }}
                  >
                    {percentage}%
                  </span>
                </div>
                {/* Visual Progress Bar */}
                <div
                  style={{
                    height: "6px",
                    width: "100%",
                    background: isDarkMode
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.08)",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${percentage}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      borderRadius: "4px",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Search Bar and Quick Filter Pills */}
          <div className="d-flex flex-column flex-md-row gap-2 align-items-stretch align-items-md-center">
            {/* Live Search Input */}
            <div
              style={{
                position: "relative",
                flexGrow: 1,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: theme.textSecondary,
                  fontSize: "0.95rem",
                  pointerEvents: "none",
                }}
              >
                🔍
              </span>
              <input
                type="text"
                className="checkin-input"
                placeholder="Search by Guest Name, Contact, Seat (e.g. R4-5), Staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  background: theme.inputBg,
                  border: theme.inputBorder,
                  borderRadius: "12px",
                  padding: "9px 36px 9px 40px",
                  color: theme.inputText,
                  fontSize: "0.88rem",
                  outline: "none",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) =>
                  (e.target.style.borderColor = isDarkMode
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(203, 213, 225, 0.85)")
                }
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: theme.textSecondary,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="d-flex gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                style={{
                  background:
                    filterMode === "all"
                      ? isDarkMode
                        ? "#3b82f6"
                        : "#2563eb"
                      : isDarkMode
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(255, 255, 255, 0.8)",
                  border:
                    filterMode === "all"
                      ? "1px solid transparent"
                      : theme.inputBorder,
                  color: filterMode === "all" ? "#ffffff" : theme.textPrimary,
                  borderRadius: "10px",
                  padding: "8px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                All ({totalBooked})
              </button>

              <button
                type="button"
                onClick={() => setFilterMode("pending")}
                style={{
                  background:
                    filterMode === "pending"
                      ? isDarkMode
                        ? "#f59e0b"
                        : "#d97706"
                      : isDarkMode
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(255, 255, 255, 0.8)",
                  border:
                    filterMode === "pending"
                      ? "1px solid transparent"
                      : theme.inputBorder,
                  color:
                    filterMode === "pending" ? "#ffffff" : theme.textPrimary,
                  borderRadius: "10px",
                  padding: "8px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                ⏳ Pending ({totalPending})
              </button>

              <button
                type="button"
                onClick={() => setFilterMode("checked_in")}
                style={{
                  background:
                    filterMode === "checked_in"
                      ? isDarkMode
                        ? "#10b981"
                        : "#059669"
                      : isDarkMode
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(255, 255, 255, 0.8)",
                  border:
                    filterMode === "checked_in"
                      ? "1px solid transparent"
                      : theme.inputBorder,
                  color:
                    filterMode === "checked_in" ? "#ffffff" : theme.textPrimary,
                  borderRadius: "10px",
                  padding: "8px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                ✅ Checked In ({totalCheckedIn})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN ATTENDEE CARDS CONTAINER */}
      <main className="container py-4 flex-grow-1">
        {filteredList.length === 0 ? (
          <div
            style={{
              background: theme.cardBg,
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              border: theme.cardBorder,
              borderRadius: "20px",
              padding: "48px 24px",
              textAlign: "center",
              marginTop: "20px",
            }}
          >
            <div style={{ fontSize: "2.8rem", marginBottom: "12px" }}>
              {attendees.length === 0 ? "🎟️" : "🔍"}
            </div>
            <h5 style={{ fontWeight: 700, marginBottom: "6px" }}>
              {attendees.length === 0
                ? "No reservations booked for this event yet"
                : "No matching attendees found"}
            </h5>
            <p
              style={{
                color: theme.textSecondary,
                fontSize: "0.88rem",
                maxWidth: "420px",
                margin: "0 auto 16px auto",
              }}
            >
              {attendees.length === 0
                ? "Open the seating map to reserve seats for guests, or wait for attendees to register."
                : "Try searching with a different name, phone number, or seat number."}
            </p>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                style={{
                  background: isDarkMode ? "#3b82f6" : "#2563eb",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "10px",
                  padding: "8px 18px",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="row g-3">
            {filteredList.map((person) => {
              const isCheckedIn = person.hasCheckedIn;
              const isSyncing = syncingId === person.id;

              return (
                <div key={person.id} className="col-12 col-md-6 col-lg-4">
                  <div
                    className="checkin-card"
                    style={{
                      background: theme.cardBg,
                      backdropFilter: "blur(16px)",
                      WebkitBackdropFilter: "blur(16px)",
                      border: isCheckedIn
                        ? isDarkMode
                          ? "1px solid rgba(16, 185, 129, 0.45)"
                          : "1px solid rgba(16, 185, 129, 0.6)"
                        : theme.cardBorder,
                      borderLeft: isCheckedIn
                        ? "6px solid #10b981"
                        : isDarkMode
                          ? "6px solid rgba(148, 163, 184, 0.4)"
                          : "6px solid rgba(148, 163, 184, 0.7)",
                      boxShadow: isCheckedIn
                        ? isDarkMode
                          ? "0 10px 30px rgba(16, 185, 129, 0.15), 0 0 15px rgba(16, 185, 129, 0.1)"
                          : "0 10px 30px rgba(16, 185, 129, 0.12)"
                        : theme.cardShadow,
                      borderRadius: "18px",
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      position: "relative",
                    }}
                  >
                    {/* Top Row: Seat Badge & Status Indicator */}
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        {/* Seat Badge */}
                        <div
                          style={{
                            background: isDarkMode
                              ? "rgba(30, 58, 138, 0.4)"
                              : "rgba(219, 234, 254, 0.8)",
                            border: isDarkMode
                              ? "1px solid rgba(59, 130, 246, 0.3)"
                              : "1px solid rgba(147, 197, 253, 0.8)",
                            borderRadius: "10px",
                            padding: "4px 10px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span style={{ fontSize: "0.85rem" }}>💺</span>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "0.88rem",
                              color: isDarkMode ? "#93c5fd" : "#1d4ed8",
                              letterSpacing: "0.2px",
                            }}
                          >
                            {person.label}
                          </span>
                        </div>

                        {/* Status Chip */}
                        <div
                          style={{
                            borderRadius: "20px",
                            padding: "3px 10px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            letterSpacing: "0.3px",
                            textTransform: "uppercase",
                            background: isCheckedIn
                              ? isDarkMode
                                ? "rgba(16, 185, 129, 0.2)"
                                : "rgba(220, 252, 231, 0.9)"
                              : isDarkMode
                                ? "rgba(245, 158, 11, 0.18)"
                                : "rgba(254, 243, 199, 0.9)",
                            color: isCheckedIn
                              ? isDarkMode
                                ? "#6ee7b7"
                                : "#15803d"
                              : isDarkMode
                                ? "#fcd34d"
                                : "#b45309",
                            border: isCheckedIn
                              ? "1px solid rgba(16, 185, 129, 0.3)"
                              : "1px solid rgba(245, 158, 11, 0.3)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span>{isCheckedIn ? "✓ Admitted" : "⏳ Pending"}</span>
                        </div>
                      </div>

                      {/* Guest Name & Contact */}
                      <div className="mb-3">
                        <h6
                          style={{
                            fontWeight: 700,
                            fontSize: "1.02rem",
                            color: theme.textPrimary,
                            marginBottom: "4px",
                            lineHeight: 1.3,
                          }}
                          className="text-truncate"
                          title={person.name}
                        >
                          {person.name}
                        </h6>

                        <div className="d-flex align-items-center gap-2">
                          <span style={{ fontSize: "0.82rem" }}>📞</span>
                          <a
                            href={`tel:${person.contact}`}
                            style={{
                              fontSize: "0.84rem",
                              color: isDarkMode ? "#60a5fa" : "#2563eb",
                              textDecoration: "none",
                              fontWeight: 500,
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.textDecoration = "underline")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.textDecoration = "none")
                            }
                          >
                            {person.contact || "No contact"}
                          </a>
                        </div>
                      </div>

                      {/* Audit Log / Staff Details */}
                      <div
                        style={{
                          fontSize: "0.74rem",
                          color: theme.textSecondary,
                          borderTop: isDarkMode
                            ? "1px solid rgba(255, 255, 255, 0.06)"
                            : "1px solid rgba(0, 0, 0, 0.06)",
                          paddingTop: "8px",
                          marginBottom: "12px",
                          lineHeight: 1.4,
                        }}
                      >
                        {person.bookedByName && (
                          <div>
                            Reserved by: <strong>{person.bookedByName}</strong>
                          </div>
                        )}
                        {isCheckedIn && (
                          <div
                            style={{
                              color: isDarkMode ? "#34d399" : "#166534",
                              fontWeight: 500,
                              marginTop: "2px",
                            }}
                          >
                            ✓ Verified by:{" "}
                            <strong>{person.checkedInByName || "Staff"}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tactile Check-In Action Button */}
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleCheckIn(person)}
                        disabled={isSyncing}
                        style={{
                          width: "100%",
                          background: isCheckedIn
                            ? isDarkMode
                              ? "rgba(16, 185, 129, 0.2)"
                              : "rgba(220, 252, 231, 0.95)"
                            : isDarkMode
                              ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                              : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                          border: isCheckedIn
                            ? isDarkMode
                              ? "1px solid rgba(16, 185, 129, 0.4)"
                              : "1px solid rgba(134, 239, 172, 0.9)"
                            : "none",
                          color: isCheckedIn
                            ? isDarkMode
                              ? "#a7f3d0"
                              : "#166534"
                            : "#ffffff",
                          borderRadius: "12px",
                          padding: "10px 14px",
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          cursor: isSyncing ? "not-allowed" : "pointer",
                          boxShadow: isCheckedIn
                            ? "none"
                            : isDarkMode
                              ? "0 4px 15px rgba(37, 99, 235, 0.35)"
                              : "0 4px 15px rgba(37, 99, 235, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSyncing) {
                            e.currentTarget.style.transform = "scale(1.02)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        title={
                          isCheckedIn
                            ? "Click to undo and mark as not checked in"
                            : "Click to check in attendee"
                        }
                      >
                        {isSyncing ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm"
                              role="status"
                            />
                            <span>Syncing...</span>
                          </>
                        ) : isCheckedIn ? (
                          <>
                            <span>✓ Admitted</span>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                opacity: 0.7,
                                marginLeft: "4px",
                              }}
                            >
                              (Undo)
                            </span>
                          </>
                        ) : (
                          <>
                            <span>🎟️ Admit & Check In</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

export default CheckInPage;
