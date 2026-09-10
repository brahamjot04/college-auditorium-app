import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Navbar from "./Navbar";
import Footer from "./Footer";

function Home() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming"); // "upcoming" | "past"

  // Create Form State
  const [newEventName, setNewEventName] = useState("");
  const [eventDate, setEventDate] = useState("");

  // Edit Form State
  const [editingEvent, setEditingEvent] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");

  // Theme state: reads from the same localStorage key as the login page (defaults to light)
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

  const navigate = useNavigate();

  // ---------------------------------------------------------
  // 1. DATA FETCHING
  // ---------------------------------------------------------
  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("date", "desc"));

    const handleSnapshot = (snapshot) => {
      setEventsError("");
      setEvents(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    const handleEventsError = (err) => {
      console.error("Failed to fetch ordered events:", err);

      const fallbackUnsubscribe = onSnapshot(
        collection(db, "events"),
        (snapshot) => {
          setEventsError("");
          setEvents(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (fallbackErr) => {
          console.error("Failed to fetch events:", fallbackErr);
          setEvents([]);
          setEventsError(fallbackErr.message || "Unable to fetch events.");
        },
      );

      return fallbackUnsubscribe;
    };

    let fallbackCleanup = null;
    const unsubscribe = onSnapshot(q, handleSnapshot, (err) => {
      fallbackCleanup = handleEventsError(err);
    });

    return () => {
      unsubscribe();
      if (fallbackCleanup) fallbackCleanup();
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const users = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setPendingUsers(users.filter((u) => u.role === "pending"));
      },
      (err) => {
        console.error("Failed to fetch pending users:", err);
      },
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // ---------------------------------------------------------
  // 2. ACTIONS
  // ---------------------------------------------------------

  // CREATE EVENT
  const createEvent = async (e) => {
    e.preventDefault();
    if (!newEventName || !eventDate) return;

    try {
      await addDoc(collection(db, "events"), {
        name: newEventName,
        date: eventDate,
        status: "active",
        createdAt: new Date(),
      });
      setNewEventName("");
      setEventDate("");
      setShowCreateModal(false);
    } catch (err) {
      alert("Error creating event: " + err.message);
    }
  };

  // DELETE EVENT
  const handleDeleteEvent = async (eventId, eventName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${eventName}"?\n\nThis will remove the event from the list.`,
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "events", eventId));
    } catch (err) {
      alert("Error deleting event: " + err.message);
    }
  };

  // PREPARE EDIT
  const openEditModal = (event) => {
    setEditingEvent(event);
    setEditName(event.name);
    setEditDate(event.date);
  };

  // SAVE EDIT
  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    if (!editingEvent || !editName || !editDate) return;

    try {
      await updateDoc(doc(db, "events", editingEvent.id), {
        name: editName,
        date: editDate,
      });
      setEditingEvent(null);
    } catch (err) {
      alert("Error updating event: " + err.message);
    }
  };

  // APPROVE USER
  const approveUser = async (userId, userEmail) => {
    if (!window.confirm(`Approve access for ${userEmail}?`)) return;
    try {
      await updateDoc(doc(db, "users", userId), { role: "admin" });
    } catch (err) {
      console.error("Failed to approve user:", err);
      alert("Failed to approve user");
    }
  };

  // Helper: Normalize date string to YYYY-MM-DD
  const getNormalizedDate = (dateVal) => {
    if (!dateVal) return "";
    if (typeof dateVal === "string") return dateVal.trim().slice(0, 10);
    return "";
  };

  // Helper: Today's date string in LOCAL user timezone (YYYY-MM-DD)
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayStr();

  // Helper: Check if event is past/archived
  // Rule: An event stays in UPCOMING throughout the entire day of the event.
  // It only moves to PAST EVENTS on the next day (when todayStr > eventDate).
  const isEventPast = (event) => {
    // 1. If admin explicitly archived / completed the event
    if (event.status === "completed") return true;

    // 2. If admin explicitly reopened an event whose date has already passed
    if (event.status === "reopened") return false;

    const eventDate = getNormalizedDate(event.date);
    if (!eventDate) return false;

    // 3. Strict Next-Day Check:
    // If eventDate === todayStr -> FALSE (Happening today! Stays in Upcoming all day)
    // If eventDate > todayStr   -> FALSE (Future event, stays in Upcoming)
    // If eventDate < todayStr   -> TRUE  (Event date has passed; it is now the next day or later)
    return eventDate < todayStr;
  };

  // TOGGLE EVENT STATUS (ARCHIVE / REOPEN)
  const handleToggleEventStatus = async (eventId, eventName, currentIsPast) => {
    let newStatus;
    if (currentIsPast) {
      // If event date has already passed, set "reopened" to keep it in Upcoming despite its date
      const targetEvent = events.find((e) => e.id === eventId);
      const evDate = getNormalizedDate(targetEvent?.date);
      newStatus = evDate && evDate < todayStr ? "reopened" : "active";
    } else {
      newStatus = "completed";
    }

    const actionDesc = currentIsPast
      ? `reopen "${eventName}" and move it to Upcoming Events?`
      : `mark "${eventName}" as completed and move it to Past / Archived Events?`;

    if (!window.confirm(`Are you sure you want to ${actionDesc}`)) {
      return;
    }

    try {
      await updateDoc(doc(db, "events", eventId), {
        status: newStatus,
      });
    } catch (err) {
      console.error("Failed to update event status:", err);
      alert("Failed to update event status: " + err.message);
    }
  };

  // Separate events into Upcoming and Past lists
  const upcomingEvents = events.filter((e) => !isEventPast(e));
  const pastEvents = events.filter((e) => isEventPast(e));

  // Determine which list is active
  const activeEventsList = activeTab === "upcoming" ? upcomingEvents : pastEvents;

  // Filter active events based on search term
  const filteredEvents = activeEventsList.filter((event) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const nameMatch = event.name?.toLowerCase().includes(term);
    const dateMatch = event.date?.toLowerCase().includes(term);
    return nameMatch || dateMatch;
  });

  // ---------------------------------------------------------
  // 3. COLOR TOKENS & STYLES
  // ---------------------------------------------------------
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
    inputPlaceholder: isDarkMode ? "#94a3b8" : "#64748b",
    modalCardBg: isDarkMode ? "#0d1527" : "#ffffff",
    modalBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.8)",
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
    tagBg: isDarkMode ? "rgba(30, 58, 138, 0.25)" : "rgba(219, 234, 254, 0.7)",
    tagBorder: isDarkMode
      ? "1px solid rgba(59, 130, 246, 0.3)"
      : "1px solid rgba(147, 197, 253, 0.8)",
    tagText: isDarkMode ? "#93c5fd" : "#1d4ed8",
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
      {/* Dynamic Placeholder Styles */}
      <style>{`
        .home-input::placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
        .home-input::-webkit-input-placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
        .home-input::-moz-placeholder {
          color: ${theme.inputPlaceholder} !important;
          opacity: 1 !important;
        }
        .home-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .home-card:hover {
          transform: translateY(-4px);
          box-shadow: ${
            isDarkMode
              ? "0 22px 45px -10px rgba(0, 0, 0, 0.7), 0 0 20px rgba(59, 130, 246, 0.2)"
              : "0 20px 40px -10px rgba(30, 58, 138, 0.2), 0 0 15px rgba(37, 99, 235, 0.1)"
          } !important;
          border-color: ${isDarkMode ? "rgba(96, 165, 250, 0.35)" : "rgba(37, 99, 235, 0.35)"} !important;
        }
      `}</style>

      {/* TOP NAVIGATION BAR WITH USER INFO, MANAGE STAFF & CONFIRMED LOGOUT */}
      <Navbar isDarkMode={isDarkMode} />

      {/* MAIN CONTAINER */}
      <main className="container py-4 flex-grow-1">
        {/* PENDING APPROVALS ALERT (Admin only) */}
        {isAdmin && pendingUsers.length > 0 && (
          <div
            style={{
              background: isDarkMode
                ? "rgba(245, 158, 11, 0.14)"
                : "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              borderRadius: "18px",
              padding: "16px 20px",
              marginBottom: "24px",
              boxShadow: "0 10px 25px rgba(245, 158, 11, 0.08)",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span
                style={{
                  fontWeight: 700,
                  color: isDarkMode ? "#fbbf24" : "#92400e",
                  fontSize: "0.95rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                ⚠️ Pending Access Requests
              </span>
              <span
                style={{
                  background: isDarkMode ? "#fbbf24" : "#d97706",
                  color: "#ffffff",
                  borderRadius: "20px",
                  padding: "2px 9px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                }}
              >
                {pendingUsers.length}
              </span>
            </div>
            <div className="d-flex flex-column gap-2 mt-2">
              {pendingUsers.map((pUser) => (
                <div
                  key={pUser.id}
                  style={{
                    background: isDarkMode
                      ? "rgba(15, 23, 42, 0.5)"
                      : "rgba(255, 255, 255, 0.8)",
                    border: isDarkMode
                      ? "1px solid rgba(255, 255, 255, 0.06)"
                      : "1px solid rgba(203, 213, 225, 0.6)",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 500,
                      color: theme.textPrimary,
                    }}
                  >
                    {pUser.email}
                  </span>
                  <button
                    onClick={() => approveUser(pUser.id, pUser.email)}
                    style={{
                      background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                      border: "none",
                      color: "#ffffff",
                      borderRadius: "10px",
                      padding: "5px 12px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✓ Approve Access
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TOOLBAR & SEARCH SECTION */}
        <div
          style={{
            background: theme.cardBg,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: theme.cardBorder,
            borderRadius: "20px",
            padding: "20px 24px",
            boxShadow: theme.cardShadow,
            marginBottom: "32px",
          }}
        >
          <div className="row g-3 align-items-center">
            {/* Title & Stats */}
            <div className="col-12 col-md-4">
              <div className="d-flex align-items-center gap-2">
                <h3
                  style={{
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    margin: 0,
                    color: theme.textPrimary,
                  }}
                >
                  {activeTab === "upcoming" ? "Upcoming Events" : "Past Events"}
                </h3>
                <span
                  style={{
                    background: theme.tagBg,
                    border: theme.tagBorder,
                    color: theme.tagText,
                    borderRadius: "20px",
                    padding: "2px 10px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                  }}
                >
                  {filteredEvents.length}
                </span>
              </div>
              <p
                style={{
                  fontSize: "0.82rem",
                  margin: "2px 0 0 0",
                  color: theme.textSecondary,
                }}
              >
                {activeTab === "upcoming"
                  ? "Auditorium scheduled bookings & check-in gates"
                  : "Completed events, seating plans & attendance records"}
              </p>
            </div>

            {/* Instant Search Bar */}
            <div className="col-12 col-md-5">
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
                  className="form-control home-input"
                  placeholder="Search events by name or date..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: theme.inputBg,
                    border: theme.inputBorder,
                    color: theme.inputText,
                    borderRadius: "14px",
                    padding: "10px 14px 10px 40px",
                    fontSize: "0.9rem",
                    boxShadow: "none",
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
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

            {/* New Event Button (Admin Only) */}
            <div className="col-12 col-md-3 d-flex justify-content-md-end">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    width: "100%",
                    maxWidth: "200px",
                    background: isDarkMode
                      ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                      : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    boxShadow: isDarkMode
                      ? "0 8px 20px rgba(37, 99, 235, 0.35)"
                      : "0 8px 20px rgba(37, 99, 235, 0.22)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "14px",
                    padding: "10px 18px",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow =
                      "0 10px 24px rgba(37, 99, 235, 0.45)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = isDarkMode
                      ? "0 8px 20px rgba(37, 99, 235, 0.35)"
                      : "0 8px 20px rgba(37, 99, 235, 0.22)";
                  }}
                >
                  <span>➕</span>
                  <span>Create Event</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* EVENT LIFECYCLE TABS: Upcoming Events vs Past Events */}
        <div className="d-flex align-items-center flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            style={{
              background:
                activeTab === "upcoming"
                  ? isDarkMode
                    ? "rgba(37, 99, 235, 0.28)"
                    : "rgba(219, 234, 254, 0.95)"
                  : isDarkMode
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(255, 255, 255, 0.7)",
              border:
                activeTab === "upcoming"
                  ? isDarkMode
                    ? "1px solid rgba(59, 130, 246, 0.55)"
                    : "1px solid rgba(147, 197, 253, 0.9)"
                  : theme.inputBorder,
              color:
                activeTab === "upcoming"
                  ? isDarkMode
                    ? "#93c5fd"
                    : "#1d4ed8"
                  : theme.textSecondary,
              borderRadius: "14px",
              padding: "9px 18px",
              fontSize: "0.88rem",
              fontWeight: activeTab === "upcoming" ? 700 : 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
              boxShadow:
                activeTab === "upcoming"
                  ? isDarkMode
                    ? "0 4px 14px rgba(37, 99, 235, 0.25)"
                    : "0 4px 12px rgba(37, 99, 235, 0.12)"
                  : "none",
            }}
          >
            <span>🟢 Upcoming Events</span>
            <span
              style={{
                background:
                  activeTab === "upcoming"
                    ? "#2563eb"
                    : isDarkMode
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.08)",
                color:
                  activeTab === "upcoming" ? "#ffffff" : theme.textSecondary,
                borderRadius: "20px",
                padding: "2px 8px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {upcomingEvents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("past")}
            style={{
              background:
                activeTab === "past"
                  ? isDarkMode
                    ? "rgba(100, 116, 139, 0.28)"
                    : "rgba(241, 245, 249, 0.95)"
                  : isDarkMode
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(255, 255, 255, 0.7)",
              border:
                activeTab === "past"
                  ? isDarkMode
                    ? "1px solid rgba(148, 163, 184, 0.45)"
                    : "1px solid rgba(203, 213, 225, 0.9)"
                  : theme.inputBorder,
              color:
                activeTab === "past"
                  ? isDarkMode
                    ? "#cbd5e1"
                    : "#475569"
                  : theme.textSecondary,
              borderRadius: "14px",
              padding: "9px 18px",
              fontSize: "0.88rem",
              fontWeight: activeTab === "past" ? 700 : 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
              boxShadow:
                activeTab === "past"
                  ? isDarkMode
                    ? "0 4px 14px rgba(0, 0, 0, 0.3)"
                    : "0 4px 12px rgba(100, 116, 139, 0.1)"
                  : "none",
            }}
          >
            <span>📁 Past / Archived Events</span>
            <span
              style={{
                background:
                  activeTab === "past"
                    ? isDarkMode
                      ? "#475569"
                      : "#64748b"
                    : isDarkMode
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.08)",
                color: activeTab === "past" ? "#ffffff" : theme.textSecondary,
                borderRadius: "20px",
                padding: "2px 8px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {pastEvents.length}
            </span>
          </button>
        </div>

        {/* ERROR NOTICE */}
        {eventsError && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.16)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: isDarkMode ? "#fca5a5" : "#991b1b",
              borderRadius: "16px",
              padding: "12px 18px",
              marginBottom: "24px",
            }}
          >
            ⚠️ Failed to load events: {eventsError}
          </div>
        )}

        {/* EVENTS GRID */}
        {filteredEvents.length === 0 ? (
          <div
            style={{
              background: theme.cardBg,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: theme.cardBorder,
              borderRadius: "24px",
              padding: "60px 24px",
              textAlign: "center",
              boxShadow: theme.cardShadow,
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🎭</div>
            <h4
              style={{
                fontWeight: 700,
                color: theme.textPrimary,
                marginBottom: "8px",
              }}
            >
              {searchTerm
                ? "No matching events found"
                : activeTab === "upcoming"
                  ? "No upcoming events scheduled"
                  : "No past or archived events"}
            </h4>
            <p
              style={{
                color: theme.textSecondary,
                fontSize: "0.9rem",
                maxWidth: "400px",
                margin: "0 auto 20px auto",
              }}
            >
              {searchTerm
                ? `No events matched "${searchTerm}". Try searching for another keyword or date.`
                : activeTab === "upcoming"
                  ? (isAdmin
                      ? "Get started by creating your first auditorium event using the button above."
                      : "Check back later for newly scheduled college auditorium events.")
                  : "Completed or past auditorium events will appear here."}
            </p>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                style={{
                  background: theme.inputBg,
                  border: theme.inputBorder,
                  color: theme.textPrimary,
                  borderRadius: "12px",
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="row g-4">
            {filteredEvents.map((event) => (
              <div key={event.id} className="col-12 col-md-6 col-lg-4">
                <div
                  className="home-card h-100"
                  style={{
                    background: theme.cardBg,
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: theme.cardBorder,
                    borderRadius: "22px",
                    padding: "24px 22px",
                    boxShadow: theme.cardShadow,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Card Top: Date, Status Badge & Admin Controls */}
                  {(() => {
                    const isPast = isEventPast(event);
                    const isToday = getNormalizedDate(event.date) === todayStr;

                    return (
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                        <div className="d-flex align-items-center flex-wrap gap-2">
                          <span
                            style={{
                              background: theme.tagBg,
                              border: theme.tagBorder,
                              color: theme.tagText,
                              borderRadius: "20px",
                              padding: "4px 12px",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span>📅</span>
                            <span>
                              {event.date
                                ? new Date(event.date + "T00:00:00").toLocaleDateString(undefined, {
                                    weekday: "short",
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "Date Unset"}
                            </span>
                          </span>

                          {/* Lifecycle Status Pill */}
                          <span
                            style={{
                              borderRadius: "20px",
                              padding: "3px 9px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              background: isPast
                                ? isDarkMode
                                  ? "rgba(148, 163, 184, 0.16)"
                                  : "rgba(100, 116, 139, 0.12)"
                                : isToday
                                  ? isDarkMode
                                    ? "rgba(245, 158, 11, 0.2)"
                                    : "rgba(245, 158, 11, 0.15)"
                                : isDarkMode
                                  ? "rgba(16, 185, 129, 0.18)"
                                  : "rgba(16, 185, 129, 0.15)",
                              color: isPast
                                ? isDarkMode
                                  ? "#94a3b8"
                                  : "#64748b"
                                : isToday
                                  ? isDarkMode
                                    ? "#fbbf24"
                                    : "#b45309"
                                : isDarkMode
                                  ? "#6ee7b7"
                                  : "#047857",
                              border: isPast
                                ? isDarkMode
                                  ? "1px solid rgba(148, 163, 184, 0.25)"
                                  : "1px solid rgba(203, 213, 225, 0.8)"
                                : isToday
                                  ? isDarkMode
                                    ? "1px solid rgba(245, 158, 11, 0.35)"
                                    : "1px solid rgba(245, 158, 11, 0.4)"
                                : isDarkMode
                                  ? "1px solid rgba(16, 185, 129, 0.35)"
                                  : "1px solid rgba(110, 231, 183, 0.8)",
                            }}
                          >
                            {event.status === "completed"
                              ? "🏁 Completed"
                              : event.status === "reopened"
                                ? "🔄 Reopened"
                                : isToday
                                  ? "🔥 Happening Today"
                                  : isPast
                                    ? "📁 Archived"
                                    : "🟢 Active"}
                          </span>
                        </div>

                        {/* Admin Edit / Archive / Delete Actions */}
                        {isAdmin && (
                          <div className="d-flex align-items-center gap-1">
                            {/* Toggle Archive / Reopen Button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleEventStatus(event.id, event.name, isPast)
                              }
                              title={
                                isPast
                                  ? "Reopen event as Active"
                                  : "Mark event as Completed / Archive"
                              }
                              style={{
                                background: isPast
                                  ? isDarkMode
                                    ? "rgba(59, 130, 246, 0.15)"
                                    : "rgba(219, 234, 254, 0.8)"
                                  : isDarkMode
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "rgba(254, 243, 199, 0.8)",
                                border: isPast
                                  ? isDarkMode
                                    ? "1px solid rgba(59, 130, 246, 0.35)"
                                    : "1px solid rgba(147, 197, 253, 0.8)"
                                  : isDarkMode
                                    ? "1px solid rgba(245, 158, 11, 0.35)"
                                    : "1px solid rgba(252, 211, 77, 0.8)",
                                color: isPast
                                  ? isDarkMode
                                    ? "#93c5fd"
                                    : "#1d4ed8"
                                  : isDarkMode
                                    ? "#fbbf24"
                                    : "#b45309",
                                borderRadius: "10px",
                                padding: "4px 8px",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {isPast ? "🔄 Reopen" : "🏁 Archive"}
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(event)}
                              title="Edit Event"
                              style={{
                                background: isDarkMode
                                  ? "rgba(255, 255, 255, 0.08)"
                                  : "rgba(255, 255, 255, 0.9)",
                                border: theme.inputBorder,
                                color: theme.textPrimary,
                                borderRadius: "10px",
                                padding: "4px 9px",
                                fontSize: "0.82rem",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
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
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteEvent(event.id, event.name)
                              }
                              title="Delete Event"
                              style={{
                                background: "rgba(239, 68, 68, 0.1)",
                                border: "1px solid rgba(239, 68, 68, 0.25)",
                                color: "#ef4444",
                                borderRadius: "10px",
                                padding: "4px 9px",
                                fontSize: "0.82rem",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                  "rgba(239, 68, 68, 0.2)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  "rgba(239, 68, 68, 0.1)";
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Event Title */}
                  <h4
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: theme.textPrimary,
                      marginBottom: "18px",
                      lineHeight: "1.35",
                      wordBreak: "break-word",
                    }}
                  >
                    {event.name}
                  </h4>

                  {/* Spacer */}
                  <div className="mt-auto pt-3">
                    {/* Primary Actions Grid */}
                    <div className="d-grid gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/seats/${event.id}`)}
                        style={{
                          width: "100%",
                          background: isDarkMode
                            ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                            : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                          boxShadow: isDarkMode
                            ? "0 4px 14px rgba(37, 99, 235, 0.3)"
                            : "0 4px 12px rgba(37, 99, 235, 0.2)",
                          border: "none",
                          color: "#ffffff",
                          borderRadius: "12px",
                          padding: "10px 14px",
                          fontWeight: 600,
                          fontSize: "0.9rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.transform = "translateY(-1px)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.transform = "translateY(0)")
                        }
                      >
                        <span>💺</span>
                        <span>Seating Map</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/checkin/${event.id}`)}
                        style={{
                          width: "100%",
                          background: isDarkMode
                            ? "rgba(16, 185, 129, 0.14)"
                            : "rgba(16, 185, 129, 0.12)",
                          border: isDarkMode
                            ? "1px solid rgba(16, 185, 129, 0.35)"
                            : "1px solid rgba(16, 185, 129, 0.3)",
                          color: isDarkMode ? "#6ee7b7" : "#065f46",
                          borderRadius: "12px",
                          padding: "9px 14px",
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDarkMode
                            ? "rgba(16, 185, 129, 0.22)"
                            : "rgba(16, 185, 129, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isDarkMode
                            ? "rgba(16, 185, 129, 0.14)"
                            : "rgba(16, 185, 129, 0.12)";
                        }}
                      >
                        <span>🎟️</span>
                        <span>Gate Check-In</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CREATE EVENT MODAL (Pure React Fixed Overlay, Guaranteed Clickable) */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(4, 7, 14, 0.72)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div
            style={{
              background: theme.modalCardBg,
              border: theme.modalBorder,
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "520px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: theme.cardBorder,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: "1.2rem",
                  color: theme.textPrimary,
                }}
              >
                ➕ Create New Event
              </h4>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: theme.textSecondary,
                  fontSize: "1.3rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={createEvent} style={{ padding: "24px" }}>
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
                  Event Title
                </label>
                <input
                  type="text"
                  className="form-control home-input"
                  placeholder="e.g. Annual Cultural Fest 2026"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
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
                />
              </div>

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
                  Event Date
                </label>
                <input
                  type="date"
                  className="form-control home-input"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
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
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: "none",
                    border: theme.inputBorder,
                    color: theme.textSecondary,
                    borderRadius: "12px",
                    padding: "10px 18px",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: isDarkMode
                      ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                      : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "12px",
                    padding: "10px 20px",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EVENT MODAL (Pure React Fixed Overlay, Guaranteed Clickable) */}
      {editingEvent && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(4, 7, 14, 0.72)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingEvent(null);
          }}
        >
          <div
            style={{
              background: theme.modalCardBg,
              border: theme.modalBorder,
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "520px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: theme.cardBorder,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: "1.2rem",
                  color: theme.textPrimary,
                }}
              >
                ✏️ Edit Event Details
              </h4>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: theme.textSecondary,
                  fontSize: "1.3rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateEvent} style={{ padding: "24px" }}>
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
                  Event Title
                </label>
                <input
                  type="text"
                  className="form-control home-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                />
              </div>

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
                  Event Date
                </label>
                <input
                  type="date"
                  className="form-control home-input"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
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
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  style={{
                    background: "none",
                    border: theme.inputBorder,
                    color: theme.textSecondary,
                    borderRadius: "12px",
                    padding: "10px 18px",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: isDarkMode
                      ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                      : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "12px",
                    padding: "10px 20px",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <Footer isDarkMode={isDarkMode} />

      {/* FLOATING THEME TOGGLE (BOTTOM RIGHT) */}
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

export default Home;
