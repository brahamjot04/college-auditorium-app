// src/PassPage.jsx
import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, addDoc, collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";
import QRCode from "qrcode";
import { fetchImageFromGitHub } from "./utils/github";
import { playSuccessChime } from "./utils/audioFeedback";

export default function PassPage() {
  const { eventId, seatId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { user, userName } = useAuth();

  const [eventData, setEventData] = useState(null);
  const [seatData, setSeatData] = useState(null);
  const [branding, setBranding] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmitting, setIsAdmitting] = useState(false);
  const qrCanvasRef = useRef(null);

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

  // 1. Fetch Global System Branding Settings
  useEffect(() => {
    getDoc(doc(db, "system_settings", "config"))
      .then((snap) => {
        if (snap.exists()) {
          setBranding(snap.data());
        }
      })
      .catch((err) => console.warn("Could not load global branding:", err));
  }, []);

  // 2. Fetch Event & Listen to Seat in Real-Time
  useEffect(() => {
    if (!eventId || !seatId) {
      setError("Invalid Pass Link: Missing event or seat identifiers.");
      setLoading(false);
      return;
    }

    // Real-time listener for Event (updates if branding changes)
    const unsubEvent = onSnapshot(
      doc(db, "events", eventId),
      (eSnap) => {
        if (!eSnap.exists()) {
          setError("Event not found or has been removed.");
          setLoading(false);
          return;
        }
        setEventData(eSnap.data());
      },
      (err) => {
        setError("Error loading event: " + err.message);
        setLoading(false);
      },
    );

    // Dynamic Logo Loader (event-specific branding overrides global portal branding)
    return () => unsubEvent();
  }, [eventId, seatId]);

  // 3. Resolve Active Logo
  useEffect(() => {
    const activeLogoPath =
      eventData?.branding?.logoPath || branding?.branding?.logoPath;
    if (activeLogoPath) {
      fetchImageFromGitHub(activeLogoPath).then((url) => {
        if (url) setLogoUrl(url);
      });
    } else {
      setLogoUrl(null);
    }
  }, [eventData?.branding?.logoPath, branding?.branding?.logoPath]);

  // 4. Real-time listener for Seat
  useEffect(() => {
    if (!eventId || !seatId) return;

    const unsubscribe = onSnapshot(
      doc(db, "events", eventId, "seats", seatId),
      (docSnap) => {
        setLoading(false);
        if (!docSnap.exists()) {
          setError("This seat reservation was not found or was released.");
          setSeatData(null);
          return;
        }

        const data = docSnap.data();

        // Security verification: check token unless user is logged in
        if (!user && data.passToken && data.passToken !== token) {
          setError("⛔ Access Denied: Invalid or missing secure pass token.");
          setSeatData(null);
          return;
        }

        setError("");
        setSeatData(data);

        // Generate QR code encoding the current URL
        const currentUrl = window.location.href;
        QRCode.toDataURL(currentUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        })
          .then((url) => setQrCodeDataUrl(url))
          .catch((err) => console.error("QR Code Error:", err));
      },
      (err) => {
        setError("Error listening to pass data: " + err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [eventId, seatId, token, user]);

  // 3. Quick-Admit Handler for logged-in Gate Staff
  const handleAdmitGuest = async () => {
    if (!user || !seatData || seatData.hasCheckedIn || isAdmitting) return;

    setIsAdmitting(true);
    const staffName =
      userName ||
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Staff";

    try {
      await updateDoc(doc(db, "events", eventId, "seats", seatId), {
        hasCheckedIn: true,
        checkedInAt: new Date(),
        checkedInByName: staffName,
        checkedInByEmail: user?.email || "",
        checkedInByUid: user?.uid || "",
      });

      // Log Gate Check-In for Audit Trail
      await addDoc(collection(db, "events", eventId, "activityLogs"), {
        type: "GATE_CHECK_IN",
        seatId: seatId,
        seatLabel: seatData.label || seatId,
        studentName: seatData.name || "Guest",
        studentContact: seatData.contact || "",
        performedByName: staffName,
        performedByEmail: user?.email || "",
        performedByUid: user?.uid || "",
        timestamp: new Date(),
      });

      playSuccessChime();
      if (navigator.vibrate) navigator.vibrate(80);
    } catch (err) {
      alert("Failed to admit guest: " + err.message);
    } finally {
      setIsAdmitting(false);
    }
  };

  const orgTitle =
    eventData?.branding?.orgTitle ||
    branding?.branding?.orgTitle ||
    eventData?.name ||
    "Cultural Committee GNDEC";
  const subtitle =
    eventData?.branding?.subtitle ||
    branding?.branding?.subtitle ||
    eventData?.venue ||
    "GNDEC Main Auditorium, Ludhiana";
  const entryNotes =
    eventData?.branding?.entryNotes ||
    branding?.branding?.entryNotes ||
    "Please report 15 minutes before the event. Have this digital pass open on your screen at the gate.";
  const accentColor =
    eventData?.branding?.accentColor ||
    branding?.branding?.accentColor ||
    "#2563eb";

  const theme = {
    bg: isDarkMode
      ? "radial-gradient(ellipse at 50% 0%, rgba(30, 58, 138, 0.3) 0%, transparent 70%), linear-gradient(135deg, #070c18 0%, #0d1527 50%, #152238 100%)"
      : "radial-gradient(ellipse at 50% 0%, rgba(191, 219, 254, 0.6) 0%, transparent 70%), linear-gradient(135deg, #dbeafe 0%, #e0e7ff 50%, #e2e8f0 100%)",
    cardBg: isDarkMode
      ? "rgba(15, 23, 42, 0.85)"
      : "rgba(255, 255, 255, 0.95)",
    cardBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.1)"
      : "1px solid rgba(219, 234, 254, 0.9)",
    textPrimary: isDarkMode ? "#f8fafc" : "#0f172a",
    textSecondary: isDarkMode ? "#94a3b8" : "#64748b",
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: theme.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.textPrimary,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <h5 style={{ fontWeight: 600 }}>Loading Digital Gate Pass...</h5>
        </div>
      </div>
    );
  }

  if (error || !seatData) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: theme.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "460px",
            width: "100%",
            background: theme.cardBg,
            border: theme.cardBorder,
            borderRadius: "24px",
            padding: "36px 28px",
            textAlign: "center",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⛔</div>
          <h4 style={{ color: "#ef4444", fontWeight: 700, marginBottom: "12px" }}>
            Pass Unavailable
          </h4>
          <p style={{ color: theme.textSecondary, fontSize: "0.95rem", lineHeight: 1.6 }}>
            {error || "We could not locate this pass. It may have expired or been revoked."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              marginTop: "20px",
              background: accentColor,
              border: "none",
              color: "#ffffff",
              borderRadius: "14px",
              padding: "10px 24px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go to Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pass-page-wrapper"
      style={{
        minHeight: "100vh",
        background: theme.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: theme.textPrimary,
      }}
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 10mm;
          }

          html, body, #root {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            display: block !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .pass-page-wrapper {
            min-height: 0 !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 auto !important;
            display: block !important;
            background: transparent !important;
          }

          .pass-ticket-card {
            max-width: 420px !important;
            width: 100% !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: 1.5px solid #cbd5e1 !important;
            border-radius: 20px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }

          .pass-ticket-header {
            padding: 14px 20px 10px !important;
          }

          .pass-ticket-header img {
            max-height: 44px !important;
            margin-bottom: 6px !important;
          }

          .pass-ticket-details {
            padding: 10px 20px 8px !important;
          }

          .pass-ticket-details h3 {
            margin-bottom: 8px !important;
            font-size: 1.25rem !important;
          }

          .pass-ticket-seat {
            padding: 8px 20px !important;
          }

          .pass-ticket-seat-badge {
            padding: 6px 18px !important;
            font-size: 1.2rem !important;
          }

          .pass-ticket-qr-section {
            padding: 10px 20px 14px !important;
            background: #f8fafc !important;
          }

          .pass-ticket-qr-container img,
          .pass-ticket-qr-container canvas {
            width: 140px !important;
            height: 140px !important;
          }

          .d-print-none,
          .pass-no-print,
          button {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Floating Controls */}
      <div
        className="d-print-none pass-no-print"
        style={{
          maxWidth: "440px",
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <div className="d-flex align-items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={() => navigate(`/checkin/${eventId}`)}
              style={{
                background: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                border: theme.cardBorder,
                borderRadius: "10px",
                padding: "6px 14px",
                color: theme.textPrimary,
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ← Gate Desk
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            background: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
            border: theme.cardBorder,
            borderRadius: "10px",
            padding: "6px 14px",
            color: theme.textPrimary,
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isDarkMode ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>

      {/* MOVIE-TICKET BOARDING PASS CARD */}
      <div
        className="pass-ticket-card"
        style={{
          maxWidth: "440px",
          width: "100%",
          background: theme.cardBg,
          border: theme.cardBorder,
          borderRadius: "28px",
          overflow: "hidden",
          boxShadow: isDarkMode
            ? "0 25px 60px -10px rgba(0, 0, 0, 0.8), 0 0 40px rgba(37, 99, 235, 0.15)"
            : "0 25px 60px -10px rgba(30, 58, 138, 0.2)",
          position: "relative",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* Decorative Top Accent Bar */}
        <div
          style={{
            height: "8px",
            background: `linear-gradient(90deg, ${accentColor} 0%, #d97706 50%, ${accentColor} 100%)`,
          }}
        />

        {/* 1. Ticket Header */}
        <div
          className="pass-ticket-header"
          style={{
            padding: "24px 24px 18px",
            textAlign: "center",
            borderBottom: `1px solid ${isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              style={{
                height: "56px",
                maxWidth: "200px",
                objectFit: "contain",
                marginBottom: "12px",
              }}
            />
          ) : (
            <div style={{ fontSize: "2.2rem", marginBottom: "6px" }}>🏛️</div>
          )}

          <div
            style={{
              textTransform: "uppercase",
              fontSize: "0.74rem",
              fontWeight: 800,
              letterSpacing: "1.5px",
              color: accentColor,
              marginBottom: "4px",
            }}
          >
            {orgTitle}
          </div>
          <div style={{ fontSize: "0.82rem", color: theme.textSecondary, fontWeight: 500 }}>
            {subtitle}
          </div>
        </div>

        {/* 2. Event Title & Details */}
        <div className="pass-ticket-details" style={{ padding: "20px 24px 16px" }}>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: theme.textSecondary,
              letterSpacing: "1px",
              marginBottom: "4px",
            }}
          >
            Official Entry Ticket
          </div>
          <h3
            style={{
              margin: "0 0 16px 0",
              fontWeight: 800,
              fontSize: "1.45rem",
              letterSpacing: "-0.5px",
              color: theme.textPrimary,
              lineHeight: 1.25,
            }}
          >
            {eventData?.name || "Auditorium Event"}
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              background: isDarkMode ? "rgba(0, 0, 0, 0.25)" : "rgba(241, 245, 249, 0.7)",
              borderRadius: "16px",
              padding: "14px 16px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.72rem", color: theme.textSecondary, fontWeight: 600 }}>
                📅 DATE
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: theme.textPrimary }}>
                {eventData?.date || "TBD"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", color: theme.textSecondary, fontWeight: 600 }}>
                ⏰ TIME
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: theme.textPrimary }}>
                {eventData?.time || "10:00 AM"}
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, paddingTop: "8px" }}>
              <div style={{ fontSize: "0.72rem", color: theme.textSecondary, fontWeight: 600 }}>
                📍 VENUE
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.86rem", color: theme.textPrimary }}>
                {eventData?.venue || "GNDEC Main Auditorium, Ludhiana"}
              </div>
            </div>
          </div>
        </div>

        {/* 3. CINEMA PERFORATED TEAR-OFF LINE */}
        <div
          className="pass-perforation"
          style={{
            position: "relative",
            margin: "4px 0",
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Left Notch */}
          <div
            style={{
              position: "absolute",
              left: "-14px",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: isDarkMode ? "#070c18" : "#dbeafe",
              boxShadow: "inset -2px 0 4px rgba(0,0,0,0.15)",
            }}
          />
          {/* Dashed Line */}
          <div
            style={{
              flex: 1,
              borderTop: `2px dashed ${isDarkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
              margin: "0 22px",
            }}
          />
          {/* Right Notch */}
          <div
            style={{
              position: "absolute",
              right: "-14px",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: isDarkMode ? "#070c18" : "#dbeafe",
              boxShadow: "inset 2px 0 4px rgba(0,0,0,0.15)",
            }}
          />
        </div>

        {/* 4. SEAT BADGE & ATTENDEE INFO */}
        <div className="pass-ticket-seat" style={{ padding: "16px 24px", textAlign: "center" }}>
          <div
            style={{
              fontSize: "0.74rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: theme.textSecondary,
              letterSpacing: "1px",
              marginBottom: "8px",
            }}
          >
            Reserved Seat Allocation
          </div>

          <div
            className="pass-ticket-seat-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: `linear-gradient(135deg, ${accentColor} 0%, #1d4ed8 100%)`,
              color: "#ffffff",
              padding: "10px 24px",
              borderRadius: "18px",
              fontSize: "1.45rem",
              fontWeight: 800,
              letterSpacing: "0.5px",
              boxShadow: "0 8px 25px rgba(37, 99, 235, 0.4)",
            }}
          >
            <span>💺</span>
            <span>{seatData.label || seatId}</span>
          </div>

          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary }}>
              {seatData.name || "Guest"}
            </div>
            {seatData.contact && (
              <div style={{ fontSize: "0.85rem", color: theme.textSecondary, marginTop: "2px" }}>
                📞 {seatData.contact}
              </div>
            )}
          </div>
        </div>

        {/* 5. QR CODE SCANNER TARGET */}
        <div
          className="pass-ticket-qr-section"
          style={{
            padding: "16px 24px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: isDarkMode ? "rgba(0, 0, 0, 0.2)" : "rgba(248, 250, 252, 0.8)",
            borderTop: `1px solid ${isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
          }}
        >
          {/* Live Status Pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              borderRadius: "20px",
              fontSize: "0.82rem",
              fontWeight: 700,
              marginBottom: "16px",
              background: seatData.hasCheckedIn
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(245, 158, 11, 0.15)",
              color: seatData.hasCheckedIn ? "#10b981" : "#f59e0b",
              border: `1px solid ${seatData.hasCheckedIn ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
            }}
          >
            <span>{seatData.hasCheckedIn ? "✅" : "🟡"}</span>
            <span>
              {seatData.hasCheckedIn
                ? `CHECKED IN ${seatData.checkedInByName ? `by ${seatData.checkedInByName}` : ""}`
                : "READY FOR ENTRY — SCAN AT GATE"}
            </span>
          </div>

          {/* QR Code Container */}
          <div
            className="pass-ticket-qr-container"
            style={{
              background: "#ffffff",
              padding: "14px",
              borderRadius: "20px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
              position: "relative",
              lineHeight: 0,
            }}
          >
            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt="Ticket QR Code"
                style={{
                  width: "180px",
                  height: "180px",
                  display: "block",
                  borderRadius: "8px",
                }}
              />
            ) : (
              <canvas ref={qrCanvasRef} width={180} height={180} />
            )}
          </div>

          <div
            style={{
              fontSize: "0.75rem",
              color: theme.textSecondary,
              marginTop: "12px",
              textAlign: "center",
              maxWidth: "280px",
              lineHeight: 1.4,
            }}
          >
            {entryNotes}
          </div>

          {/* Staff Quick-Admit Button (visible if logged-in user is viewing pass) */}
          {user && (
            <div className="d-print-none pass-no-print" style={{ width: "100%", marginTop: "18px" }}>
              {!seatData.hasCheckedIn ? (
                <button
                  type="button"
                  onClick={handleAdmitGuest}
                  disabled={isAdmitting}
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "14px",
                    padding: "12px",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    cursor: isAdmitting ? "not-allowed" : "pointer",
                    boxShadow: "0 6px 20px rgba(16, 185, 129, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <span>✓</span>
                  <span>{isAdmitting ? "Admitting..." : "Admit / Check In Guest"}</span>
                </button>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    fontSize: "0.85rem",
                    color: "#10b981",
                    fontWeight: 600,
                  }}
                >
                  ✓ Admitted at{" "}
                  {seatData.checkedInAt?.toDate
                    ? seatData.checkedInAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : new Date(seatData.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          )}

          {/* Print/Share Button */}
          <div className="d-print-none pass-no-print d-flex gap-2 mt-3" style={{ width: "100%" }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                flex: 1,
                background: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                border: theme.cardBorder,
                borderRadius: "12px",
                padding: "8px 12px",
                color: theme.textPrimary,
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🖨️ Print Pass
            </button>
            {navigator.share && (
              <button
                type="button"
                onClick={() => {
                  navigator.share({
                    title: `${eventData?.name || "Event"} Gate Pass`,
                    text: `Official Gate Pass for ${seatData.name} - Seat ${seatData.label}`,
                    url: window.location.href,
                  });
                }}
                style={{
                  flex: 1,
                  background: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                  border: theme.cardBorder,
                  borderRadius: "12px",
                  padding: "8px 12px",
                  color: theme.textPrimary,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                📱 Share Pass
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
