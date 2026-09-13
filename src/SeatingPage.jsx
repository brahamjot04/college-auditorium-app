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
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import Navbar from "./Navbar";
import Footer from "./Footer";
import EventBrandingModal from "./EventBrandingModal";
import { exportToCsv } from "./utils/exportCsv";
import { sendGatePassEmail, generateQrDataUrl } from "./utils/emailService";

function SeatingPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, userName } = useAuth();

  // State
  const [eventName, setEventName] = useState("Loading...");
  const [eventData, setEventData] = useState(null);
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [bookedSeats, setBookedSeats] = useState({});
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  // Modal Inputs (Booking)
  const [studentName, setStudentName] = useState("");
  const [studentContact, setStudentContact] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [bookingStartSeat, setBookingStartSeat] = useState("");
  const [bookingEndSeat, setBookingEndSeat] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Post-Booking Confirmation Modal State
  const [confirmedPass, setConfirmedPass] = useState(null);
  const [copiedPassLink, setCopiedPassLink] = useState(false);
  const [systemConfig, setSystemConfig] = useState(null);

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

  // Single Seat Unblock Modal State (Replaces native confirm for blocked seats)
  const [unblockingSeat, setUnblockingSeat] = useState(null);
  const [isProcessingUnblock, setIsProcessingUnblock] = useState(false);

  // Dropdown menus state (Export & Admin Tools)
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  // Input Validation & Sanitization Helpers
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

  // Close modals and dropdowns on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowBlockModal(false);
        setShowUnblockModal(false);
        setSelectedSeat(null);
        setConfirmedPass(null);
        setEditingSeat(null);
        setCancelingSeat(null);
        setUnblockingSeat(null);
        setShowExportMenu(false);
        setShowAdminMenu(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest("[data-seating-export-menu]")) {
        setShowExportMenu(false);
      }
      if (!e.target.closest("[data-seating-admin-menu]")) {
        setShowAdminMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
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

  // Real-time Collision Detection & Range Validation for Booking Range
  let bookingCollisions = [];
  const startCollisionCheck = parseInt(bookingStartSeat);
  const endCollisionCheck = bookingEndSeat ? parseInt(bookingEndSeat) : NaN;
  const isEndSeatInvalid =
    bookingEndSeat.trim().length > 0 &&
    !isNaN(startCollisionCheck) &&
    !isNaN(endCollisionCheck) &&
    endCollisionCheck <= startCollisionCheck;

  if (
    !isNaN(startCollisionCheck) &&
    startCollisionCheck > 0 &&
    !isEndSeatInvalid
  ) {
    const endTarget = !isNaN(endCollisionCheck)
      ? endCollisionCheck
      : startCollisionCheck;
    if (endTarget >= startCollisionCheck) {
      for (let i = startCollisionCheck; i <= endTarget; i++) {
        const rowId = findRowForSeat(i);
        if (rowId) {
          const uniqueId = `seat_${i}_${rowId}`;
          const existing = bookedSeats[uniqueId];
          if (existing) {
            bookingCollisions.push({
              seatNum: i,
              label: existing.label || getSeatLabel(rowId, i),
              status: existing.status || "booked",
              name: existing.name || "Blocked",
            });
          }
        }
      }
    }
  }

  // ----------------------------------------------------------------
  // 2. DATA FETCHING
  // ----------------------------------------------------------------
  useEffect(() => {
    const unsubEvent = onSnapshot(doc(db, "events", eventId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEventData(data);
        if (data.name) setEventName(data.name);
      }
    });

    getDoc(doc(db, "system_settings", "config"))
      .then((snap) => {
        if (snap.exists()) setSystemConfig(snap.data());
      })
      .catch((err) => console.warn("Could not load system config in seating:", err));

    const unsubscribeSeats = onSnapshot(
      collection(db, "events", eventId, "seats"),
      (snapshot) => {
        const seatData = {};
        snapshot.forEach((d) => {
          seatData[d.id] = d.data();
        });
        setBookedSeats(seatData);
      },
    );

    return () => {
      unsubEvent();
      unsubscribeSeats();
    };
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
      const staffName =
        userName ||
        user?.displayName ||
        user?.email?.split("@")[0] ||
        "Admin";
      const logRef = doc(collection(db, "events", eventId, "activityLogs"));
      batch.set(logRef, {
        type: "SEATS_BLOCKED",
        range: `${start} - ${end}`,
        count: count,
        performedByName: staffName,
        performedByEmail: user?.email || "",
        performedByUid: user?.uid || "",
        timestamp: new Date(),
      });

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
      const staffName =
        userName ||
        user?.displayName ||
        user?.email?.split("@")[0] ||
        "Admin";
      const logRef = doc(collection(db, "events", eventId, "activityLogs"));
      batch.set(logRef, {
        type: "SEATS_UNBLOCKED",
        range: `${start} - ${end}`,
        count: count,
        performedByName: staffName,
        performedByEmail: user?.email || "",
        performedByUid: user?.uid || "",
        timestamp: new Date(),
      });

      await batch.commit();
      setShowUnblockModal(false);
      setUnblockStart("");
      setUnblockEnd("");
    } else {
      alert("No booked or blocked seats found in that range.");
    }
  };

  // -- CLICK SEAT --
  const handleSeatClick = async (seat) => {
    const existing = bookedSeats[seat.uniqueId];

    if (existing) {
      if (existing.status === "blocked") {
        if (!isAdmin) {
          alert("This seat is VIP / Blocked.");
          return;
        }
        setUnblockingSeat({ ...seat, ...existing });
        return;
      }

      // It's a booked seat! Both Admins and Staff can view & manage it.
      setEditingSeat({ ...seat, ...existing });
      setEditGuestName(existing.name || "");
      setEditGuestContact(existing.contact || "");
      setEditGuestEmail(existing.email || "");
      setEditSaveSuccess(false);
      setResendPassMsg(null);
    } else {
      // Open Booking Modal (both staff users and admins can book)
      setSelectedSeat(seat);
      setBookingStartSeat(String(seat.num));
      setBookingEndSeat("");
      setStudentName("");
      setStudentContact("");
      setStudentEmail("");
    }
  };

  // -- SAVE EDIT BOOKING --
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
      await updateDoc(
        doc(db, "events", eventId, "seats", editingSeat.uniqueId),
        {
          name: editGuestName.trim(),
          contact: editGuestContact.trim(),
          email: editGuestEmail.trim(),
          updatedAt: new Date(),
          updatedByName: staffName,
          updatedByEmail: staffEmail,
          updatedByUid: staffUid,
        },
      );

      await addDoc(collection(db, "events", eventId, "activityLogs"), {
        type: "SEAT_UPDATED",
        seatId: editingSeat.uniqueId,
        seatLabel: editingSeat.label,
        studentName: editGuestName.trim(),
        studentContact: editGuestContact.trim(),
        studentEmail: editGuestEmail.trim(),
        performedByName: staffName,
        performedByEmail: staffEmail,
        performedByUid: staffUid,
        timestamp: new Date(),
      });

      setEditSaveSuccess(true);
      setTimeout(() => setEditSaveSuccess(false), 3500);
    } catch (err) {
      console.error("Save edit error:", err);
      alert("Failed to save changes: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // -- RE-SEND PASS EMAIL --
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

    const passUrl = `${window.location.origin}/pass/${eventId}/${editingSeat.uniqueId}?token=${editingSeat.passToken || ""}`;
    const qrDataUrl = await generateQrDataUrl(passUrl);

    try {
      const res = await sendGatePassEmail({
        emailConfig: systemConfig?.email || {},
        brandingConfig: {
          ...(systemConfig?.branding || {}),
          ...(eventData?.branding || {}),
        },
        eventName: eventData?.name || eventName,
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

  // -- CONFIRM CANCELLATION --
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
      await deleteDoc(
        doc(db, "events", eventId, "seats", cancelingSeat.uniqueId),
      );

      await addDoc(collection(db, "events", eventId, "activityLogs"), {
        type: "SEAT_RELEASED",
        seatId: cancelingSeat.uniqueId,
        seatLabel: cancelingSeat.label,
        studentName: cancelingSeat.name || null,
        studentContact: cancelingSeat.contact || null,
        studentEmail: cancelingSeat.email || null,
        reason: cancelReason,
        notes: cancelNotes.trim() || null,
        performedByName: staffName,
        performedByEmail: staffEmail,
        performedByUid: staffUid,
        timestamp: new Date(),
      });

      setCancelingSeat(null);
      setEditingSeat(null);
      setCancelNotes("");
      setCancelReason("Guest Request");
    } catch (err) {
      console.error("Cancel booking error:", err);
      alert("Failed to cancel booking: " + err.message);
    } finally {
      setIsProcessingCancel(false);
    }
  };

  // -- CONFIRM UNBLOCK SINGLE SEAT --
  const handleConfirmUnblock = async () => {
    if (!unblockingSeat || isProcessingUnblock) return;

    setIsProcessingUnblock(true);
    const staffName =
      userName ||
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Admin";
    const staffEmail = user?.email || "";
    const staffUid = user?.uid || "";

    try {
      await deleteDoc(
        doc(db, "events", eventId, "seats", unblockingSeat.uniqueId),
      );

      await addDoc(collection(db, "events", eventId, "activityLogs"), {
        type: "SEAT_UNBLOCKED",
        seatId: unblockingSeat.uniqueId,
        seatLabel: unblockingSeat.label,
        performedByName: staffName,
        performedByEmail: staffEmail,
        performedByUid: staffUid,
        timestamp: new Date(),
      });

      setUnblockingSeat(null);
    } catch (err) {
      console.error("Unblock error:", err);
      alert("Failed to unblock seat: " + err.message);
    } finally {
      setIsProcessingUnblock(false);
    }
  };

  // -- EXPORT FULL SEATING PLAN TO CSV --
  const handleExportCsv = () => {
    const headers = [
      { key: "seatNumber", label: "Seat #" },
      { key: "rowLabel", label: "Row" },
      { key: "seatLabel", label: "Seat Label" },
      { key: "status", label: "Status" },
      { key: "guestName", label: "Guest Name" },
      { key: "contact", label: "Contact Number" },
      { key: "bookedBy", label: "Booked By" },
      { key: "checkInStatus", label: "Check-In Status" },
    ];

    const rows = [];
    for (let i = 1; i <= 447; i++) {
      const rowId = findRowForSeat(i);
      if (rowId) {
        const uniqueId = `seat_${i}_${rowId}`;
        const seatLabel = getSeatLabel(rowId, i);
        const booked = bookedSeats[uniqueId];

        let status = "Available";
        let guestName = "";
        let contact = "";
        let bookedBy = "";
        let checkInStatus = "-";

        if (booked) {
          if (booked.status === "blocked") {
            status = "Blocked / VIP";
          } else {
            status = "Booked";
            guestName = booked.name || "";
            contact = booked.contact || "";
            bookedBy = booked.bookedByName || "";
            checkInStatus = booked.hasCheckedIn ? "Checked In" : "Pending";
          }
        }

        rows.push({
          seatNumber: i,
          rowLabel: `Row ${String.fromCharCode(64 + rowId)}`,
          seatLabel,
          status,
          guestName,
          contact,
          bookedBy,
          checkInStatus,
        });
      }
    }

    const safeName = eventName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeName}_Seating_Plan_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(filename, headers, rows);
  };

  // -- BOOKING SUBMIT --
  const submitBooking = async (e) => {
    e.preventDefault();
    if (
      !studentName.trim() ||
      !studentContact.trim() ||
      !studentEmail.trim() ||
      !bookingStartSeat
    ) {
      alert("Please fill in all required fields (Name, Contact, and Email).");
      return;
    }

    if (studentContact.trim().length !== 10) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }

    if (!isValidEmail(studentEmail)) {
      alert(
        "Please enter a valid email address with a domain (e.g. name@domain.com or name@college.ac.in).",
      );
      return;
    }

    const start = parseInt(bookingStartSeat);
    if (bookingEndSeat.trim()) {
      const endNum = parseInt(bookingEndSeat);
      if (isNaN(endNum) || endNum <= start) {
        alert("End seat must be strictly greater than start seat. Leave blank to reserve a single seat.");
        return;
      }
    }
    const end = bookingEndSeat.trim() ? parseInt(bookingEndSeat) : start;

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

    setIsSubmittingBooking(true);

    try {
      const passToken = crypto.randomUUID();
      const batch = writeBatch(db);
      let count = 0;
      const bookedSeatLabels = [];
      const staffName =
        userName ||
        user?.displayName ||
        user?.email?.split("@")[0] ||
        "Staff";
      const staffEmail = user?.email || "";
      const staffUid = user?.uid || "";
      let primarySeatId = "";

      for (let i = start; i <= end; i++) {
        const rowId = findRowForSeat(i);
        if (rowId) {
          const uniqueId = `seat_${i}_${rowId}`;
          if (!primarySeatId) primarySeatId = uniqueId;
          const seatRef = doc(db, "events", eventId, "seats", uniqueId);
          const seatLabel = getSeatLabel(rowId, i);
          bookedSeatLabels.push(seatLabel);

          batch.set(seatRef, {
            label: seatLabel,
            name: studentName.trim(),
            contact: studentContact.trim(),
            email: studentEmail.trim(),
            passToken,
            hasCheckedIn: false,
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
            studentName: studentName.trim(),
            studentContact: studentContact.trim(),
            studentEmail: studentEmail.trim(),
            performedByName: staffName,
            performedByEmail: staffEmail,
            performedByUid: staffUid,
            timestamp: new Date(),
          });

          count++;
        }
      }

      if (count > 0) {
        const passUrl = `${window.location.origin}/pass/${eventId}/${primarySeatId}?token=${passToken}`;
        const qrDataUrl = await generateQrDataUrl(passUrl);

        await batch.commit();

        // Dispatch EmailJS digital pass in background
        let emailSent = false;
        let emailError = "";
        try {
          const emailRes = await sendGatePassEmail({
            emailConfig: systemConfig?.email || {},
            brandingConfig: {
              ...(systemConfig?.branding || {}),
              ...(eventData?.branding || {}),
            },
            eventName: eventData?.name || eventName,
            eventDate: eventData?.date || "",
            eventTime: eventData?.time || "10:00 AM",
            venue: eventData?.venue || "GNDEC Main Auditorium, Ludhiana",
            guestName: studentName.trim(),
            guestEmail: studentEmail.trim(),
            guestContact: studentContact.trim(),
            seatLabel: bookedSeatLabels.join(", "),
            passUrl,
            qrDataUrl,
          });
          emailSent = emailRes.success;
          if (!emailRes.success) {
            emailError = emailRes.error || "Email dispatch failed";
          }
        } catch (emailErr) {
          emailError = emailErr.message || "Email error";
        }

        // Open Confirmation & Digital Pass Modal
        setConfirmedPass({
          guestName: studentName.trim(),
          guestEmail: studentEmail.trim(),
          guestContact: studentContact.trim(),
          seatLabels: bookedSeatLabels.join(", "),
          passUrl,
          qrDataUrl,
          emailSent,
          emailError,
          eventName: eventData?.name || eventName,
          eventDate: eventData?.date || "",
          eventTime: eventData?.time || "10:00 AM",
        });

        setSelectedSeat(null);
        setStudentName("");
        setStudentContact("");
        setStudentEmail("");
        setBookingStartSeat("");
        setBookingEndSeat("");
      } else {
        alert("Invalid seat range.");
      }
    } catch (err) {
      console.error("Booking error:", err);
      alert("Booking error: " + err.message);
    } finally {
      setIsSubmittingBooking(false);
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
              {/* Primary Action: Shortcut to Gate Check-In */}
              <button
                type="button"
                onClick={() => navigate(`/checkin/${eventId}`)}
                style={{
                  background: isDarkMode
                    ? "rgba(59, 130, 246, 0.18)"
                    : "rgba(219, 234, 254, 0.85)",
                  border: isDarkMode
                    ? "1px solid rgba(59, 130, 246, 0.45)"
                    : "1px solid rgba(147, 197, 253, 0.95)",
                  color: isDarkMode ? "#93c5fd" : "#1d4ed8",
                  borderRadius: "12px",
                  padding: "7px 15px",
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

              {/* Smart Dropdown: Export Options */}
              <div className="position-relative" data-seating-export-menu="true">
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu((prev) => !prev);
                    setShowAdminMenu(false);
                  }}
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
                  <span>📥 Export</span>
                  <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>▾</span>
                </button>

                {showExportMenu && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      zIndex: 100,
                      minWidth: "190px",
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
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        handlePrintExport();
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
                      <span>📸</span>
                      <span>Print Map</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        handleExportCsv();
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
                      <span>📊</span>
                      <span>Export CSV</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Smart Dropdown: Admin Tools */}
              {isAdmin && (
                <div className="position-relative" data-seating-admin-menu="true">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminMenu((prev) => !prev);
                      setShowExportMenu(false);
                    }}
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
                        Seat Range Controls
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminMenu(false);
                          setShowBlockModal(true);
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
                        <span>🚫</span>
                        <span>Block Range</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminMenu(false);
                          setShowUnblockModal(true);
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
                        <span>🔓</span>
                        <span>Unblock Range</span>
                      </button>

                      <div
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: theme.textSecondary,
                          padding: "8px 10px 3px",
                          borderTop: isDarkMode
                            ? "1px solid rgba(255, 255, 255, 0.08)"
                            : "1px solid rgba(0, 0, 0, 0.06)",
                          marginTop: "2px",
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

      {/* PRINT-SPECIFIC CSS RULES */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .d-print-none {
            display: none !important;
          }
          .d-print-block {
            display: block !important;
          }
        }
      `}</style>

      {/* OFFICIAL PRINT-ONLY HEADER (Rendered exclusively on paper / PDF export) */}
      <div
        className="d-none d-print-block w-100 mb-3 text-dark px-3"
        style={{
          fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          paddingBottom: "10px",
          borderBottom: "2px solid #0f172a",
        }}
      >
        {/* College & Committee Branding */}
        <div className="text-center mb-2">
          <h2
            style={{
              fontSize: "1.35rem",
              fontWeight: 800,
              letterSpacing: "-0.2px",
              margin: 0,
              textTransform: "uppercase",
              color: "#0f172a",
            }}
          >
            Guru Nanak Dev Engineering College, Ludhiana
          </h2>
          <h4
            style={{
              fontSize: "1.02rem",
              fontWeight: 700,
              margin: "3px 0 0 0",
              color: "#1e3a8a",
            }}
          >
            Cultural Committee GNDEC — College Auditorium Seating Plan
          </h4>
        </div>

        {/* Event Metadata Row */}
        <div
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "8px 16px",
            background: "#f8fafc",
            margin: "8px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            fontSize: "0.86rem",
          }}
        >
          <div>
            <strong>Event: </strong>
            <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>{eventName}</span>
          </div>
          <div>
            <strong>Scheduled Date: </strong>
            <span>
              {eventData?.date
                ? new Date(eventData.date + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "Date Unset"}
            </span>
          </div>
          <div>
            <strong>Printed Timestamp: </strong>
            <span>
              {new Date().toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* Capacity Breakdown & Legend */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "0.82rem",
            padding: "2px 0",
          }}
        >
          {/* Capacity Breakdown Counts */}
          <div style={{ display: "flex", gap: "16px", fontWeight: 600 }}>
            <span>Capacity: <strong>447 Seats</strong></span>
            <span>Booked: <strong style={{ color: "#b91c1c" }}>{bookedCount}</strong></span>
            <span>Blocked / VIP: <strong style={{ color: "#b45309" }}>{blockedCount}</strong></span>
            <span>Available: <strong style={{ color: "#15803d" }}>{availableCount}</strong></span>
          </div>

          {/* Seating Color Legend */}
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "12px", height: "12px", border: "1px solid #15803d", background: "#dcfce7", display: "inline-block", borderRadius: "2px" }}></span>
              <span>Available</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "12px", height: "12px", border: "1px solid #b91c1c", background: "#fee2e2", display: "inline-block", borderRadius: "2px" }}></span>
              <span>Booked</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "12px", height: "12px", border: "1px solid #64748b", background: "#e2e8f0", display: "inline-block", borderRadius: "2px" }}></span>
              <span>Blocked / VIP</span>
            </span>
          </div>
        </div>
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
              maxHeight: "90vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
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
                      Start Seat # <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={bookingStartSeat}
                      onKeyDown={preventNonNumeric}
                      onChange={(e) =>
                        setBookingStartSeat(e.target.value.replace(/\D/g, ""))
                      }
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
                      End Seat #{" "}
                      <span style={{ color: theme.textSecondary, fontWeight: 400 }}>
                        (Optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Single seat"
                      value={bookingEndSeat}
                      onKeyDown={preventNonNumeric}
                      onChange={(e) =>
                        setBookingEndSeat(e.target.value.replace(/\D/g, ""))
                      }
                      style={{
                        width: "100%",
                        background: theme.inputBg,
                        border: isEndSeatInvalid
                          ? "1px solid #ef4444"
                          : theme.inputBorder,
                        borderRadius: "12px",
                        padding: "9px 12px",
                        color: theme.inputText,
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                    {isEndSeatInvalid && (
                      <div
                        style={{
                          fontSize: "0.74rem",
                          color: "#ef4444",
                          marginTop: "4px",
                          lineHeight: 1.3,
                        }}
                      >
                        End seat must be strictly greater than start seat (e.g. #{startCollisionCheck + 1} or higher). Leave blank for a single seat.
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Range Collision Alert */}
                {bookingCollisions.length > 0 && (
                  <div
                    style={{
                      background: isDarkMode
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(254, 226, 226, 0.9)",
                      border: isDarkMode
                        ? "1px solid rgba(239, 68, 68, 0.35)"
                        : "1px solid rgba(252, 165, 165, 0.9)",
                      color: isDarkMode ? "#fca5a5" : "#b91c1c",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      fontSize: "0.82rem",
                      marginBottom: "14px",
                      lineHeight: 1.4,
                    }}
                  >
                    ⚠️ <strong>Collision Alert:</strong> Seat(s){" "}
                    <strong>{bookingCollisions.map((c) => c.label).join(", ")}</strong> in this
                    range {bookingCollisions.length === 1 ? "is" : "are"} already booked or blocked! Please choose available seats.
                  </div>
                )}

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
                    Guest / Student Full Name <span style={{ color: "#ef4444" }}>*</span>
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
                    value={studentContact}
                    onKeyDown={preventNonNumeric}
                    onChange={(e) =>
                      setStudentContact(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    style={{
                      width: "100%",
                      background: theme.inputBg,
                      border:
                        studentContact.length > 0 && studentContact.length < 10
                          ? "1px solid #ef4444"
                          : theme.inputBorder,
                      borderRadius: "12px",
                      padding: "10px 14px",
                      color: theme.inputText,
                      fontSize: "0.92rem",
                      outline: "none",
                    }}
                  />
                  {studentContact.length > 0 && studentContact.length < 10 && (
                    <div
                      style={{
                        fontSize: "0.74rem",
                        color: "#ef4444",
                        marginTop: "4px",
                      }}
                    >
                      Must be strictly 10 digits (currently {studentContact.length})
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
                    Guest / Student Email Address <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jaspreet@example.com"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    style={{
                      width: "100%",
                      background: theme.inputBg,
                      border:
                        studentEmail.length > 0 && !isValidEmail(studentEmail)
                          ? "1px solid #ef4444"
                          : theme.inputBorder,
                      borderRadius: "12px",
                      padding: "10px 14px",
                      color: theme.inputText,
                      fontSize: "0.92rem",
                      outline: "none",
                    }}
                  />
                  {studentEmail.length > 0 && !isValidEmail(studentEmail) ? (
                    <div
                      style={{
                        fontSize: "0.74rem",
                        color: "#ef4444",
                        marginTop: "4px",
                      }}
                    >
                      Please enter a valid email ending with a domain (e.g. name@xyz.in or name@example.com).
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: "0.74rem",
                        color: theme.textSecondary,
                        marginTop: "4px",
                      }}
                    >
                      Digital entry pass & QR code will be dispatched to this email.
                    </div>
                  )}
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

                  {(() => {
                    const isFormValid =
                      studentName.trim().length > 0 &&
                      studentContact.trim().length === 10 &&
                      isValidEmail(studentEmail) &&
                      bookingStartSeat.trim().length > 0 &&
                      !isEndSeatInvalid &&
                      bookingCollisions.length === 0;

                    return (
                      <button
                        type="submit"
                        disabled={!isFormValid || isSubmittingBooking}
                        style={{
                          flex: 2,
                          background: !isFormValid
                            ? isDarkMode
                              ? "rgba(255, 255, 255, 0.08)"
                              : "rgba(0, 0, 0, 0.12)"
                            : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                          border: "none",
                          color: !isFormValid ? theme.textSecondary : "#ffffff",
                          borderRadius: "12px",
                          padding: "10px",
                          fontWeight: 600,
                          cursor:
                            !isFormValid || isSubmittingBooking
                              ? "not-allowed"
                              : "pointer",
                          boxShadow: !isFormValid
                            ? "none"
                            : "0 4px 15px rgba(37, 99, 235, 0.35)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {isSubmittingBooking
                          ? "Booking & Dispatching..."
                          : bookingEndSeat
                            ? "Confirm Multi-Booking"
                            : "Confirm Booking"}
                      </button>
                    );
                  })()}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* POST-BOOKING PASS CONFIRMATION MODAL */}
      {confirmedPass && (
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
            if (e.target === e.currentTarget) setConfirmedPass(null);
          }}
        >
          <div
            style={{
              background: theme.modalCardBg,
              border: theme.modalBorder,
              borderRadius: "26px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "480px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              position: "relative",
              color: theme.textPrimary,
              animation: "seatingModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
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
                background: isDarkMode
                  ? "rgba(16, 185, 129, 0.12)"
                  : "rgba(209, 250, 229, 0.8)",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "1.3rem" }}>🎉</span>
                <div>
                  <h5
                    style={{
                      margin: 0,
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      color: isDarkMode ? "#34d399" : "#065f46",
                    }}
                  >
                    Booking Confirmed!
                  </h5>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: isDarkMode ? "#a7f3d0" : "#047857",
                    }}
                  >
                    Digital Gate Pass has been generated
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmedPass(null)}
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

            {/* Modal Body */}
            <div style={{ padding: "24px" }}>
              {/* Email Status Alert */}
              <div
                style={{
                  background: confirmedPass.emailSent
                    ? "rgba(16, 185, 129, 0.12)"
                    : "rgba(245, 158, 11, 0.15)",
                  border: confirmedPass.emailSent
                    ? "1px solid rgba(16, 185, 129, 0.3)"
                    : "1px solid rgba(245, 158, 11, 0.35)",
                  color: confirmedPass.emailSent ? "#10b981" : "#d97706",
                  borderRadius: "14px",
                  padding: "10px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>{confirmedPass.emailSent ? "✉️" : "⚠️"}</span>
                <span>
                  {confirmedPass.emailSent
                    ? `Pass successfully emailed to ${confirmedPass.guestEmail}!`
                    : `Email not sent automatically (${confirmedPass.emailError || "Check EmailJS setup"}). Share or copy pass below:`}
                </span>
              </div>

              {/* Pass Card Preview */}
              <div
                style={{
                  background: isDarkMode ? "rgba(0, 0, 0, 0.3)" : "rgba(241, 245, 249, 0.85)",
                  border: theme.inputBorder,
                  borderRadius: "20px",
                  padding: "16px",
                  textAlign: "center",
                  marginBottom: "18px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: theme.textSecondary,
                    marginBottom: "4px",
                  }}
                >
                  {confirmedPass.eventName}
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    padding: "6px 16px",
                    borderRadius: "14px",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    marginBottom: "12px",
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
                  }}
                >
                  <span>💺</span>
                  <span>{confirmedPass.seatLabels}</span>
                </div>

                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                  {confirmedPass.guestName}
                </div>
                <div style={{ fontSize: "0.8rem", color: theme.textSecondary }}>
                  📞 {confirmedPass.guestContact} • ✉️ {confirmedPass.guestEmail}
                </div>

                {/* QR Code */}
                {confirmedPass.qrDataUrl && (
                  <div
                    style={{
                      marginTop: "14px",
                      display: "inline-block",
                      background: "#ffffff",
                      padding: "8px",
                      borderRadius: "14px",
                      boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
                    }}
                  >
                    <img
                      src={confirmedPass.qrDataUrl}
                      alt="Pass QR"
                      style={{ width: "130px", height: "130px", display: "block" }}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons Grid */}
              <div className="d-flex flex-column gap-2">
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(confirmedPass.passUrl);
                      setCopiedPassLink(true);
                      setTimeout(() => setCopiedPassLink(false), 2500);
                    }}
                    style={{
                      flex: 1,
                      background: isDarkMode
                        ? "rgba(37, 99, 235, 0.25)"
                        : "rgba(219, 234, 254, 0.9)",
                      border: "1px solid rgba(59, 130, 246, 0.5)",
                      color: isDarkMode ? "#93c5fd" : "#1d4ed8",
                      borderRadius: "12px",
                      padding: "9px 12px",
                      fontWeight: 600,
                      fontSize: "0.84rem",
                      cursor: "pointer",
                    }}
                  >
                    {copiedPassLink ? "✓ Link Copied!" : "📋 Copy Pass Link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => window.open(confirmedPass.passUrl, "_blank")}
                    style={{
                      flex: 1,
                      background: isDarkMode
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.05)",
                      border: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: "12px",
                      padding: "9px 12px",
                      fontWeight: 600,
                      fontSize: "0.84rem",
                      cursor: "pointer",
                    }}
                  >
                    🎟️ View Pass
                  </button>
                </div>

                <div className="d-flex gap-2">
                  {navigator.share && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.share({
                          title: `${confirmedPass.eventName} Gate Pass`,
                          text: `Gate Pass for ${confirmedPass.guestName} (${confirmedPass.seatLabels})`,
                          url: confirmedPass.passUrl,
                        });
                      }}
                      style={{
                        flex: 1,
                        background: isDarkMode
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.05)",
                        border: theme.inputBorder,
                        color: theme.textPrimary,
                        borderRadius: "12px",
                        padding: "9px 12px",
                        fontWeight: 600,
                        fontSize: "0.84rem",
                        cursor: "pointer",
                      }}
                    >
                      📱 Share Pass
                    </button>
                  )}

                  <a
                    href={`mailto:${confirmedPass.guestEmail}?subject=${encodeURIComponent(
                      `🎟️ Gate Pass: ${confirmedPass.eventName} (${confirmedPass.seatLabels})`,
                    )}&body=${encodeURIComponent(
                      `Dear ${confirmedPass.guestName},\n\nYour auditorium seat reservation has been confirmed!\nEvent: ${confirmedPass.eventName}\nSeat: ${confirmedPass.seatLabels}\n\nView and present your live QR gate pass here:\n${confirmedPass.passUrl}\n\nPlease report 15 minutes before showtime.\n\nCultural Committee GNDEC`,
                    )}`}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      textDecoration: "none",
                      background: isDarkMode
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.05)",
                      border: theme.inputBorder,
                      color: theme.textPrimary,
                      borderRadius: "12px",
                      padding: "9px 12px",
                      fontWeight: 600,
                      fontSize: "0.84rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✉️ Open in Email
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmedPass(null)}
                  style={{
                    marginTop: "8px",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "12px",
                    padding: "10px",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
                  }}
                >
                  Done
                </button>
              </div>
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
              maxHeight: "90vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
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

              {(() => {
                const isBlockRangeInvalid =
                  blockStart.trim().length > 0 &&
                  blockEnd.trim().length > 0 &&
                  parseInt(blockEnd) < parseInt(blockStart);

                return (
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
                          Start Seat # <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          placeholder="e.g. 1"
                          value={blockStart}
                          onKeyDown={preventNonNumeric}
                          onChange={(e) => setBlockStart(e.target.value.replace(/\D/g, ""))}
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
                          End Seat # <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          placeholder="e.g. 16"
                          value={blockEnd}
                          onKeyDown={preventNonNumeric}
                          onChange={(e) => setBlockEnd(e.target.value.replace(/\D/g, ""))}
                          style={{
                            width: "100%",
                            background: theme.inputBg,
                            border: isBlockRangeInvalid
                              ? "1px solid #ef4444"
                              : theme.inputBorder,
                            borderRadius: "12px",
                            padding: "9px 12px",
                            color: theme.inputText,
                            fontSize: "0.9rem",
                            outline: "none",
                          }}
                        />
                        {isBlockRangeInvalid && (
                          <div
                            style={{
                              fontSize: "0.74rem",
                              color: "#ef4444",
                              marginTop: "4px",
                              lineHeight: 1.3,
                            }}
                          >
                            End seat must be greater than or equal to start seat.
                          </div>
                        )}
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
                        disabled={isBlockRangeInvalid}
                        style={{
                          flex: 2,
                          background: isBlockRangeInvalid
                            ? isDarkMode
                              ? "rgba(255, 255, 255, 0.08)"
                              : "rgba(0, 0, 0, 0.12)"
                            : isDarkMode
                              ? "linear-gradient(135deg, #374151 0%, #1f2937 100%)"
                              : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                          border: "none",
                          color: isBlockRangeInvalid ? theme.textSecondary : "#ffffff",
                          borderRadius: "12px",
                          padding: "10px",
                          fontWeight: 600,
                          cursor: isBlockRangeInvalid ? "not-allowed" : "pointer",
                          boxShadow: isBlockRangeInvalid
                            ? "none"
                            : "0 4px 15px rgba(0, 0, 0, 0.3)",
                        }}
                      >
                        Block Range
                      </button>
                    </div>
                  </form>
                );
              })()}
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
              maxHeight: "90vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
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

              {(() => {
                const isUnblockRangeInvalid =
                  unblockStart.trim().length > 0 &&
                  unblockEnd.trim().length > 0 &&
                  parseInt(unblockEnd) < parseInt(unblockStart);

                return (
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
                          Start Seat # <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          placeholder="e.g. 1"
                          value={unblockStart}
                          onKeyDown={preventNonNumeric}
                          onChange={(e) => setUnblockStart(e.target.value.replace(/\D/g, ""))}
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
                          End Seat # <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          placeholder="e.g. 16"
                          value={unblockEnd}
                          onKeyDown={preventNonNumeric}
                          onChange={(e) => setUnblockEnd(e.target.value.replace(/\D/g, ""))}
                          style={{
                            width: "100%",
                            background: theme.inputBg,
                            border: isUnblockRangeInvalid
                              ? "1px solid #ef4444"
                              : theme.inputBorder,
                            borderRadius: "12px",
                            padding: "9px 12px",
                            color: theme.inputText,
                            fontSize: "0.9rem",
                            outline: "none",
                          }}
                        />
                        {isUnblockRangeInvalid && (
                          <div
                            style={{
                              fontSize: "0.74rem",
                              color: "#ef4444",
                              marginTop: "4px",
                              lineHeight: 1.3,
                            }}
                          >
                            End seat must be greater than or equal to start seat.
                          </div>
                        )}
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
                        disabled={isUnblockRangeInvalid}
                        style={{
                          flex: 2,
                          background: isUnblockRangeInvalid
                            ? isDarkMode
                              ? "rgba(255, 255, 255, 0.08)"
                              : "rgba(0, 0, 0, 0.12)"
                            : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                          border: "none",
                          color: isUnblockRangeInvalid ? theme.textSecondary : "#ffffff",
                          borderRadius: "12px",
                          padding: "10px",
                          fontWeight: 600,
                          cursor: isUnblockRangeInvalid ? "not-allowed" : "pointer",
                          boxShadow: isUnblockRangeInvalid
                            ? "none"
                            : "0 4px 15px rgba(220, 38, 38, 0.35)",
                        }}
                      >
                        Unblock Seats
                      </button>
                    </div>
                  </form>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 4. EDIT BOOKING MODAL */}
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
              background: theme.modalCardBg,
              border: theme.modalBorder,
              borderRadius: "26px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "480px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
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
                    borderTop: theme.canvasBorder,
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

      {/* 5. CUSTOM CANCELLATION MODAL */}
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
              background: theme.modalCardBg,
              border: isDarkMode
                ? "1px solid rgba(239, 68, 68, 0.35)"
                : "1px solid rgba(252, 165, 165, 0.9)",
              borderRadius: "26px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8)",
              maxWidth: "460px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              position: "relative",
              color: theme.textPrimary,
              animation: "seatingModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
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
                  placeholder="e.g. Guest requested row change via phone"
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

      {/* 6. SINGLE SEAT UNBLOCK CONFIRMATION MODAL */}
      {unblockingSeat && (
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
            if (e.target === e.currentTarget) setUnblockingSeat(null);
          }}
        >
          <div
            style={{
              background: theme.modalCardBg,
              border: theme.modalBorder,
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "420px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
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
                  Unblock Seat {unblockingSeat.label}
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setUnblockingSeat(null)}
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
              <p
                style={{
                  fontSize: "0.88rem",
                  color: theme.textPrimary,
                  marginBottom: "20px",
                  lineHeight: 1.5,
                }}
              >
                Are you sure you want to unblock seat{" "}
                <strong>{unblockingSeat.label}</strong>? It will immediately become
                available for reservation.
              </p>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  onClick={() => setUnblockingSeat(null)}
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
                  type="button"
                  onClick={handleConfirmUnblock}
                  disabled={isProcessingUnblock}
                  style={{
                    flex: 1.5,
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "12px",
                    padding: "10px",
                    fontWeight: 600,
                    cursor: isProcessingUnblock ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 15px rgba(16, 185, 129, 0.35)",
                  }}
                >
                  {isProcessingUnblock ? "Unblocking..." : "Unblock Seat"}
                </button>
              </div>
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

      {/* EVENT PASS BRANDING MODAL */}
      {showBrandingModal && (
        <EventBrandingModal
          eventId={eventId}
          eventData={eventData}
          onClose={() => setShowBrandingModal(false)}
          isDarkMode={isDarkMode}
        />
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
