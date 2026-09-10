import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "./firebase";
import {
  doc,
  collection,
  onSnapshot,
  deleteDoc,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import Navbar from "./Navbar";
import Footer from "./Footer";

function SeatingPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, userName } = useAuth();

  // State
  const [eventName, setEventName] = useState("Loading...");
  const [eventData, setEventData] = useState(null);
  const [bookedSeats, setBookedSeats] = useState({});
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  // Modal Inputs (Booking)
  const [studentName, setStudentName] = useState("");
  const [studentContact, setStudentContact] = useState("");
  const [bookingStartSeat, setBookingStartSeat] = useState("");
  const [bookingEndSeat, setBookingEndSeat] = useState("");

  // Modal Inputs (Blocking)
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");

  // Modal Inputs (Unblocking)
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [unblockStart, setUnblockStart] = useState("");
  const [unblockEnd, setUnblockEnd] = useState("");

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
    canvasBg: isDarkMode
      ? "rgba(15, 23, 42, 0.72)"
      : "rgba(255, 255, 255, 0.94)",
    canvasBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(219, 234, 254, 0.8)",
    canvasShadow: isDarkMode
      ? "0 20px 50px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)"
      : "0 20px 50px -10px rgba(30, 58, 138, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.9)",
    textPrimary: isDarkMode ? "#f8fafc" : "#0f172a",
    textSecondary: isDarkMode ? "#94a3b8" : "#64748b",
    headerBg: isDarkMode
      ? "rgba(13, 21, 39, 0.9)"
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
    inputBg: isDarkMode ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.9)",
    inputBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.85)",
    inputText: isDarkMode ? "#f8fafc" : "#0f172a",
    inputPlaceholder: isDarkMode ? "#94a3b8" : "#64748b",
    modalCardBg: isDarkMode
      ? "rgba(15, 23, 42, 0.96)"
      : "rgba(255, 255, 255, 0.98)",
    modalBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(219, 234, 254, 0.8)",
    pillBg: isDarkMode ? "rgba(30, 41, 59, 0.85)" : "rgba(255, 255, 255, 0.85)",
    pillBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.8)",
    pillShadow: isDarkMode
      ? "0 10px 25px rgba(0, 0, 0, 0.5)"
      : "0 10px 25px rgba(30, 58, 138, 0.1)",
    pillText: isDarkMode ? "#f8fafc" : "#1e293b",
    stageBg: isDarkMode
      ? "linear-gradient(180deg, rgba(30, 58, 138, 0.35) 0%, rgba(15, 23, 42, 0.9) 100%)"
      : "linear-gradient(180deg, rgba(219, 234, 254, 0.9) 0%, rgba(191, 219, 254, 0.6) 100%)",
    stageBorder: isDarkMode
      ? "1px solid rgba(59, 130, 246, 0.35)"
      : "1px solid rgba(147, 197, 253, 0.9)",
    stageText: isDarkMode ? "#93c5fd" : "#1e40af",
    stageGlow: isDarkMode
      ? "0 0 25px rgba(59, 130, 246, 0.25)"
      : "0 0 20px rgba(37, 99, 235, 0.15)",
  };

  const handlePrintExport = () => {
    window.print();
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowBlockModal(false);
        setShowUnblockModal(false);
        setSelectedSeat(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ----------------------------------------------------------------
  // 1. CONFIGURATION (100% UNTOUCHED)
  // ----------------------------------------------------------------
  const ROW_CONFIG = [
    { id: 1, left: [1, 8], right: [9, 16] },
    { id: 2, left: [17, 25], right: [26, 34] },
    { id: 3, left: [34, 43], right: [44, 53] },
    { id: 4, left: [54, 64], right: [65, 75] },
    { id: 5, left: [76, 87], right: [88, 99] },
    { id: 6, left: [100, 111], right: [112, 123] },
    { id: 7, left: [124, 135], right: [136, 147] },
    { id: 8, left: [148, 159], right: [160, 171] },
    { id: 9, left: [172, 183], right: [184, 195] },
    { id: 10, left: [196, 207], right: [208, 219] },
    { id: 11, left: [220, 231], right: [232, 243] },
    { id: 12, left: [244, 255], right: [256, 267] },
    { id: 13, left: [268, 279], right: [280, 291] },
    { id: 14, left: [292, 303], right: [304, 315] },
    { id: 15, left: [316, 327], right: [328, 339] },
    { id: 16, left: [340, 351], right: [352, 363] },
    { id: 17, left: [364, 375], right: [376, 387] },
    { id: 18, left: [388, 399], right: [400, 411] },
    { id: 19, left: [412, 423], right: [424, 435] },
    { id: 20, left: [436, 447], right: null },
  ];

  // Helper: Find Row ID for a given Seat Number (100% UNTOUCHED)
  const findRowForSeat = (seatNum) => {
    for (const row of ROW_CONFIG) {
      if (
        (row.left && seatNum >= row.left[0] && seatNum <= row.left[1]) ||
        (row.right && seatNum >= row.right[0] && seatNum <= row.right[1])
      ) {
        return row.id;
      }
    }
    return null;
  };

  const getSeatLabel = (rowId, num) => {
    if (rowId === 2 && num === 34) return "34(a)";
    if (rowId === 3 && num === 34) return "34(b)";
    return num.toString();
  };

  const generateSeats = (rowId, range, isRightSide) => {
    if (!range) return [];
    const [start, end] = range;
    let seats = [];
    for (let i = start; i <= end; i++) {
      seats.push({
        row: rowId,
        num: i,
        label: getSeatLabel(rowId, i),
        uniqueId: `seat_${i}_${rowId}`,
        side: isRightSide ? "right" : "left",
      });
    }
    return seats;
  };

  // ----------------------------------------------------------------
  // 2. DATA FETCHING
  // ----------------------------------------------------------------
  useEffect(() => {
    getDoc(doc(db, "events", eventId)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEventData(data);
        if (data.name) setEventName(data.name);
      }
    });

    const unsubscribe = onSnapshot(
      collection(db, "events", eventId, "seats"),
      (snapshot) => {
        const seatData = {};
        snapshot.forEach((d) => {
          seatData[d.id] = d.data();
        });
        setBookedSeats(seatData);
      },
    );
    return () => unsubscribe();
  }, [eventId]);

  // Live Seat Counts
  const totalSeats = 447;
  const bookedCount = Object.values(bookedSeats).filter(
    (s) => s.status === "booked",
  ).length;
  const blockedCount = Object.values(bookedSeats).filter(
    (s) => s.status === "blocked",
  ).length;
  const availableCount = totalSeats - bookedCount - blockedCount;

  // ----------------------------------------------------------------
  // 3. HANDLERS
  // ----------------------------------------------------------------

  // -- BLOCK RANGE --
  const handleBlockSubmit = async (e) => {
    e.preventDefault();
    const start = parseInt(blockStart);
    const end = parseInt(blockEnd);

    if (isNaN(start) || isNaN(end) || start > end) {
      alert("Invalid Range: Start number must be less than or equal to End number.");
      return;
    }

    const batch = writeBatch(db);
    let count = 0;

    for (let i = start; i <= end; i++) {
      const rowId = findRowForSeat(i);
      if (rowId) {
        const uniqueId = `seat_${i}_${rowId}`;
        const seatRef = doc(db, "events", eventId, "seats", uniqueId);

        batch.set(seatRef, {
          label: getSeatLabel(rowId, i),
          status: "blocked",
          bookedAt: new Date(),
        });
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
      setShowBlockModal(false);
      setBlockStart("");
      setBlockEnd("");
    } else {
      alert("No valid seats in that range.");
    }
  };

  // -- UNBLOCK RANGE --
  const handleUnblockSubmit = async (e) => {
    e.preventDefault();
    const start = parseInt(unblockStart);
    const end = parseInt(unblockEnd);

    if (isNaN(start) || isNaN(end) || start > end) {
      alert("Invalid Range: Start number must be less than or equal to End number.");
      return;
    }

    const batch = writeBatch(db);
    let count = 0;

    for (let i = start; i <= end; i++) {
      const rowId = findRowForSeat(i);
      if (rowId) {
        const uniqueId = `seat_${i}_${rowId}`;
        if (bookedSeats[uniqueId]) {
          const seatRef = doc(db, "events", eventId, "seats", uniqueId);
          batch.delete(seatRef);
          count++;
        }
      }
    }

    if (count > 0) {
      await batch.commit();
      setShowUnblockModal(false);
      setUnblockStart("");
      setUnblockEnd("");
    } else {
      alert("No booked or blocked seats found in that range.");
    }
  };

  // -- CLICK SEAT --
  const handleSeatClick = (seat) => {
    const existing = bookedSeats[seat.uniqueId];

    if (existing) {
      if (!isAdmin) {
        alert("This seat is already reserved.");
        return;
      }

      const action = existing.status === "blocked" ? "Unblock" : "Release";
      const name = existing.name ? `booked by ${existing.name}` : "";

      if (window.confirm(`${action} seat ${seat.label} ${name}?`)) {
        deleteDoc(doc(db, "events", eventId, "seats", seat.uniqueId));
      }
    } else {
      // Open Booking Modal (both staff users and admins can book)
      setSelectedSeat(seat);
      setBookingStartSeat(seat.num);
      setBookingEndSeat("");
      setStudentName("");
      setStudentContact("");
    }
  };

  // -- BOOKING SUBMIT --
  const submitBooking = async (e) => {
    e.preventDefault();
    if (!studentName || !studentContact || !bookingStartSeat) return;

    const start = parseInt(bookingStartSeat);
    const end = bookingEndSeat ? parseInt(bookingEndSeat) : start;

    if (start > end) {
      alert("Start seat must be smaller than or equal to end seat.");
      return;
    }

    // Check for collisions with already booked/blocked seats
    const alreadyTaken = [];
    for (let i = start; i <= end; i++) {
      const rowId = findRowForSeat(i);
      if (rowId) {
        const uniqueId = `seat_${i}_${rowId}`;
        if (bookedSeats[uniqueId]) {
          alreadyTaken.push(getSeatLabel(rowId, i));
        }
      }
    }
    if (alreadyTaken.length > 0) {
      alert(
        `Cannot book: Seat(s) ${alreadyTaken.join(", ")} are already booked or blocked!`,
      );
      return;
    }

    try {
      const batch = writeBatch(db);
      let count = 0;
      const staffName =
        userName ||
        user?.displayName ||
        user?.email?.split("@")[0] ||
        "Staff";
      const staffEmail = user?.email || "";
      const staffUid = user?.uid || "";

      for (let i = start; i <= end; i++) {
        const rowId = findRowForSeat(i);
        if (rowId) {
          const uniqueId = `seat_${i}_${rowId}`;
          const seatRef = doc(db, "events", eventId, "seats", uniqueId);
          const seatLabel = getSeatLabel(rowId, i);

          batch.set(seatRef, {
            label: seatLabel,
            name: studentName,
            contact: studentContact,
            status: "booked",
            bookedAt: new Date(),
            bookedByName: staffName,
            bookedByEmail: staffEmail,
            bookedByUid: staffUid,
          });

          // Write activity log for audit trail
          const logRef = doc(collection(db, "events", eventId, "activityLogs"));
          batch.set(logRef, {
            type: "SEAT_BOOKED",
            seatId: uniqueId,
            seatLabel: seatLabel,
            studentName: studentName,
            studentContact: studentContact,
            performedByName: staffName,
            performedByEmail: staffEmail,
            performedByUid: staffUid,
            timestamp: new Date(),
          });

          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        setSelectedSeat(null);
      } else {
        alert("Invalid seat range.");
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // ----------------------------------------------------------------
  // 4. RENDER
  // ----------------------------------------------------------------
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
      {/* Top Universal Navbar */}
      <div className="w-100 d-print-none">
        <Navbar isDarkMode={isDarkMode} />
      </div>

      {/* COMPREHENSIVE STICKY CONTROLS & STATS HEADER */}
      <div
        className="w-100 sticky-top d-print-none"
        style={{
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
          {/* Row 1: Back Navigation, Event Name, and Main Action Buttons */}
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            {/* Left: Back & Event Info */}
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
                  className="text-truncate"
                >
                  {eventName}
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
                  <span>🗺️ Interactive Seating Plan</span>
                  {eventData?.date && <span>• 📅 {eventData.date}</span>}
                  <span>• 📍 447 Capacity</span>
                </div>
              </div>
            </div>

            {/* Right: Actions & Tools */}
            <div className="d-flex align-items-center flex-wrap gap-2">
              {/* Shortcut to Gate Check-In */}
              <button
                type="button"
                onClick={() => navigate(`/checkin/${eventId}`)}
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
                🎟️ Gate Check-In
              </button>

              {/* Export Map Button */}
              <button
                type="button"
                onClick={handlePrintExport}
                style={{
                  background: isDarkMode
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(220, 252, 231, 0.85)",
                  border: isDarkMode
                    ? "1px solid rgba(16, 185, 129, 0.35)"
                    : "1px solid rgba(134, 239, 172, 0.9)",
                  color: isDarkMode ? "#6ee7b7" : "#15803d",
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
                📸 Export / Print Map
              </button>

              {/* Admin Block & Unblock Range Buttons */}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(true)}
                    style={{
                      background: isDarkMode
                        ? "rgba(15, 23, 42, 0.8)"
                        : "rgba(30, 41, 59, 0.9)",
                      border: theme.inputBorder,
                      color: "#ffffff",
                      borderRadius: "12px",
                      padding: "7px 14px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    🚫 Block Range
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUnblockModal(true)}
                    style={{
                      background: isDarkMode
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(254, 226, 226, 0.85)",
                      border: isDarkMode
                        ? "1px solid rgba(239, 68, 68, 0.35)"
                        : "1px solid rgba(252, 165, 165, 0.9)",
                      color: isDarkMode ? "#fca5a5" : "#b91c1c",
                      borderRadius: "12px",
                      padding: "7px 14px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    🔓 Unblock Range
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Live Seat Statistics & Interactive Legend */}
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            {/* Live Counters */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Free Seats */}
              <div
                style={{
                  background: isDarkMode
                    ? "rgba(16, 185, 129, 0.12)"
                    : "rgba(220, 252, 231, 0.8)",
                  border: isDarkMode
                    ? "1px solid rgba(16, 185, 129, 0.28)"
                    : "1px solid rgba(134, 239, 172, 0.8)",
                  borderRadius: "10px",
                  padding: "4px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: isDarkMode ? "#6ee7b7" : "#15803d",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "#198754",
                    boxShadow: "0 0 8px #198754",
                  }}
                />
                <span>Available: {availableCount}</span>
              </div>

              {/* Booked Seats */}
              <div
                style={{
                  background: isDarkMode
                    ? "rgba(239, 68, 68, 0.12)"
                    : "rgba(254, 226, 226, 0.8)",
                  border: isDarkMode
                    ? "1px solid rgba(239, 68, 68, 0.28)"
                    : "1px solid rgba(252, 165, 165, 0.8)",
                  borderRadius: "10px",
                  padding: "4px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: isDarkMode ? "#fca5a5" : "#b91c1c",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "#dc3545",
                    boxShadow: "0 0 8px #dc3545",
                  }}
                />
                <span>Booked: {bookedCount}</span>
              </div>

              {/* Blocked Seats */}
              <div
                style={{
                  background: isDarkMode
                    ? "rgba(148, 163, 184, 0.14)"
                    : "rgba(241, 245, 249, 0.9)",
                  border: isDarkMode
                    ? "1px solid rgba(148, 163, 184, 0.25)"
                    : "1px solid rgba(203, 213, 225, 0.9)",
                  borderRadius: "10px",
                  padding: "4px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: isDarkMode ? "#cbd5e1" : "#475569",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "#6c757d",
                  }}
                />
                <span>Blocked: {blockedCount}</span>
              </div>
            </div>

            {/* Hint for Staff */}
            <div
              style={{
                fontSize: "0.78rem",
                color: theme.textSecondary,
              }}
            >
              💡 Click any green seat to reserve • Click a booked seat to view details / release
            </div>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY HEADER (Only shows on browser print / export) */}
      <div className="d-none d-print-block text-center mb-3">
        <h2>{eventName} - Auditorium Seating Plan</h2>
        <p>GNDEC Cultural Committee • Printed Date: {new Date().toLocaleDateString()}</p>
      </div>

      {/* MAIN SEATING CANVAS WRAPPER */}
      <main className="container-fluid py-4 flex-grow-1 d-flex flex-column align-items-center">
        {/* ILLUMINATED STAGE */}
        <div
          className="text-center mx-auto mb-4"
          style={{
            width: "min(90%, 620px)",
            background: theme.stageBg,
            border: theme.stageBorder,
            boxShadow: theme.stageGlow,
            borderRadius: "16px 16px 36px 36px",
            padding: "14px 20px",
            color: theme.stageText,
            position: "relative",
            overflow: "hidden",
            transition: "all 0.3s ease",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "220px",
              height: "4px",
              background: "linear-gradient(90deg, transparent, #3b82f6, transparent)",
              borderRadius: "2px",
            }}
          />
          <span
            style={{
              fontWeight: 800,
              fontSize: "0.92rem",
              letterSpacing: "2.5px",
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            🎭 STAGE / PODIUM
          </span>
        </div>

        {/* SEATING MAP CANVAS CARD */}
        <div
          className="w-100"
          style={{
            overflowX: "auto",
            paddingBottom: "30px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: theme.canvasBg,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: theme.canvasBorder,
              boxShadow: theme.canvasShadow,
              borderRadius: "24px",
              padding: "28px 24px 36px 24px",
              minWidth: "1020px",
              width: "fit-content",
              margin: "0 auto",
              transition: "background 0.3s ease",
            }}
          >
            {/* THE SEAT GRID ITSELF (100% UNTOUCHED) */}
            <div
              className="d-flex flex-column gap-1 mx-auto"
              style={{
                minWidth: "980px",
                width: "fit-content",
                paddingLeft: "10px",
                paddingRight: "10px",
              }}
            >
              {ROW_CONFIG.map((row) => {
                const leftSeats = generateSeats(row.id, row.left, false);
                const rightSeats = generateSeats(row.id, row.right, true);

                return (
                  <React.Fragment key={row.id}>
                    <div className="d-flex justify-content-center align-items-center">
                      <div
                        className="small me-2"
                        style={{
                          width: "30px",
                          textAlign: "right",
                          color: theme.textSecondary,
                          fontWeight: 600,
                          fontSize: "0.78rem",
                        }}
                      >
                        R{row.id}
                      </div>

                      <div
                        className="d-flex gap-1 justify-content-end"
                        style={{ width: "450px" }}
                      >
                        {leftSeats.map((seat) => (
                          <SeatBox
                            key={seat.uniqueId}
                            seat={seat}
                            data={bookedSeats[seat.uniqueId]}
                            onClick={() => handleSeatClick(seat)}
                            setHover={setHoverInfo}
                          />
                        ))}
                      </div>

                      <div style={{ width: "60px" }}></div>

                      <div
                        className="d-flex gap-1 justify-content-start"
                        style={{ width: "450px" }}
                      >
                        {rightSeats.map((seat) => (
                          <SeatBox
                            key={seat.uniqueId}
                            seat={seat}
                            data={bookedSeats[seat.uniqueId]}
                            onClick={() => handleSeatClick(seat)}
                            setHover={setHoverInfo}
                          />
                        ))}
                      </div>
                    </div>

                    {row.id === 9 && (
                      <div
                        className="w-100 text-center my-4 py-1 small rounded"
                        style={{
                          background: isDarkMode
                            ? "rgba(59, 130, 246, 0.15)"
                            : "rgba(219, 234, 254, 0.8)",
                          border: isDarkMode
                            ? "1px dashed rgba(59, 130, 246, 0.3)"
                            : "1px dashed rgba(147, 197, 253, 0.8)",
                          color: isDarkMode ? "#93c5fd" : "#1d4ed8",
                          fontWeight: 700,
                          letterSpacing: "1px",
                        }}
                      >
                        WALKWAY
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* ---------------------------------------------------------------- */}
      {/* FROSTED GLASS OVERLAY MODALS (REPLACED BOOTSTRAP MODALS)        */}
      {/* ---------------------------------------------------------------- */}

      {/* 1. BOOKING MODAL */}
      {selectedSeat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSeat(null);
          }}
        >
          <div
            style={{
              background: theme.modalCardBg,
              border: theme.modalBorder,
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "480px",
              width: "100%",
              overflow: "hidden",
              position: "relative",
              color: theme.textPrimary,
              animation: "seatingModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <style>{`
              @keyframes seatingModalPop {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>

            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: theme.canvasBorder,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "1.2rem" }}>🎟️</span>
                <h5 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem" }}>
                  Reserve Seat {selectedSeat.label}
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSeat(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: theme.textSecondary,
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "24px" }}>
              <form onSubmit={submitBooking}>
                {/* Seat Range Inputs */}
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        marginBottom: "4px",
                        color: theme.textPrimary,
                      }}
                    >
                      Start Seat #
                    </label>
                    <input
                      type="number"
                      required
                      value={bookingStartSeat}
                      onChange={(e) => setBookingStartSeat(e.target.value)}
                      style={{
                        width: "100%",
                        background: theme.inputBg,
                        border: theme.inputBorder,
                        borderRadius: "12px",
                        padding: "9px 12px",
                        color: theme.inputText,
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div className="col-6">
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        marginBottom: "4px",
                        color: theme.textPrimary,
                      }}
                    >
                      End Seat # <span style={{ color: theme.textSecondary, fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Single seat"
                      value={bookingEndSeat}
                      onChange={(e) => setBookingEndSeat(e.target.value)}
                      style={{
                        width: "100%",
                        background: theme.inputBg,
                        border: theme.inputBorder,
                        borderRadius: "12px",
                        padding: "9px 12px",
                        color: theme.inputText,
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "0.78rem",
                    color: isDarkMode ? "#93c5fd" : "#2563eb",
                    marginBottom: "16px",
                    background: isDarkMode
                      ? "rgba(30, 58, 138, 0.25)"
                      : "rgba(219, 234, 254, 0.7)",
                    padding: "8px 12px",
                    borderRadius: "10px",
                  }}
                >
                  ℹ️ Leave <strong>End Seat</strong> blank to book just seat #{bookingStartSeat}.
                </div>

                {/* Student Name */}
                <div className="mb-3">
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: theme.textPrimary,
                    }}
                  >
                    Guest / Student Full Name
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Jaspreet Singh"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    style={{
                      width: "100%",
                      background: theme.inputBg,
                      border: theme.inputBorder,
                      borderRadius: "12px",
                      padding: "10px 14px",
                      color: theme.inputText,
                      fontSize: "0.92rem",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Contact Number */}
                <div className="mb-4">
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: theme.textPrimary,
                    }}
                  >
                    Phone / Contact Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9876543210"
                    value={studentContact}
                    onChange={(e) => setStudentContact(e.target.value)}
                    style={{
                      width: "100%",
                      background: theme.inputBg,
                      border: theme.inputBorder,
                      borderRadius: "12px",
                      padding: "10px 14px",
                      color: theme.inputText,
                      fontSize: "0.92rem",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Submit & Cancel */}
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSeat(null)}
                    style={{
                      flex: 1,
                      background: isDarkMode
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.05)",
                      border: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: "12px",
                      padding: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 2,
                      background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      border: "none",
                      color: "#ffffff",
                      borderRadius: "12px",
                      padding: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 4px 15px rgba(37, 99, 235, 0.35)",
                    }}
                  >
                    {bookingEndSeat ? "Confirm Multi-Booking" : "Confirm Booking"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2. BLOCK RANGE MODAL */}
      {showBlockModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBlockModal(false);
          }}
        >
          <div
            style={{
              background: theme.modalCardBg,
              border: theme.modalBorder,
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "460px",
              width: "100%",
              overflow: "hidden",
              position: "relative",
              color: theme.textPrimary,
              animation: "seatingModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: theme.canvasBorder,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "1.2rem" }}>🚫</span>
                <h5 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem" }}>
                  Block Seat Range
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: theme.textSecondary,
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "24px" }}>
              <p style={{ fontSize: "0.84rem", color: theme.textSecondary, marginBottom: "16px" }}>
                Blocked seats are marked as unavailable for general booking (ideal for VIPs, sound team, or faculty).
              </p>

              <form onSubmit={handleBlockSubmit}>
                <div className="row g-2 mb-4">
                  <div className="col-6">
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        marginBottom: "4px",
                        color: theme.textPrimary,
                      }}
                    >
                      Start Seat #
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 1"
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                      style={{
                        width: "100%",
                        background: theme.inputBg,
                        border: theme.inputBorder,
                        borderRadius: "12px",
                        padding: "9px 12px",
                        color: theme.inputText,
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div className="col-6">
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        marginBottom: "4px",
                        color: theme.textPrimary,
                      }}
                    >
                      End Seat #
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 16"
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                      style={{
                        width: "100%",
                        background: theme.inputBg,
                        border: theme.inputBorder,
                        borderRadius: "12px",
                        padding: "9px 12px",
                        color: theme.inputText,
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(false)}
                    style={{
                      flex: 1,
                      background: isDarkMode
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.05)",
                      border: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: "12px",
                      padding: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 2,
                      background: isDarkMode
                        ? "linear-gradient(135deg, #374151 0%, #1f2937 100%)"
                        : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                      border: "none",
                      color: "#ffffff",
                      borderRadius: "12px",
                      padding: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    Block Range
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. UNBLOCK / RELEASE RANGE MODAL */}
      {showUnblockModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUnblockModal(false);
          }}
        >
          <div
            style={{
              background: theme.modalCardBg,
              border: theme.modalBorder,
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "460px",
              width: "100%",
              overflow: "hidden",
              position: "relative",
              color: theme.textPrimary,
              animation: "seatingModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: theme.canvasBorder,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "1.2rem" }}>🔓</span>
                <h5 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem" }}>
                  Unblock & Release Range
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setShowUnblockModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: theme.textSecondary,
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "24px" }}>
              <div
                style={{
                  background: isDarkMode
                    ? "rgba(239, 68, 68, 0.15)"
                    : "rgba(254, 226, 226, 0.8)",
                  border: isDarkMode
                    ? "1px solid rgba(239, 68, 68, 0.3)"
                    : "1px solid rgba(252, 165, 165, 0.9)",
                  color: isDarkMode ? "#fca5a5" : "#b91c1c",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  fontSize: "0.82rem",
                  marginBottom: "16px",
                  lineHeight: 1.4,
                }}
              >
                ⚠️ <strong>Warning:</strong> Releasing this range will delete any active bookings or blocks within these seat numbers, restoring them to available.
              </div>

              <form onSubmit={handleUnblockSubmit}>
                <div className="row g-2 mb-4">
                  <div className="col-6">
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        marginBottom: "4px",
                        color: theme.textPrimary,
                      }}
                    >
                      Start Seat #
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 1"
                      value={unblockStart}
                      onChange={(e) => setUnblockStart(e.target.value)}
                      style={{
                        width: "100%",
                        background: theme.inputBg,
                        border: theme.inputBorder,
                        borderRadius: "12px",
                        padding: "9px 12px",
                        color: theme.inputText,
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div className="col-6">
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        marginBottom: "4px",
                        color: theme.textPrimary,
                      }}
                    >
                      End Seat #
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 16"
                      value={unblockEnd}
                      onChange={(e) => setUnblockEnd(e.target.value)}
                      style={{
                        width: "100%",
                        background: theme.inputBg,
                        border: theme.inputBorder,
                        borderRadius: "12px",
                        padding: "9px 12px",
                        color: theme.inputText,
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUnblockModal(false)}
                    style={{
                      flex: 1,
                      background: isDarkMode
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.05)",
                      border: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: "12px",
                      padding: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 2,
                      background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                      border: "none",
                      color: "#ffffff",
                      borderRadius: "12px",
                      padding: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 4px 15px rgba(220, 38, 38, 0.35)",
                    }}
                  >
                    Unblock Seats
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* FROSTED TOOLTIP                                                  */}
      {/* ---------------------------------------------------------------- */}
      {hoverInfo && (
        <div
          className="position-absolute shadow text-center d-print-none"
          style={{
            top: hoverInfo.y,
            left: hoverInfo.x,
            zIndex: 1000,
            pointerEvents: "none",
            transform: "translate(-50%, -100%)",
            marginTop: "-12px",
            minWidth: "170px",
            background: isDarkMode
              ? "rgba(15, 23, 42, 0.92)"
              : "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: isDarkMode
              ? "1px solid rgba(255, 255, 255, 0.12)"
              : "1px solid rgba(203, 213, 225, 0.85)",
            borderRadius: "12px",
            padding: "8px 12px",
            color: isDarkMode ? "#f8fafc" : "#0f172a",
            boxShadow: isDarkMode
              ? "0 12px 30px rgba(0, 0, 0, 0.6)"
              : "0 12px 30px rgba(30, 58, 138, 0.15)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>
            👤 {hoverInfo.data.name || "Blocked"}
          </div>
          {hoverInfo.data.contact && (
            <div
              style={{
                fontSize: "0.78rem",
                color: isDarkMode ? "#fbbf24" : "#d97706",
                marginTop: "2px",
              }}
            >
              📞 {hoverInfo.data.contact}
            </div>
          )}
          {hoverInfo.data.bookedByName && (
            <div
              style={{
                fontSize: "0.74rem",
                color: isDarkMode ? "#60a5fa" : "#2563eb",
                marginTop: "4px",
              }}
            >
              Booked by: <strong>{hoverInfo.data.bookedByName}</strong>
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div className="w-100 d-print-none" style={{ marginTop: "auto" }}>
        <Footer isDarkMode={isDarkMode} />
      </div>

      {/* FLOATING THEME SWITCHER */}
      <div
        className="d-print-none"
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

// ----------------------------------------------------------------
// SUB-COMPONENT: SEAT BOX (100% UNTOUCHED)
// ----------------------------------------------------------------
function SeatBox({ seat, data, onClick, setHover }) {
  const isBlocked = data && data.status === "blocked";
  const isBooked = data && !isBlocked;

  // 2. Admin Blocked
  if (isBlocked) {
    return (
      <div
        onClick={onClick}
        className="seat-base"
        style={{ backgroundColor: "#6c757d", cursor: "pointer" }}
      >
        {seat.label}
      </div>
    );
  }

  // 3. Booked / Available
  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => {
        if (isBooked) {
          const rect = e.target.getBoundingClientRect();
          setHover({
            x: rect.left + rect.width / 2 + window.scrollX,
            y: rect.top + window.scrollY,
            data: data,
          });
        }
      }}
      onMouseLeave={() => setHover(null)}
      className="seat-base"
      style={{
        backgroundColor: isBooked ? "#dc3545" : "#198754",
        cursor: "pointer",
        boxShadow: isBooked ? "inset 0 0 5px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {seat.label}
    </div>
  );
}

// CSS helper (100% UNTOUCHED)
const seatStyles = `
  .seat-base {
    width: 30px; 
    height: 30px; 
    border-radius: 4px;
    display: flex;
    align-items: center; 
    justify-content: center;
    color: white;
    font-size: 10px; 
    font-weight: bold;
    user-select: none;
    transition: transform 0.1s;
  }
  .seat-base:active {
    transform: scale(0.95);
  }

  /* PRINT / EXPORT STYLES */
  @media print {
    .d-print-none { display: none !important; }
    .d-print-block { display: block !important; }
    
    /* Forces background colors (Green/Red) to show */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    
    /* Set Landscape and remove margins */
    @page { size: landscape; margin: 5mm; }
    body, .bg-light { background-color: white !important; }
    
    /* Ensure the map doesn't get cut off */
    .w-100 { overflow: visible !important; }
  }
`;

if (!document.getElementById("seat-styles")) {
  const style = document.createElement("style");
  style.id = "seat-styles";
  style.innerHTML = seatStyles;
  document.head.appendChild(style);
}

export default SeatingPage;
