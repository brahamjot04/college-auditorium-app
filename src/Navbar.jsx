import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { useAuth } from "./AuthContext";
import { uploadToGitHub, fetchImageFromGitHub } from "./utils/github";
import { sendGatePassEmail } from "./utils/emailService";
import ConfirmDiscardModal from "./ConfirmDiscardModal";

function Navbar({ isDarkMode = false }) {
  const { user, userName, isAdmin, isSuperAdmin } = useAuth();
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  const [members, setMembers] = useState([]);
  const navigate = useNavigate();

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [settingsTab, setSettingsTab] = useState("email");
  const [serviceId, setServiceId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [orgTitle, setOrgTitle] = useState("Cultural Committee GNDEC");
  const [subtitle, setSubtitle] = useState("GNDEC Main Auditorium, Ludhiana");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [entryNotes, setEntryNotes] = useState(
    "Please report 15 minutes before the event. Have this digital pass open on your screen at the gate.",
  );
  const [logoPath, setLogoPath] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Snapshot of saved Firestore settings for dirty checking and discarding unsaved edits
  const savedSettingsRef = useRef(null);
  const tempBlobUrlRef = useRef(null);

  // Load system settings from Firestore
  useEffect(() => {
    if (!isAdmin) return;
    getDoc(doc(db, "system_settings", "config"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const sId = data.email?.serviceId || "";
          const tId = data.email?.templateId || "";
          const pKey = data.email?.publicKey || "";
          const oTitle = data.branding?.orgTitle || "Cultural Committee GNDEC";
          const sub = data.branding?.subtitle || "GNDEC Main Auditorium, Ludhiana";
          const aColor = data.branding?.accentColor || "#2563eb";
          const eNotes =
            data.branding?.entryNotes ||
            "Please report 15 minutes before the event. Have this digital pass open on your screen at the gate.";
          const lPath = data.branding?.logoPath || "";

          setServiceId(sId);
          setTemplateId(tId);
          setPublicKey(pKey);
          setOrgTitle(oTitle);
          setSubtitle(sub);
          setAccentColor(aColor);
          setEntryNotes(eNotes);
          setLogoPath(lPath);
          setLogoPreview("");

          savedSettingsRef.current = {
            serviceId: sId,
            templateId: tId,
            publicKey: pKey,
            orgTitle: oTitle,
            subtitle: sub,
            accentColor: aColor,
            entryNotes: eNotes,
            logoPath: lPath,
            logoPreview: "",
          };

          if (lPath) {
            fetchImageFromGitHub(lPath).then((url) => {
              if (url) {
                setLogoPreview(url);
                if (savedSettingsRef.current) {
                  savedSettingsRef.current.logoPreview = url;
                }
              }
            });
          }
        } else {
          // Defaults from working setup
          const sId = "service_og3ze6m";
          const tId = "template_xbboh6j";
          const pKey = "PzNJuoItwBZtKTwOG";
          const oTitle = "Cultural Committee GNDEC";
          const sub = "GNDEC Main Auditorium, Ludhiana";
          const aColor = "#2563eb";
          const eNotes =
            "Please report 15 minutes before the event. Have this digital pass open on your screen at the gate.";
          const lPath = "";

          setServiceId(sId);
          setTemplateId(tId);
          setPublicKey(pKey);
          setOrgTitle(oTitle);
          setSubtitle(sub);
          setAccentColor(aColor);
          setEntryNotes(eNotes);
          setLogoPath(lPath);
          setLogoPreview("");

          savedSettingsRef.current = {
            serviceId: sId,
            templateId: tId,
            publicKey: pKey,
            orgTitle: oTitle,
            subtitle: sub,
            accentColor: aColor,
            entryNotes: eNotes,
            logoPath: lPath,
            logoPreview: "",
          };
        }
      })
      .catch((err) => console.warn("Could not load system settings:", err));
  }, [isAdmin, showSettingsModal]);

  // Check if form has unsaved modifications
  const hasUnsavedChanges = () => {
    if (!savedSettingsRef.current) return false;
    const s = savedSettingsRef.current;
    return (
      serviceId !== s.serviceId ||
      templateId !== s.templateId ||
      publicKey !== s.publicKey ||
      orgTitle !== s.orgTitle ||
      subtitle !== s.subtitle ||
      accentColor !== s.accentColor ||
      entryNotes !== s.entryNotes ||
      logoPath !== s.logoPath ||
      logoPreview !== s.logoPreview
    );
  };

  // Revert all fields back to the last saved snapshot
  const revertSettings = () => {
    if (tempBlobUrlRef.current) {
      URL.revokeObjectURL(tempBlobUrlRef.current);
      tempBlobUrlRef.current = null;
    }
    if (!savedSettingsRef.current) return;
    const s = savedSettingsRef.current;
    setServiceId(s.serviceId);
    setTemplateId(s.templateId);
    setPublicKey(s.publicKey);
    setOrgTitle(s.orgTitle);
    setSubtitle(s.subtitle);
    setAccentColor(s.accentColor);
    setEntryNotes(s.entryNotes);
    setLogoPath(s.logoPath);
    setLogoPreview(s.logoPreview);
  };

  // Handle closing settings modal: prompt via in-app ConfirmDiscardModal if unsaved changes exist
  const handleCloseSettings = () => {
    if (hasUnsavedChanges()) {
      setShowDiscardConfirm(true);
      return;
    }
    setShowSettingsModal(false);
  };

  const handleConfirmDiscard = () => {
    revertSettings();
    setShowDiscardConfirm(false);
    setShowSettingsModal(false);
  };

  const handleCancelDiscard = () => {
    setShowDiscardConfirm(false);
  };

  const handleCloseSettingsRef = useRef(handleCloseSettings);
  handleCloseSettingsRef.current = handleCloseSettings;

  // Escape key listener for settings modal
  useEffect(() => {
    if (!showSettingsModal) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          handleCloseSettingsRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSettingsModal, showDiscardConfirm]);

  // Listen to active members if user is admin
  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setMembers(list);
      },
      (err) => {
        console.error("Failed to fetch members in navbar:", err);
      },
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // Close profile dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setShowProfileMenu(false);
    };
    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showProfileMenu]);

  const activeMembers = members.filter(
    (u) => u.role === "superadmin" || u.role === "admin" || u.role === "user",
  );
  const pendingUsersCount = members.filter((m) => m.role === "pending").length;
  const userInitials = (userName || user?.displayName || user?.email || "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Logout with user confirmation
  const handleLogout = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to log out of the Cultural Committee GNDEC Auditorium Portal?",
    );
    if (!confirmed) return;

    sessionStorage.removeItem("home_active_tab");
    navigate("/?logged_out=true", { replace: true });
    await signOut(auth);
  };

  // Change Role Handler
  const changeUserRole = async (userId, userEmail, newRole) => {
    if (user && user.uid === userId) {
      alert("You cannot modify your own role.");
      return;
    }

    if (newRole === "user" && !isSuperAdmin) {
      alert("Permission Denied: Only a Super Admin can demote accounts to staff.");
      return;
    }

    const roleTitle = newRole === "admin" ? "Administrator" : "Staff Member";
    if (!window.confirm(`Change role for ${userEmail} to ${roleTitle}?`)) return;

    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch (err) {
      console.error("Failed to update user role:", err);
      alert("Failed to update role: " + err.message);
    }
  };

  // Revoke User Access Handler
  const revokeUser = async (userId, userEmail, targetRole) => {
    if (user && user.uid === userId) {
      alert("You cannot revoke your own access.");
      return;
    }

    if (targetRole === "superadmin") {
      alert("Super Admin accounts can only be managed directly in the Firebase Console.");
      return;
    }

    if (targetRole === "admin" && !isSuperAdmin) {
      alert("Permission Denied: Only a Super Admin can revoke administrator accounts.");
      return;
    }

    if (!window.confirm(`Revoke system access for ${userEmail}?`)) return;

    try {
      await updateDoc(doc(db, "users", userId), { role: "revoked" });
    } catch (err) {
      console.error("Failed to revoke user:", err);
      alert("Failed to revoke access: " + err.message);
    }
  };

  // Save Settings Handler
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setIsSavingSettings(true);
    setSaveSuccessMsg("");

    try {
      await setDoc(
        doc(db, "system_settings", "config"),
        {
          email: {
            serviceId: serviceId.trim(),
            templateId: templateId.trim(),
            publicKey: publicKey.trim(),
          },
          branding: {
            orgTitle: orgTitle.trim(),
            subtitle: subtitle.trim(),
            accentColor: accentColor.trim(),
            entryNotes: entryNotes.trim(),
            logoPath: logoPath.trim(),
          },
          updatedAt: new Date(),
          updatedByName: userName || user?.email || "Admin",
        },
        { merge: true },
      );

      if (tempBlobUrlRef.current) {
        tempBlobUrlRef.current = null;
      }
      savedSettingsRef.current = {
        serviceId: serviceId.trim(),
        templateId: templateId.trim(),
        publicKey: publicKey.trim(),
        orgTitle: orgTitle.trim(),
        subtitle: subtitle.trim(),
        accentColor: accentColor.trim(),
        entryNotes: entryNotes.trim(),
        logoPath: logoPath.trim(),
        logoPreview: logoPreview,
      };

      setSaveSuccessMsg("✅ Settings saved successfully! Changes apply instantly across the portal.");
      setTimeout(() => setSaveSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      const isPermError =
        err?.code === "permission-denied" ||
        err?.message?.toLowerCase().includes("permission");
      if (isPermError) {
        alert(
          "Permission Denied: Firebase Firestore security rules blocked writing to 'system_settings/config'.\n\nPlease copy and publish the updated firestore.rules in your Firebase Console (Firestore Database -> Rules tab).",
        );
      } else {
        alert("Failed to save settings: " + err.message);
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Upload Logo Handler
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (PNG, JPG, SVG, WebP).");
      return;
    }

    // Instant local preview in 0ms (no need to wait for GitHub or Save Settings)
    if (tempBlobUrlRef.current) {
      URL.revokeObjectURL(tempBlobUrlRef.current);
    }
    const localUrl = URL.createObjectURL(file);
    tempBlobUrlRef.current = localUrl;
    setLogoPreview(localUrl);

    setIsUploadingLogo(true);
    try {
      const path = await uploadToGitHub(file, file.name, "auditorium-assets");
      if (path) {
        setLogoPath(path);
        const dataUrl = await fetchImageFromGitHub(path);
        if (dataUrl) setLogoPreview(dataUrl);
      }
    } catch (err) {
      console.error("Logo upload error:", err);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Send Test Email Handler
  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testRecipient) return;

    setIsSendingTest(true);
    setTestResult(null);

    const res = await sendGatePassEmail({
      emailConfig: { serviceId, templateId, publicKey },
      brandingConfig: { orgTitle, subtitle, entryNotes, accentColor },
      eventName: "Sample Orientation & Cultural Gala",
      eventDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      eventTime: "10:30 AM",
      venue: subtitle || "GNDEC Main Auditorium",
      guestName: userName || "Auditorium Guest",
      guestEmail: testRecipient,
      guestContact: "9876543210",
      seatLabel: "Row A - Seat 1",
      passUrl: `${window.location.origin}/pass/test_sample_pass`,
    });

    setIsSendingTest(false);
    setTestResult(res);
  };

  // Color tokens
  const navTheme = {
    bg: isDarkMode ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.88)",
    border: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(255, 255, 255, 0.8)",
    shadow: isDarkMode
      ? "0 4px 20px rgba(0, 0, 0, 0.4)"
      : "0 4px 20px rgba(30, 58, 138, 0.06)",
    textPrimary: isDarkMode ? "#f8fafc" : "#0f172a",
    textSecondary: isDarkMode ? "#94a3b8" : "#64748b",
    pillBg: isDarkMode ? "rgba(30, 58, 138, 0.25)" : "rgba(219, 234, 254, 0.7)",
    pillBorder: isDarkMode
      ? "1px solid rgba(59, 130, 246, 0.3)"
      : "1px solid rgba(147, 197, 253, 0.8)",
    btnBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.85)",
    modalCardBg: isDarkMode ? "#0d1527" : "#ffffff",
    modalBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.8)",
    cardBg: isDarkMode ? "rgba(15, 23, 42, 0.7)" : "rgba(241, 245, 249, 0.8)",
    cardBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(203, 213, 225, 0.85)",
    inputBg: isDarkMode ? "rgba(15, 23, 42, 0.75)" : "#ffffff",
    inputBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid #cbd5e1",
    inputText: isDarkMode ? "#f8fafc" : "#0f172a",
    inputPlaceholder: isDarkMode ? "#94a3b8" : "#64748b",
  };

  return (
    <>
      <header
        style={{
          background: navTheme.bg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: navTheme.border,
          position: "sticky",
          top: 0,
          zIndex: 1050,
          padding: "14px 0",
          boxShadow: navTheme.shadow,
        }}
        className="d-print-none"
      >
        <div className="container d-flex flex-wrap justify-content-between align-items-center gap-3">
          {/* Brand & Emblem (Clickable to go home) */}
          <div
            onClick={() => navigate("/home")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "14px",
                background: isDarkMode
                  ? "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)"
                  : "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isDarkMode
                  ? "0 6px 16px rgba(59, 130, 246, 0.35)"
                  : "0 6px 14px rgba(37, 99, 235, 0.25)",
              }}
            >
              <svg
                width="22"
                height="22"
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
            <div>
              <h1
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  margin: 0,
                  letterSpacing: "-0.3px",
                  color: navTheme.textPrimary,
                }}
              >
                Cultural Committee GNDEC
              </h1>
              <p
                style={{
                  fontSize: "0.75rem",
                  margin: 0,
                  color: navTheme.textSecondary,
                  fontWeight: 500,
                }}
              >
                Auditorium Event Management System
              </p>
            </div>
          </div>

          {/* User Profile Avatar Dropdown */}
          <div style={{ position: "relative" }} ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              aria-expanded={showProfileMenu}
              aria-label="User profile menu"
              style={{
                background: navTheme.pillBg,
                border: navTheme.pillBorder,
                borderRadius: "30px",
                padding: "5px 14px 5px 6px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: showProfileMenu
                  ? "0 0 0 3px rgba(37, 99, 235, 0.25)"
                  : "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isDarkMode
                  ? "rgba(59, 130, 246, 0.3)"
                  : "rgba(147, 197, 253, 0.8)";
              }}
            >
              {/* Avatar Circle */}
              <div
                style={{
                  position: "relative",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: isSuperAdmin
                    ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                    : isAdmin
                      ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                      : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                {userInitials}
                {pendingUsersCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-2px",
                      right: "-2px",
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#ef4444",
                      border: "2px solid #ffffff",
                    }}
                    title={`${pendingUsersCount} pending approval request(s)`}
                  />
                )}
              </div>

              {/* User Name & Role Label */}
              <div style={{ textAlign: "left", lineHeight: 1.2 }}>
                <div
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    color: navTheme.textPrimary,
                    maxWidth: "140px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {userName || "Staff"}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: isSuperAdmin
                      ? "#f87171"
                      : isAdmin
                        ? "#60a5fa"
                        : "#34d399",
                    fontWeight: 600,
                  }}
                >
                  {isSuperAdmin
                    ? "👑 Super Admin"
                    : isAdmin
                      ? "🛡️ Admin"
                      : "👤 Staff"}
                </div>
              </div>

              {/* Caret */}
              <span
                style={{
                  fontSize: "0.68rem",
                  color: navTheme.textSecondary,
                  transition: "transform 0.2s ease",
                  transform: showProfileMenu ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                ▼
              </span>
            </button>

            {/* Dropdown Menu Popover */}
            {showProfileMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: "250px",
                  background: navTheme.modalCardBg,
                  border: navTheme.modalBorder,
                  borderRadius: "18px",
                  boxShadow: isDarkMode
                    ? "0 25px 55px -5px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08)"
                    : "0 20px 45px -5px rgba(30, 58, 138, 0.2), 0 0 0 1px rgba(203, 213, 225, 0.8)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  padding: "8px",
                  zIndex: 1060,
                  animation: "profileMenuPop 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <style>{`
                  @keyframes profileMenuPop {
                    from { opacity: 0; transform: scale(0.95) translateY(-6px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                  }
                `}</style>

                {/* Profile Header */}
                <div
                  style={{
                    padding: "10px 12px",
                    borderBottom: isDarkMode
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid #f1f5f9",
                    marginBottom: "4px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.86rem",
                      fontWeight: 700,
                      color: navTheme.textPrimary,
                    }}
                  >
                    {userName || "Auditorium User"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: navTheme.textSecondary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user?.email || ""}
                  </div>
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowStaffModal(true);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 12px",
                        background: "transparent",
                        border: "none",
                        borderRadius: "10px",
                        color: navTheme.textPrimary,
                        fontSize: "0.84rem",
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
                      <span className="d-flex align-items-center gap-2">
                        <span>👥</span>
                        <span>Manage Staff</span>
                      </span>
                      <span
                        style={{
                          background: pendingUsersCount > 0 ? "#ef4444" : "#2563eb",
                          color: "#ffffff",
                          borderRadius: "20px",
                          padding: "1px 7px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                        }}
                      >
                        {pendingUsersCount > 0
                          ? `${pendingUsersCount} pending`
                          : activeMembers.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowSettingsModal(true);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "9px 12px",
                        background: "transparent",
                        border: "none",
                        borderRadius: "10px",
                        color: navTheme.textPrimary,
                        fontSize: "0.84rem",
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
                      <span>⚙️</span>
                      <span>Portal Settings</span>
                    </button>
                  </>
                )}

                {/* Divider */}
                <div
                  style={{
                    height: "1px",
                    background: isDarkMode
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.06)",
                    margin: "6px 0",
                  }}
                />

                {/* Sign Out */}
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 12px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "10px",
                    color: "#ef4444",
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span>🚪</span>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MANAGE STAFF MODAL (Custom Clean Overlay, Zero Bootstrap Conflicts) */}
      {showStaffModal && (
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
            if (e.target === e.currentTarget) setShowStaffModal(false);
          }}
        >
          <div
            style={{
              background: navTheme.modalCardBg,
              border: navTheme.modalBorder,
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 26px",
                borderBottom: navTheme.border,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="d-flex align-items-center gap-3">
                <h4
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: "1.25rem",
                    color: navTheme.textPrimary,
                  }}
                >
                  👥 Staff & Admin Management
                </h4>
                <span
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    borderRadius: "20px",
                    padding: "2px 10px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                  }}
                >
                  {activeMembers.length} Members
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: navTheme.textSecondary,
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
            <div
              style={{
                padding: "24px 26px",
                overflowY: "auto",
                maxHeight: "65vh",
              }}
            >
              {/* Action Bar */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.86rem",
                    color: navTheme.textSecondary,
                  }}
                >
                  Manage permissions, promote members to admin, or revoke system access.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowStaffModal(false);
                    navigate("/add-user");
                  }}
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "12px",
                    padding: "8px 16px",
                    fontWeight: 600,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                  }}
                >
                  ➕ Add New Member
                </button>
              </div>

              {/* Members List */}
              {activeMembers.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "36px",
                    color: navTheme.textSecondary,
                  }}
                >
                  No active members found.
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {activeMembers.map((member) => {
                    const isCurrent =
                      (user && user.uid === member.id) ||
                      (user && user.email === member.email);
                    const isMemberSuperAdmin = member.role === "superadmin";
                    const isMemberAdmin = member.role === "admin";

                    return (
                      <div
                        key={member.id}
                        style={{
                          background: navTheme.cardBg,
                          border: navTheme.border,
                          borderRadius: "16px",
                          padding: "16px 18px",
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: "0.95rem",
                                color: navTheme.textPrimary,
                              }}
                            >
                              {member.name || member.email.split("@")[0]}
                            </span>
                            {isCurrent && (
                              <span
                                style={{
                                  background: isDarkMode
                                    ? "rgba(148, 163, 184, 0.2)"
                                    : "rgba(100, 116, 139, 0.15)",
                                  color: isDarkMode ? "#cbd5e1" : "#475569",
                                  borderRadius: "10px",
                                  padding: "1px 7px",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                }}
                              >
                                You
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "0.82rem",
                              color: navTheme.textSecondary,
                              marginTop: "2px",
                            }}
                          >
                            {member.email}
                          </div>
                          <div className="mt-2">
                            <span
                              style={{
                                borderRadius: "20px",
                                padding: "2px 8px",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                background: isMemberSuperAdmin
                                  ? "rgba(239, 68, 68, 0.2)"
                                  : isMemberAdmin
                                    ? "rgba(59, 130, 246, 0.2)"
                                    : "rgba(16, 185, 129, 0.2)",
                                color: isMemberSuperAdmin
                                  ? "#f87171"
                                  : isMemberAdmin
                                    ? "#60a5fa"
                                    : "#34d399",
                                border: isMemberSuperAdmin
                                  ? "1px solid rgba(239, 68, 68, 0.4)"
                                  : isMemberAdmin
                                    ? "1px solid rgba(59, 130, 246, 0.4)"
                                    : "1px solid rgba(16, 185, 129, 0.4)",
                              }}
                            >
                              {isMemberSuperAdmin
                                ? "👑 Super Admin"
                                : isMemberAdmin
                                  ? "🛡️ Administrator"
                                  : "👤 Staff Member"}
                            </span>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="d-flex align-items-center gap-2">
                          {!isCurrent && (
                            <>
                              {isMemberSuperAdmin ? (
                                <span
                                  style={{
                                    background: "none",
                                    border: navTheme.border,
                                    color: navTheme.textSecondary,
                                    borderRadius: "10px",
                                    padding: "4px 10px",
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                  }}
                                >
                                  Console Managed
                                </span>
                              ) : isMemberAdmin ? (
                                <>
                                  {isSuperAdmin && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        changeUserRole(
                                          member.id,
                                          member.email,
                                          "user",
                                        )
                                      }
                                      style={{
                                        background: "rgba(245, 158, 11, 0.12)",
                                        border: "1px solid rgba(245, 158, 11, 0.35)",
                                        color: isDarkMode ? "#fbbf24" : "#b45309",
                                        borderRadius: "10px",
                                        padding: "5px 11px",
                                        fontSize: "0.78rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Demote to Staff
                                    </button>
                                  )}
                                  {isSuperAdmin ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        revokeUser(
                                          member.id,
                                          member.email,
                                          member.role,
                                        )
                                      }
                                      style={{
                                        background: "rgba(239, 68, 68, 0.12)",
                                        border: "1px solid rgba(239, 68, 68, 0.3)",
                                        color: isDarkMode ? "#fca5a5" : "#b91c1c",
                                        borderRadius: "10px",
                                        padding: "5px 11px",
                                        fontSize: "0.78rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Revoke Access
                                    </button>
                                  ) : (
                                    <span
                                      style={{
                                        color: navTheme.textSecondary,
                                        fontSize: "0.8rem",
                                        fontWeight: 500,
                                      }}
                                    >
                                      Admin
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeUserRole(
                                        member.id,
                                        member.email,
                                        "admin",
                                      )
                                    }
                                    style={{
                                      background: isDarkMode
                                        ? "rgba(59, 130, 246, 0.14)"
                                        : "rgba(37, 99, 235, 0.1)",
                                      border: "1px solid rgba(59, 130, 246, 0.3)",
                                      color: isDarkMode ? "#93c5fd" : "#1d4ed8",
                                      borderRadius: "10px",
                                      padding: "5px 11px",
                                      fontSize: "0.78rem",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Make Admin
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      revokeUser(
                                        member.id,
                                        member.email,
                                        member.role,
                                      )
                                    }
                                    style={{
                                      background: "rgba(239, 68, 68, 0.12)",
                                      border: "1px solid rgba(239, 68, 68, 0.3)",
                                      color: isDarkMode ? "#fca5a5" : "#b91c1c",
                                      borderRadius: "10px",
                                      padding: "5px 11px",
                                      fontSize: "0.78rem",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Revoke Access
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 26px",
                borderTop: navTheme.border,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                style={{
                  background: isDarkMode
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.06)",
                  border: navTheme.btnBorder,
                  color: navTheme.textPrimary,
                  borderRadius: "12px",
                  padding: "8px 20px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SYSTEM SETTINGS & BRANDING MODAL (Redesigned to match Manage Staff UI/UX) */}
      {showSettingsModal && (
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
            if (e.target === e.currentTarget) handleCloseSettings();
          }}
        >
          <div
            style={{
              background: navTheme.modalCardBg,
              border: navTheme.modalBorder,
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.75)",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
              color: navTheme.textPrimary,
              animation: "settingsModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <style>{`
              @keyframes settingsModalPop {
                from { opacity: 0; transform: scale(0.96) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>

            {/* Modal Header (Matching Manage Staff Header) */}
            <div
              style={{
                padding: "20px 26px",
                borderBottom: navTheme.border,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div className="d-flex align-items-center gap-3">
                <h4
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: "1.25rem",
                    color: navTheme.textPrimary,
                  }}
                >
                  ⚙️ Portal & Gate Pass Settings
                </h4>
                <span
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    borderRadius: "20px",
                    padding: "2px 10px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                  }}
                >
                  ⚙️ System Config
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseSettings}
                style={{
                  background: "none",
                  border: "none",
                  color: navTheme.textSecondary,
                  fontSize: "1.3rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Segmented Pill Tab Bar (Matching Manage Staff / Home Pill Styles) */}
            <div
              style={{
                padding: "14px 26px",
                borderBottom: navTheme.border,
                display: "flex",
                gap: "10px",
                background: isDarkMode
                  ? "rgba(15, 23, 42, 0.45)"
                  : "rgba(248, 250, 252, 0.75)",
              }}
            >
              <button
                type="button"
                onClick={() => setSettingsTab("email")}
                style={{
                  background:
                    settingsTab === "email"
                      ? isDarkMode
                        ? "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)"
                        : "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)"
                      : isDarkMode
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.04)",
                  border:
                    settingsTab === "email"
                      ? "1px solid rgba(59, 130, 246, 0.55)"
                      : navTheme.border,
                  color: settingsTab === "email" ? "#ffffff" : navTheme.textSecondary,
                  borderRadius: "14px",
                  padding: "8px 18px",
                  fontWeight: settingsTab === "email" ? 700 : 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                  boxShadow:
                    settingsTab === "email"
                      ? "0 4px 14px rgba(37, 99, 235, 0.28)"
                      : "none",
                }}
              >
                <span>📧</span>
                <span>Email Delivery (EmailJS)</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab("branding")}
                style={{
                  background:
                    settingsTab === "branding"
                      ? isDarkMode
                        ? "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)"
                        : "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)"
                      : isDarkMode
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.04)",
                  border:
                    settingsTab === "branding"
                      ? "1px solid rgba(59, 130, 246, 0.55)"
                      : navTheme.border,
                  color: settingsTab === "branding" ? "#ffffff" : navTheme.textSecondary,
                  borderRadius: "14px",
                  padding: "8px 18px",
                  fontWeight: settingsTab === "branding" ? 700 : 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                  boxShadow:
                    settingsTab === "branding"
                      ? "0 4px 14px rgba(37, 99, 235, 0.28)"
                      : "none",
                }}
              >
                <span>🎨</span>
                <span>Pass Branding & Logo</span>
              </button>
            </div>

            {/* Modal Body with Scrollable Card Sections */}
            <div
              style={{
                padding: "24px 26px",
                overflowY: "auto",
                maxHeight: "65vh",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {saveSuccessMsg && (
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    color: "#10b981",
                    borderRadius: "14px",
                    padding: "12px 18px",
                    fontSize: "0.86rem",
                    fontWeight: 600,
                  }}
                >
                  {saveSuccessMsg}
                </div>
              )}

              {/* TAB 1: EMAIL CONFIGURATION */}
              {settingsTab === "email" && (
                <>
                  {/* Card 1: EmailJS Service Credentials */}
                  {(() => {
                    const isConfigured = Boolean(
                      serviceId.trim() && templateId.trim() && publicKey.trim(),
                    );

                    return (
                      <div
                        style={{
                          background: navTheme.cardBg,
                          border: navTheme.border,
                          borderRadius: "18px",
                          padding: "18px 20px",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-2 border-bottom border-secondary border-opacity-25">
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: "0.95rem",
                                color: navTheme.textPrimary,
                              }}
                            >
                              📧 EmailJS Service Credentials
                            </div>
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: navTheme.textSecondary,
                                marginTop: "2px",
                              }}
                            >
                              Enables automatic digital pass dispatch to attendee inboxes without a backend server.
                            </div>
                          </div>
                          <span
                            style={{
                              borderRadius: "20px",
                              padding: "3px 10px",
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              background: isConfigured
                                ? isDarkMode
                                  ? "rgba(16, 185, 129, 0.18)"
                                  : "rgba(16, 185, 129, 0.15)"
                                : isDarkMode
                                  ? "rgba(245, 158, 11, 0.2)"
                                  : "rgba(245, 158, 11, 0.15)",
                              color: isConfigured
                                ? isDarkMode
                                  ? "#6ee7b7"
                                  : "#047857"
                                : isDarkMode
                                  ? "#fbbf24"
                                  : "#b45309",
                              border: isConfigured
                                ? "1px solid rgba(16, 185, 129, 0.35)"
                                : "1px solid rgba(245, 158, 11, 0.35)",
                            }}
                          >
                            {isConfigured ? "🟢 Ready for Gate Passes" : "⚠️ Credentials Incomplete"}
                          </span>
                        </div>

                        <div className="row g-3">
                          <div className="col-12 col-md-6">
                            <label
                              style={{
                                display: "block",
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                marginBottom: "6px",
                                color: navTheme.textPrimary,
                              }}
                            >
                              Service ID <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. service_og3ze6m"
                              value={serviceId}
                              onChange={(e) => setServiceId(e.target.value)}
                              style={{
                                width: "100%",
                                background: navTheme.inputBg,
                                border: navTheme.inputBorder,
                                borderRadius: "12px",
                                padding: "9px 12px",
                                color: navTheme.inputText,
                                fontSize: "0.88rem",
                                fontFamily: "monospace",
                                outline: "none",
                              }}
                            />
                          </div>

                          <div className="col-12 col-md-6">
                            <label
                              style={{
                                display: "block",
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                marginBottom: "6px",
                                color: navTheme.textPrimary,
                              }}
                            >
                              Template ID <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. template_xbboh6j"
                              value={templateId}
                              onChange={(e) => setTemplateId(e.target.value)}
                              style={{
                                width: "100%",
                                background: navTheme.inputBg,
                                border: navTheme.inputBorder,
                                borderRadius: "12px",
                                padding: "9px 12px",
                                color: navTheme.inputText,
                                fontSize: "0.88rem",
                                fontFamily: "monospace",
                                outline: "none",
                              }}
                            />
                          </div>

                          <div className="col-12">
                            <label
                              style={{
                                display: "block",
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                marginBottom: "6px",
                                color: navTheme.textPrimary,
                              }}
                            >
                              Public Key (User ID) <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. PzNJuoItwBZtKTwOG"
                              value={publicKey}
                              onChange={(e) => setPublicKey(e.target.value)}
                              style={{
                                width: "100%",
                                background: navTheme.inputBg,
                                border: navTheme.inputBorder,
                                borderRadius: "12px",
                                padding: "9px 12px",
                                color: navTheme.inputText,
                                fontSize: "0.88rem",
                                fontFamily: "monospace",
                                outline: "none",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card 2: Interactive Test Email Dispatch */}
                  <div
                    style={{
                      background: navTheme.cardBg,
                      border: navTheme.border,
                      borderRadius: "18px",
                      padding: "18px 20px",
                    }}
                  >
                    <div className="mb-3">
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          color: navTheme.textPrimary,
                        }}
                      >
                        🧪 Test Pass Email Dispatch
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: navTheme.textSecondary,
                          marginTop: "2px",
                        }}
                      >
                        Send an instant live pass email to verify that your EmailJS keys are functioning.
                      </div>
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                      <input
                        type="email"
                        placeholder="Enter recipient email (e.g. yourname@college.ac.in)..."
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: "220px",
                          background: navTheme.inputBg,
                          border: navTheme.inputBorder,
                          borderRadius: "12px",
                          padding: "9px 12px",
                          color: navTheme.inputText,
                          fontSize: "0.88rem",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSendTestEmail}
                        disabled={isSendingTest || !testRecipient}
                        style={{
                          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                          border: "none",
                          color: "#ffffff",
                          borderRadius: "12px",
                          padding: "9px 18px",
                          fontSize: "0.84rem",
                          fontWeight: 600,
                          cursor: isSendingTest || !testRecipient ? "not-allowed" : "pointer",
                          boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                          opacity: isSendingTest || !testRecipient ? 0.65 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isSendingTest ? "Sending Test..." : "🚀 Send Test Pass"}
                      </button>
                    </div>

                    {testResult && (
                      <div
                        style={{
                          marginTop: "12px",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          padding: "8px 12px",
                          borderRadius: "10px",
                          background: testResult.success
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                          color: testResult.success ? "#10b981" : "#ef4444",
                          border: testResult.success
                            ? "1px solid rgba(16, 185, 129, 0.3)"
                            : "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                      >
                        {testResult.success
                          ? "✅ Test pass email dispatched successfully! Check your inbox."
                          : `❌ Dispatch Failed: ${testResult.error}`}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* TAB 2: PASS BRANDING & LOGO */}
              {settingsTab === "branding" && (
                <>
                  {/* Card 1: Live Pass Header Preview */}
                  <div
                    style={{
                      background: navTheme.cardBg,
                      border: navTheme.border,
                      borderRadius: "18px",
                      padding: "18px 20px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                        color: navTheme.textSecondary,
                        marginBottom: "10px",
                      }}
                    >
                      Live Pass Header Preview (Global Default)
                    </div>
                    <div
                      style={{
                        background: isDarkMode ? "#070c18" : "#f1f5f9",
                        border: navTheme.border,
                        borderRadius: "16px",
                        padding: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                      }}
                    >
                      {logoPreview ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            maxHeight: "56px",
                            maxWidth: "150px",
                            padding: "4px 6px",
                            borderRadius: "12px",
                            background: isDarkMode
                              ? "rgba(255, 255, 255, 0.05)"
                              : "rgba(0, 0, 0, 0.03)",
                            border: isDarkMode
                              ? "1px solid rgba(255, 255, 255, 0.08)"
                              : "1px solid rgba(0, 0, 0, 0.05)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                          }}
                        >
                          <img
                            src={logoPreview}
                            alt="Logo"
                            style={{
                              maxHeight: "48px",
                              maxWidth: "140px",
                              width: "auto",
                              height: "auto",
                              objectFit: "contain",
                              display: "block",
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: "52px",
                            height: "52px",
                            borderRadius: "14px",
                            background: accentColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#ffffff",
                            fontSize: "1.4rem",
                            fontWeight: 700,
                            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                          }}
                        >
                          🏛️
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "1.05rem",
                            color: navTheme.textPrimary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {orgTitle || "Cultural Committee GNDEC"}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: navTheme.textSecondary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {subtitle || "GNDEC Main Auditorium, Ludhiana"}
                        </div>
                        <div
                          style={{
                            display: "inline-block",
                            marginTop: "6px",
                            background: accentColor,
                            color: "#ffffff",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          Official Gate Pass
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Organization & Venue Names */}
                  <div
                    style={{
                      background: navTheme.cardBg,
                      border: navTheme.border,
                      borderRadius: "18px",
                      padding: "18px 20px",
                    }}
                  >
                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            marginBottom: "6px",
                            color: navTheme.textPrimary,
                          }}
                        >
                          Organization / Committee Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Cultural Committee GNDEC"
                          value={orgTitle}
                          onChange={(e) => setOrgTitle(e.target.value)}
                          style={{
                            width: "100%",
                            background: navTheme.inputBg,
                            border: navTheme.inputBorder,
                            borderRadius: "12px",
                            padding: "9px 12px",
                            color: navTheme.inputText,
                            fontSize: "0.88rem",
                            outline: "none",
                          }}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            marginBottom: "6px",
                            color: navTheme.textPrimary,
                          }}
                        >
                          Auditorium Venue / Subtitle
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. GNDEC Main Auditorium, Ludhiana"
                          value={subtitle}
                          onChange={(e) => setSubtitle(e.target.value)}
                          style={{
                            width: "100%",
                            background: navTheme.inputBg,
                            border: navTheme.inputBorder,
                            borderRadius: "12px",
                            padding: "9px 12px",
                            color: navTheme.inputText,
                            fontSize: "0.88rem",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Pass Accent Color */}
                  <div
                    style={{
                      background: navTheme.cardBg,
                      border: navTheme.border,
                      borderRadius: "18px",
                      padding: "18px 20px",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        marginBottom: "8px",
                        color: navTheme.textPrimary,
                      }}
                    >
                      Default Pass Accent / Theme Color
                    </label>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      {["#2563eb", "#4f46e5", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0f172a"].map(
                        (c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setAccentColor(c)}
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "50%",
                              background: c,
                              border:
                                accentColor.toLowerCase() === c.toLowerCase()
                                  ? "3px solid #ffffff"
                                  : "2px solid transparent",
                              outline:
                                accentColor.toLowerCase() === c.toLowerCase()
                                  ? `2px solid ${c}`
                                  : "none",
                              cursor: "pointer",
                              transition: "transform 0.15s ease",
                              transform:
                                accentColor.toLowerCase() === c.toLowerCase()
                                  ? "scale(1.15)"
                                  : "scale(1)",
                            }}
                          />
                        ),
                      )}
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        style={{
                          width: "36px",
                          height: "32px",
                          borderRadius: "8px",
                          border: "none",
                          cursor: "pointer",
                          background: "none",
                          padding: 0,
                        }}
                        title="Pick custom color"
                      />
                      <input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        style={{
                          width: "90px",
                          background: navTheme.inputBg,
                          border: navTheme.inputBorder,
                          borderRadius: "8px",
                          padding: "4px 8px",
                          color: navTheme.inputText,
                          fontSize: "0.82rem",
                          fontFamily: "monospace",
                        }}
                      />
                    </div>
                  </div>

                  {/* Card 4: GitHub-Hosted Logo */}
                  <div
                    style={{
                      background: navTheme.cardBg,
                      border: navTheme.border,
                      borderRadius: "18px",
                      padding: "18px 20px",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        marginBottom: "8px",
                        color: navTheme.textPrimary,
                      }}
                    >
                      Global College / Committee Logo (GitHub Hosted)
                    </label>
                    <div className="d-flex align-items-center gap-3">
                      <input
                        type="file"
                        id="portal-logo-upload"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                        style={{ display: "none" }}
                      />
                      <label
                        htmlFor="portal-logo-upload"
                        style={{
                          background: isDarkMode
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)",
                          border: navTheme.inputBorder,
                          color: navTheme.textPrimary,
                          borderRadius: "12px",
                          padding: "8px 16px",
                          fontSize: "0.84rem",
                          fontWeight: 600,
                          cursor: isUploadingLogo ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {isUploadingLogo ? "Uploading to GitHub..." : "📁 Upload New Logo"}
                      </label>
                      {logoPath && (
                        <button
                          type="button"
                          onClick={() => {
                            if (tempBlobUrlRef.current) {
                              URL.revokeObjectURL(tempBlobUrlRef.current);
                              tempBlobUrlRef.current = null;
                            }
                            setLogoPath("");
                            setLogoPreview("");
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                    {logoPath && (
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: navTheme.textSecondary,
                          marginTop: "6px",
                          fontFamily: "monospace",
                        }}
                      >
                        Path: {logoPath}
                      </div>
                    )}
                  </div>

                  {/* Card 5: Custom Entry Notes */}
                  <div
                    style={{
                      background: navTheme.cardBg,
                      border: navTheme.border,
                      borderRadius: "18px",
                      padding: "18px 20px",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        marginBottom: "6px",
                        color: navTheme.textPrimary,
                      }}
                    >
                      Default Gate Entry Notes & Attendee Instructions
                    </label>
                    <textarea
                      rows={3}
                      value={entryNotes}
                      onChange={(e) => setEntryNotes(e.target.value)}
                      style={{
                        width: "100%",
                        background: navTheme.inputBg,
                        border: navTheme.inputBorder,
                        borderRadius: "12px",
                        padding: "9px 12px",
                        color: navTheme.inputText,
                        fontSize: "0.88rem",
                        outline: "none",
                        resize: "vertical",
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer (Matching Manage Staff Footer) */}
            <div
              style={{
                padding: "16px 26px",
                borderTop: navTheme.border,
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={handleCloseSettings}
                style={{
                  background: isDarkMode
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.06)",
                  border: navTheme.btnBorder,
                  color: navTheme.textPrimary,
                  borderRadius: "12px",
                  padding: "8px 20px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSavingSettings || isUploadingLogo || !hasUnsavedChanges()}
                style={{
                  background:
                    isSavingSettings || isUploadingLogo || !hasUnsavedChanges()
                      ? isDarkMode
                        ? "rgba(255, 255, 255, 0.12)"
                        : "#cbd5e1"
                      : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  boxShadow:
                    isSavingSettings || isUploadingLogo || !hasUnsavedChanges()
                      ? "none"
                      : "0 4px 14px rgba(37, 99, 235, 0.3)",
                  border: "none",
                  color:
                    isSavingSettings || isUploadingLogo || !hasUnsavedChanges()
                      ? isDarkMode
                        ? "rgba(255, 255, 255, 0.4)"
                        : "#94a3b8"
                      : "#ffffff",
                  borderRadius: "12px",
                  padding: "8px 22px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor:
                    isSavingSettings || isUploadingLogo || !hasUnsavedChanges()
                      ? "not-allowed"
                      : "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {isSavingSettings ? "Saving..." : "💾 Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom In-App Confirm Discard Modal */}
      <ConfirmDiscardModal
        isOpen={showDiscardConfirm}
        onKeepEditing={handleCancelDiscard}
        onDiscard={handleConfirmDiscard}
        isDarkMode={isDarkMode}
        title="Discard Settings Changes?"
        message="You have unsaved changes that will be lost, including any uploaded logo or modified credentials. Are you sure you want to discard your changes and close?"
      />
    </>
  );
}

export default Navbar;
