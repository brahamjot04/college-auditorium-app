import { useState, useEffect, useRef } from "react";
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
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import Navbar from "./Navbar";
import Footer from "./Footer";
import EventBrandingModal from "./EventBrandingModal";
import { exportToCsv } from "./utils/exportCsv";
import { Html5Qrcode } from "html5-qrcode";
import { playSuccessChime, playWarningTone } from "./utils/audioFeedback";
import { sendGatePassEmail, generateQrDataUrl } from "./utils/emailService";

function CheckInPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, userName, isAdmin } = useAuth();

  const [attendees, setAttendees] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [systemConfig, setSystemConfig] = useState(null);
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // "all" | "pending" | "checked_in"
  const [syncingId, setSyncingId] = useState(null);

  // Live Camera Scanner State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  const lastScannedRef = useRef("");

  // Edit Booking Modal State
  const [editingSeat, setEditingSeat] = useState(null);
  const [editGuestName, setEditGuestName] = useState("");
  const [editGuestContact, setEditGuestContact] = useState("");
  const [editGuestEmail, setEditGuestEmail] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSaveSuccess, setEditSaveSuccess] = useState(false);
  const [isResendingPass, setIsResendingPass] = useState(false);
  const [resendPassMsg, setResendPassMsg] = useState(null);

  // Custom Cancellation Popup State
  const [cancelingSeat, setCancelingSeat] = useState(null);
  const [cancelReason, setCancelReason] = useState("Guest Request");
  const [cancelNotes, setCancelNotes] = useState("");
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);

  // Dropdown menu state (Admin Tools)
  const [showAdminMenu, setShowAdminMenu] = useState(false);

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

  // 1. Fetch Event Info (Real-time) & System Config
  useEffect(() => {
    const unsubEvent = onSnapshot(doc(db, "events", eventId), (docSnap) => {
      if (docSnap.exists()) {
        setEventData(docSnap.data());
      }
    });

    getDoc(doc(db, "system_settings", "config"))
      .then((snap) => {
        if (snap.exists()) setSystemConfig(snap.data());
      })
      .catch((err) => console.warn("Could not load system config in checkin:", err));

    return () => unsubEvent();
  }, [eventId]);

  // Close admin tools menu on click outside or Escape
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest("[data-checkin-admin-menu]")) {
        setShowAdminMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowAdminMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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

  // 5. Handle Live QR Scanner Result
  const handleQrScanResult = async (decodedText) => {
    if (!decodedText) return;

    // Throttle duplicate reads
    if (lastScannedRef.current === decodedText) return;
    lastScannedRef.current = decodedText;
    setTimeout(() => {
      lastScannedRef.current = "";
    }, 3800);

    let targetSeatId = "";
    let targetToken = "";

    try {
      if (decodedText.includes("/pass/")) {
        const url = new URL(decodedText, window.location.origin);
        const parts = url.pathname.split("/pass/")[1]?.split("/") || [];
        const passEventId = parts[0];
        targetSeatId = parts[1];
        targetToken = url.searchParams.get("token") || "";

        if (passEventId && passEventId !== eventId) {
          playWarningTone();
          setScanFeedback({
            type: "error",
            message: "Pass belongs to a different event!",
          });
          return;
        }
      } else {
        targetSeatId = decodedText.trim();
      }
    } catch {
      targetSeatId = decodedText.trim();
    }

    if (!targetSeatId) {
      playWarningTone();
      setScanFeedback({
        type: "error",
        message: "Unrecognized QR code format.",
      });
      return;
    }

    // Match attendee by ID or Label
    const attendee = attendees.find(
      (a) =>
        a.id === targetSeatId ||
        a.label?.toLowerCase() === targetSeatId.toLowerCase() ||
        a.id?.toLowerCase().includes(targetSeatId.toLowerCase()),
    );

    if (!attendee) {
      playWarningTone();
      setScanFeedback({
        type: "error",
        message: `No active reservation found for ${targetSeatId}.`,
      });
      return;
    }

    // Check if already checked in
    if (attendee.hasCheckedIn) {
      playWarningTone();
      if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
      const timeStr = attendee.checkInTime?.toDate
        ? attendee.checkInTime.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "earlier";
      setScanFeedback({
        type: "warning",
        seatLabel: attendee.label,
        guestName: attendee.name,
        message: `ALREADY CHECKED IN at ${timeStr} ${attendee.checkedInByName ? `by ${attendee.checkedInByName}` : ""}`,
      });
      return;
    }

    // Security Token Check: require matching token whenever a passToken exists
    if (attendee.passToken && (!targetToken || attendee.passToken !== targetToken)) {
      playWarningTone();
      setScanFeedback({
        type: "error",
        message: "Invalid or missing pass security token.",
      });
      return;
    }

    // Admit Guest
    const staffName =
      userName ||
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Staff";
    const staffEmail = user?.email || "";
    const staffUid = user?.uid || "";

    try {
      await setDoc(
        doc(db, "events", eventId, "seats", attendee.id),
        {
          hasCheckedIn: true,
          checkInTime: serverTimestamp(),
          checkedInByName: staffName,
          checkedInByEmail: staffEmail,
          checkedInByUid: staffUid,
        },
        { merge: true },
      );

      await addDoc(collection(db, "events", eventId, "activityLogs"), {
        type: "GATE_CHECK_IN",
        seatId: attendee.id,
        seatLabel: attendee.label,
        studentName: attendee.name,
        studentContact: attendee.contact,
        performedByName: staffName,
        performedByEmail: staffEmail,
        performedByUid: staffUid,
        timestamp: serverTimestamp(),
      });

      playSuccessChime();
      if (navigator.vibrate) navigator.vibrate(80);

      setScanFeedback({
        type: "success",
        seatLabel: attendee.label,
        guestName: attendee.name,
        message: "ACCESS GRANTED — ADMITTED",
      });
    } catch (err) {
      console.error("Failed to admit via scanner:", err);
      setScanFeedback({
        type: "error",
        message: "Admit failed: " + err.message,
      });
    }
  };

  const handleQrScanResultRef = useRef(handleQrScanResult);
  handleQrScanResultRef.current = handleQrScanResult;

  // 5b. Input Validation & Sanitization Helpers
  const isValidEmail = (email) =>
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());

  const preventNonNumeric = (e) => {
    if (
      !/[0-9]/.test(e.key) &&
      !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key)
    ) {
      e.preventDefault();
    }
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowScannerModal(false);
        setEditingSeat(null);
        setCancelingSeat(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 5c. Handle Save Edit Booking
  const handleSaveEditBooking = async (e) => {
    e.preventDefault();
    if (!editingSeat) return;

    if (
      !editGuestName.trim() ||
      !editGuestContact.trim() ||
      !editGuestEmail.trim()
    ) {
      alert("Please fill in all required fields (Name, Contact, and Email).");
      return;
    }

    if (editGuestContact.trim().length !== 10) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }

    if (!isValidEmail(editGuestEmail)) {
      alert(
        "Please enter a valid email address with a domain (e.g. name@domain.com or name@college.ac.in).",
      );
      return;
    }

    setIsSavingEdit(true);
    setEditSaveSuccess(false);

    const staffName =
      userName ||
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Staff";
    const staffEmail = user?.email || "";
    const staffUid = user?.uid || "";

    try {
      await updateDoc(doc(db, "events", eventId, "seats", editingSeat.id), {
        name: editGuestName.trim(),
        contact: editGuestContact.trim(),
        email: editGuestEmail.trim(),
        updatedAt: serverTimestamp(),
        updatedByName: staffName,
        updatedByEmail: staffEmail,
        updatedByUid: staffUid,
      });

      await addDoc(collection(db, "events", eventId, "activityLogs"), {
        type: "SEAT_UPDATED",
        seatId: editingSeat.id,
        seatLabel: editingSeat.label,
        studentName: editGuestName.trim(),
        studentContact: editGuestContact.trim(),
        studentEmail: editGuestEmail.trim(),
        performedByName: staffName,
        performedByEmail: staffEmail,
        performedByUid: staffUid,
        timestamp: serverTimestamp(),
      });

      setEditSaveSuccess(true);
      setTimeout(() => setEditSaveSuccess(false), 3500);
    } catch (err) {
      console.error("Save edit error in checkin:", err);
      alert("Failed to save changes: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 5d. Handle Re-send Gate Pass Email
  const handleResendPassEmail = async () => {
    if (!editingSeat || isResendingPass) return;

    const emailToSend = editGuestEmail.trim() || editingSeat.email;
    const nameToSend = editGuestName.trim() || editingSeat.name;
    const contactToSend = editGuestContact.trim() || editingSeat.contact;

    if (!isValidEmail(emailToSend)) {
      alert("Please enter a valid email address with a domain before sending.");
      return;
    }

    setIsResendingPass(true);
    setResendPassMsg(null);

    const passUrl = `${window.location.origin}/pass/${eventId}/${editingSeat.id}?token=${editingSeat.passToken || ""}`;
    const qrDataUrl = await generateQrDataUrl(passUrl);

    try {
      const res = await sendGatePassEmail({
        emailConfig: systemConfig?.email || {},
        brandingConfig: {
          ...(systemConfig?.branding || {}),
          ...(eventData?.branding || {}),
        },
        eventName: eventData?.name || "Auditorium Event",
        eventDate: eventData?.date || "",
        eventTime: eventData?.time || "10:00 AM",
        venue: eventData?.venue || "GNDEC Main Auditorium, Ludhiana",
        guestName: nameToSend,
        guestEmail: emailToSend,
        guestContact: contactToSend,
        seatLabel: editingSeat.label,
        passUrl,
        qrDataUrl,
      });

      if (res.success) {
        setResendPassMsg({
          type: "success",
          text: `✓ Pass email dispatched to ${emailToSend}!`,
        });
      } else {
        setResendPassMsg({
          type: "error",
          text: res.error || "Failed to dispatch email.",
        });
      }
    } catch (err) {
      setResendPassMsg({ type: "error", text: err.message });
    } finally {
      setIsResendingPass(false);
    }
  };

  // 5e. Handle Confirm Cancellation
  const handleConfirmCancellation = async () => {
    if (!cancelingSeat || isProcessingCancel) return;

    setIsProcessingCancel(true);
    const staffName =
      userName ||
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Staff";
    const staffEmail = user?.email || "";
    const staffUid = user?.uid || "";

    try {
      await deleteDoc(doc(db, "events", eventId, "seats", cancelingSeat.id));

      await addDoc(collection(db, "events", eventId, "activityLogs"), {
        type: "SEAT_RELEASED",
        seatId: cancelingSeat.id,
        seatLabel: cancelingSeat.label,
        studentName: cancelingSeat.name || null,
        studentContact: cancelingSeat.contact || null,
        studentEmail: cancelingSeat.email || null,
        reason: cancelReason,
        notes: cancelNotes.trim() || null,
        performedByName: staffName,
        performedByEmail: staffEmail,
        performedByUid: staffUid,
        timestamp: serverTimestamp(),
      });

      setCancelingSeat(null);
      setEditingSeat(null);
      setCancelNotes("");
      setCancelReason("Guest Request");
    } catch (err) {
      console.error("Cancel booking error in checkin:", err);
      alert("Failed to cancel booking: " + err.message);
    } finally {
      setIsProcessingCancel(false);
    }
  };

  // 6. Camera Scanner Lifecycle
  useEffect(() => {
    let html5QrCode = null;

    if (showScannerModal) {
      setScanFeedback(null);
      const timer = setTimeout(() => {
        try {
          html5QrCode = new Html5Qrcode("qr-reader-container");
          html5QrCode
            .start(
              { facingMode: "environment" },
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
              },
              (decodedText) => {
                if (handleQrScanResultRef.current) {
                  handleQrScanResultRef.current(decodedText);
                }
              },
              () => {
                // frame error - ignore
              },
            )
            .catch((err) => {
              console.error("Camera start error:", err);
              setScanFeedback({
                type: "error",
                message:
                  "Could not access camera. Please allow camera permissions in your browser.",
              });
            });
        } catch (err) {
          console.error("Scanner instantiation error:", err);
        }
      }, 350);

      return () => {
        clearTimeout(timer);
        if (html5QrCode) {
          try {
            html5QrCode
              .stop()
              .then(() => html5QrCode.clear())
              .catch(() => {});
          } catch {
            // ignore
          }
        }
      };
    }
  }, [showScannerModal]);

  // 7. Export Attendance to CSV
  const handleExportAttendanceCsv = () => {
    if (attendees.length === 0) {
      alert("No booked attendees to export.");
      return;
    }

    const headers = [
      { key: "seatLabel", label: "Seat Label" },
      { key: "guestName", label: "Guest Name" },
      { key: "contact", label: "Contact Number" },
      { key: "checkInStatus", label: "Attendance Status" },
      { key: "checkInTimeFormatted", label: "Check-In Time" },
      { key: "checkedInByName", label: "Admitted By (Staff)" },
      { key: "bookedByName", label: "Reserved By" },
    ];

    const rows = attendees.map((a) => {
      let checkInTimeFormatted = "-";
      if (a.checkInTime) {
        const d = a.checkInTime.toDate
          ? a.checkInTime.toDate()
          : new Date(a.checkInTime);
        if (!isNaN(d.getTime())) {
          checkInTimeFormatted = d.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
      }

      return {
        seatLabel: a.label || a.id,
        guestName: a.name || "N/A",
        contact: a.contact || "N/A",
        checkInStatus: a.hasCheckedIn ? "Checked In" : "Pending",
        checkInTimeFormatted,
        checkedInByName: a.checkedInByName || (a.hasCheckedIn ? "Staff" : "-"),
        bookedByName: a.bookedByName || "-",
      };
    });

    const safeEventName = (eventData?.name || "Auditorium_Event").replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );
    const filename = `${safeEventName}_Gate_Attendance_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    exportToCsv(filename, headers, rows);
  };

  // 6. Filter Logic (Search + Status Filter)
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
          zIndex: 1010,
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

            {/* Quick Actions (Scan QR, Map, Export CSV, Activity Logs) */}
            <div className="d-flex align-items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowScannerModal(true)}
                style={{
                  background: isDarkMode
                    ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                    : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "12px",
                  padding: "7px 16px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
                  transition: "all 0.2s ease",
                }}
              >
                <span>📷</span>
                <span>Scan QR Pass</span>
              </button>

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
                🗺️ Seating Map
              </button>

              <button
                type="button"
                onClick={handleExportAttendanceCsv}
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
                📥 Export Attendance (CSV)
              </button>

              {/* Smart Dropdown: Admin Tools */}
              {isAdmin && (
                <div className="position-relative" data-checkin-admin-menu="true">
                  <button
                    type="button"
                    onClick={() => setShowAdminMenu((prev) => !prev)}
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
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span>⚙️ Admin Tools</span>
                    <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>▾</span>
                  </button>

                  {showAdminMenu && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        zIndex: 100,
                        minWidth: "210px",
                        background: isDarkMode ? "#1e293b" : "#ffffff",
                        border: isDarkMode
                          ? "1px solid rgba(255, 255, 255, 0.14)"
                          : "1px solid rgba(0, 0, 0, 0.1)",
                        borderRadius: "14px",
                        boxShadow: isDarkMode
                          ? "0 12px 30px rgba(0, 0, 0, 0.55)"
                          : "0 12px 30px rgba(0, 0, 0, 0.12)",
                        padding: "6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        animation: "fadeIn 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: theme.textSecondary,
                          padding: "6px 10px 3px",
                        }}
                      >
                        Event Management
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminMenu(false);
                          navigate(`/logs/${eventId}`);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "transparent",
                          border: "none",
                          color: theme.textPrimary,
                          fontSize: "0.82rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDarkMode
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <span>📜</span>
                        <span>Activity Logs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminMenu(false);
                          setShowBrandingModal(true);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "transparent",
                          border: "none",
                          color: theme.textPrimary,
                          fontSize: "0.82rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDarkMode
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <span>🎨</span>
                        <span>Pass Branding</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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

                        {/* Action buttons & Status Chip */}
                        <div className="d-flex align-items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSeat(person);
                              setEditGuestName(person.name || "");
                              setEditGuestContact(person.contact || "");
                              setEditGuestEmail(person.email || "");
                              setEditSaveSuccess(false);
                              setResendPassMsg(null);
                            }}
                            style={{
                              background: isDarkMode
                                ? "rgba(255, 255, 255, 0.08)"
                                : "rgba(0, 0, 0, 0.05)",
                              border: theme.inputBorder,
                              color: theme.textPrimary,
                              borderRadius: "10px",
                              padding: "4px 9px",
                              fontSize: "0.74rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "all 0.2s ease",
                            }}
                            title="Edit guest reservation details"
                          >
                            <span>✏️</span>
                            <span>Edit</span>
                          </button>

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

                        {person.email && (
                          <div className="d-flex align-items-center gap-2 mt-1">
                            <span style={{ fontSize: "0.82rem" }}>✉️</span>
                            <span
                              style={{
                                fontSize: "0.8rem",
                                color: theme.textSecondary,
                              }}
                              className="text-truncate"
                              title={person.email}
                            >
                              {person.email}
                            </span>
                          </div>
                        )}
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

      {/* LIVE CAMERA QR SCANNER MODAL */}
      {showScannerModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowScannerModal(false);
          }}
        >
          <div
            style={{
              background: theme.cardBg,
              border: theme.cardBorder,
              borderRadius: "28px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8)",
              maxWidth: "460px",
              width: "100%",
              overflow: "hidden",
              position: "relative",
              color: theme.textPrimary,
              animation: "scannerModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <style>{`
              @keyframes scannerModalPop {
                from { opacity: 0; transform: scale(0.95) translateY(12px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
              #qr-reader-container video {
                border-radius: 18px !important;
                object-fit: cover !important;
              }
              #qr-reader-container__scan_region {
                border-radius: 18px !important;
              }
            `}</style>

            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: theme.cardBorder,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: isDarkMode
                  ? "rgba(15, 23, 42, 0.6)"
                  : "rgba(241, 245, 249, 0.8)",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "1.3rem" }}>📷</span>
                <div>
                  <h5 style={{ margin: 0, fontWeight: 700, fontSize: "1.05rem" }}>
                    Live Gate Pass Scanner
                  </h5>
                  <div style={{ fontSize: "0.78rem", color: theme.textSecondary }}>
                    Point camera at attendee QR code for instant entry
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScannerModal(false)}
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

            {/* Scanner Body */}
            <div style={{ padding: "20px 24px" }}>
              {/* Camera Video Target */}
              <div
                id="qr-reader-container"
                style={{
                  width: "100%",
                  maxWidth: "380px",
                  margin: "0 auto",
                  borderRadius: "18px",
                  overflow: "hidden",
                  background: "#000000",
                  minHeight: "260px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                }}
              />

              {/* Real-Time Scan Feedback Banner */}
              {scanFeedback && (
                <div
                  style={{
                    marginTop: "16px",
                    borderRadius: "16px",
                    padding: "14px 16px",
                    textAlign: "center",
                    animation: "scannerModalPop 0.2s ease",
                    background:
                      scanFeedback.type === "success"
                        ? "rgba(16, 185, 129, 0.16)"
                        : scanFeedback.type === "warning"
                          ? "rgba(245, 158, 11, 0.18)"
                          : "rgba(239, 68, 68, 0.16)",
                    border: `1.5px solid ${
                      scanFeedback.type === "success"
                        ? "#10b981"
                        : scanFeedback.type === "warning"
                          ? "#f59e0b"
                          : "#ef4444"
                    }`,
                    color:
                      scanFeedback.type === "success"
                        ? "#10b981"
                        : scanFeedback.type === "warning"
                          ? "#d97706"
                          : "#ef4444",
                  }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>
                    {scanFeedback.type === "success"
                      ? "✅"
                      : scanFeedback.type === "warning"
                        ? "⚠️"
                        : "❌"}
                  </div>

                  {scanFeedback.seatLabel && (
                    <div
                      style={{
                        display: "inline-block",
                        background:
                          scanFeedback.type === "success" ? "#10b981" : "#d97706",
                        color: "#ffffff",
                        padding: "3px 12px",
                        borderRadius: "12px",
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        marginBottom: "4px",
                      }}
                    >
                      {scanFeedback.seatLabel}
                    </div>
                  )}

                  {scanFeedback.guestName && (
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        color: theme.textPrimary,
                        marginBottom: "2px",
                      }}
                    >
                      {scanFeedback.guestName}
                    </div>
                  )}

                  <div style={{ fontWeight: 700, fontSize: "0.86rem" }}>
                    {scanFeedback.message}
                  </div>
                </div>
              )}

              <div
                style={{
                  fontSize: "0.76rem",
                  color: theme.textSecondary,
                  textAlign: "center",
                  marginTop: "16px",
                  lineHeight: 1.4,
                }}
              >
                Continuous scanning active • Scanned passes automatically update attendance and audit logs.
              </div>

              <button
                type="button"
                onClick={() => setShowScannerModal(false)}
                style={{
                  width: "100%",
                  marginTop: "14px",
                  background: isDarkMode
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.06)",
                  border: theme.inputBorder,
                  color: theme.textPrimary,
                  borderRadius: "14px",
                  padding: "10px",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                }}
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BOOKING MODAL */}
      {editingSeat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.78)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingSeat(null);
          }}
        >
          <div
            style={{
              background: isDarkMode
                ? "rgba(15, 23, 42, 0.96)"
                : "rgba(255, 255, 255, 0.98)",
              border: isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.12)"
                : "1px solid rgba(219, 234, 254, 0.8)",
              borderRadius: "26px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "480px",
              width: "100%",
              overflow: "hidden",
              position: "relative",
              color: theme.textPrimary,
              animation: "checkinModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: isDarkMode
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(219, 234, 254, 0.8)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "1.2rem" }}>✏️</span>
                <div>
                  <h5 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem" }}>
                    Edit Reservation - Seat {editingSeat.label}
                  </h5>
                  <div style={{ fontSize: "0.76rem", color: theme.textSecondary }}>
                    Update attendee contact or re-send gate pass
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSeat(null)}
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
              {/* Success Notification Banner */}
              {editSaveSuccess && (
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    color: "#10b981",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    marginBottom: "16px",
                  }}
                >
                  ✓ Reservation details updated successfully!
                </div>
              )}

              {/* Resend Pass Email Message */}
              {resendPassMsg && (
                <div
                  style={{
                    background:
                      resendPassMsg.type === "success"
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                    border:
                      resendPassMsg.type === "success"
                        ? "1px solid rgba(16, 185, 129, 0.4)"
                        : "1px solid rgba(239, 68, 68, 0.4)",
                    color: resendPassMsg.type === "success" ? "#10b981" : "#ef4444",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    marginBottom: "16px",
                  }}
                >
                  {resendPassMsg.text}
                </div>
              )}

              {/* Checked-In Status Notice */}
              {editingSeat.hasCheckedIn && (
                <div
                  style={{
                    background: isDarkMode
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(220, 252, 231, 0.8)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    color: isDarkMode ? "#6ee7b7" : "#15803d",
                    borderRadius: "12px",
                    padding: "9px 12px",
                    fontSize: "0.8rem",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>✓</span>
                  <span>
                    Guest is already admitted / checked in at the gate
                    {editingSeat.checkedInByName ? ` by ${editingSeat.checkedInByName}` : ""}.
                  </span>
                </div>
              )}

              <form onSubmit={handleSaveEditBooking}>
                {/* Guest Name */}
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
                    Guest / Student Full Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editGuestName}
                    onChange={(e) => setEditGuestName(e.target.value)}
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
                    Phone / Contact Number (10 digits) <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    placeholder="e.g. 9876543210"
                    value={editGuestContact}
                    onKeyDown={preventNonNumeric}
                    onChange={(e) =>
                      setEditGuestContact(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    style={{
                      width: "100%",
                      background: theme.inputBg,
                      border:
                        editGuestContact.length > 0 && editGuestContact.length < 10
                          ? "1px solid #ef4444"
                          : theme.inputBorder,
                      borderRadius: "12px",
                      padding: "10px 14px",
                      color: theme.inputText,
                      fontSize: "0.92rem",
                      outline: "none",
                    }}
                  />
                  {editGuestContact.length > 0 && editGuestContact.length < 10 && (
                    <div
                      style={{
                        fontSize: "0.74rem",
                        color: "#ef4444",
                        marginTop: "4px",
                      }}
                    >
                      Must be strictly 10 digits (currently {editGuestContact.length})
                    </div>
                  )}
                </div>

                {/* Email Address */}
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
                    Email Address <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jaspreet@example.com"
                    value={editGuestEmail}
                    onChange={(e) => setEditGuestEmail(e.target.value)}
                    style={{
                      width: "100%",
                      background: theme.inputBg,
                      border:
                        editGuestEmail.length > 0 && !isValidEmail(editGuestEmail)
                          ? "1px solid #ef4444"
                          : theme.inputBorder,
                      borderRadius: "12px",
                      padding: "10px 14px",
                      color: theme.inputText,
                      fontSize: "0.92rem",
                      outline: "none",
                    }}
                  />
                  {editGuestEmail.length > 0 && !isValidEmail(editGuestEmail) && (
                    <div
                      style={{
                        fontSize: "0.74rem",
                        color: "#ef4444",
                        marginTop: "4px",
                      }}
                    >
                      Please enter a valid email ending with a domain (e.g. name@xyz.in or name@example.com).
                    </div>
                  )}
                </div>

                {/* Action Buttons: Save & Resend */}
                <div className="d-flex gap-2 mb-3">
                  <button
                    type="submit"
                    disabled={
                      isSavingEdit ||
                      !editGuestName.trim() ||
                      editGuestContact.length !== 10 ||
                      !isValidEmail(editGuestEmail)
                    }
                    style={{
                      flex: 2,
                      background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      border: "none",
                      color: "#ffffff",
                      borderRadius: "12px",
                      padding: "10px",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      cursor:
                        isSavingEdit ||
                        !editGuestName.trim() ||
                        editGuestContact.length !== 10 ||
                        !isValidEmail(editGuestEmail)
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        isSavingEdit ||
                        !editGuestName.trim() ||
                        editGuestContact.length !== 10 ||
                        !isValidEmail(editGuestEmail)
                          ? 0.6
                          : 1,
                      boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
                    }}
                  >
                    {isSavingEdit ? "Saving Changes..." : "💾 Save Changes"}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendPassEmail}
                    disabled={isResendingPass || !isValidEmail(editGuestEmail)}
                    style={{
                      flex: 1.5,
                      background: isDarkMode
                        ? "rgba(37, 99, 235, 0.2)"
                        : "rgba(219, 234, 254, 0.8)",
                      border: "1px solid rgba(59, 130, 246, 0.4)",
                      color: isDarkMode ? "#93c5fd" : "#1d4ed8",
                      borderRadius: "12px",
                      padding: "10px",
                      fontWeight: 600,
                      fontSize: "0.84rem",
                      cursor:
                        isResendingPass || !isValidEmail(editGuestEmail)
                          ? "not-allowed"
                          : "pointer",
                      opacity: isResendingPass || !isValidEmail(editGuestEmail) ? 0.6 : 1,
                    }}
                  >
                    {isResendingPass ? "Sending..." : "✉️ Re-send Pass"}
                  </button>
                </div>

                {/* Danger Zone: Custom Cancellation Trigger */}
                <div
                  style={{
                    borderTop: isDarkMode
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid rgba(219, 234, 254, 0.8)",
                    paddingTop: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCancelingSeat(editingSeat);
                      setCancelReason("Guest Request");
                      setCancelNotes("");
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(239, 68, 68, 0.45)",
                      color: "#ef4444",
                      borderRadius: "10px",
                      padding: "8px 14px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    🗑️ Cancel Reservation...
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingSeat(null)}
                    style={{
                      background: isDarkMode
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.05)",
                      border: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: "10px",
                      padding: "8px 16px",
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CANCELLATION MODAL */}
      {cancelingSeat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancelingSeat(null);
          }}
        >
          <div
            style={{
              background: isDarkMode
                ? "rgba(15, 23, 42, 0.96)"
                : "rgba(255, 255, 255, 0.98)",
              border: isDarkMode
                ? "1px solid rgba(239, 68, 68, 0.35)"
                : "1px solid rgba(252, 165, 165, 0.9)",
              borderRadius: "26px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8)",
              maxWidth: "460px",
              width: "100%",
              overflow: "hidden",
              position: "relative",
              color: theme.textPrimary,
              animation: "checkinModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                background: isDarkMode
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(254, 226, 226, 0.8)",
                borderBottom: isDarkMode
                  ? "1px solid rgba(239, 68, 68, 0.25)"
                  : "1px solid rgba(252, 165, 165, 0.8)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "1.3rem" }}>⚠️</span>
                <div>
                  <h5
                    style={{
                      margin: 0,
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      color: isDarkMode ? "#fca5a5" : "#b91c1c",
                    }}
                  >
                    Confirm Cancellation
                  </h5>
                  <div
                    style={{
                      fontSize: "0.76rem",
                      color: isDarkMode ? "#f87171" : "#dc2626",
                    }}
                  >
                    Release seat reservation back to available
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelingSeat(null)}
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
              {/* Attendee details summary card */}
              <div
                style={{
                  background: isDarkMode
                    ? "rgba(0, 0, 0, 0.25)"
                    : "rgba(241, 245, 249, 0.9)",
                  border: theme.inputBorder,
                  borderRadius: "16px",
                  padding: "14px",
                  marginBottom: "16px",
                  fontSize: "0.85rem",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span style={{ color: theme.textSecondary }}>Seat:</span>
                  <strong style={{ color: "#2563eb", fontSize: "0.95rem" }}>
                    {cancelingSeat.label}
                  </strong>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span style={{ color: theme.textSecondary }}>Guest:</span>
                  <strong>{cancelingSeat.name || "N/A"}</strong>
                </div>
                {cancelingSeat.contact && (
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span style={{ color: theme.textSecondary }}>Contact:</span>
                    <span>{cancelingSeat.contact}</span>
                  </div>
                )}
                {cancelingSeat.email && (
                  <div className="d-flex justify-content-between align-items-center">
                    <span style={{ color: theme.textSecondary }}>Email:</span>
                    <span className="text-truncate" style={{ maxWidth: "220px" }}>
                      {cancelingSeat.email}
                    </span>
                  </div>
                )}
              </div>

              {/* CRITICAL WARNING: Guest already checked in */}
              {cancelingSeat.hasCheckedIn && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.18)",
                    border: "1px solid #ef4444",
                    color: "#ef4444",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    marginBottom: "16px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  🚨 <strong>ATTENTION:</strong> This attendee has ALREADY CHECKED IN at the
                  gate! Canceling will void their pass and make the seat open for re-booking.
                </div>
              )}

              {/* Cancellation Reason Selector */}
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
                  Cancellation Reason <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{
                    width: "100%",
                    background: theme.inputBg,
                    border: theme.inputBorder,
                    borderRadius: "12px",
                    padding: "10px 12px",
                    color: theme.inputText,
                    fontSize: "0.88rem",
                    outline: "none",
                  }}
                >
                  <option value="Guest Request">Guest Request (Change of Plans)</option>
                  <option value="Duplicate / Accidental">
                    Duplicate / Accidental Booking
                  </option>
                  <option value="Seat Reassignment">Seat Reassignment / Upgrade</option>
                  <option value="No Show / Other">No Show / Other</option>
                </select>
              </div>

              {/* Optional Notes */}
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
                  Optional Notes (for audit trail)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Guest requested cancellation via desk"
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  style={{
                    width: "100%",
                    background: theme.inputBg,
                    border: theme.inputBorder,
                    borderRadius: "12px",
                    padding: "10px 14px",
                    color: theme.inputText,
                    fontSize: "0.88rem",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div className="d-flex gap-2">
                <button
                  type="button"
                  onClick={() => setCancelingSeat(null)}
                  style={{
                    flex: 1,
                    background: isDarkMode
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.05)",
                    border: theme.inputBorder,
                    color: theme.textPrimary,
                    borderRadius: "12px",
                    padding: "11px",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  Keep Reservation
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCancellation}
                  disabled={isProcessingCancel}
                  style={{
                    flex: 1.5,
                    background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "12px",
                    padding: "11px",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: isProcessingCancel ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 15px rgba(220, 38, 38, 0.4)",
                  }}
                >
                  {isProcessingCancel ? "Canceling..." : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EVENT PASS BRANDING MODAL */}
      {showBrandingModal && (
        <EventBrandingModal
          eventId={eventId}
          eventData={eventData}
          onClose={() => setShowBrandingModal(false)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

export default CheckInPage;
