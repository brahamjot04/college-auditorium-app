import { useState, useEffect } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { uploadToGitHub, fetchImageFromGitHub } from "./utils/github";

function EventBrandingModal({ eventId, eventData, onClose, onSaved, isDarkMode = false }) {
  const [orgTitle, setOrgTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [entryNotes, setEntryNotes] = useState("");
  const [logoPath, setLogoPath] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  const presetColors = [
    { label: "Classic Blue", value: "#2563eb" },
    { label: "Royal Indigo", value: "#4f46e5" },
    { label: "Purple", value: "#7c3aed" },
    { label: "Emerald Green", value: "#059669" },
    { label: "Crimson Red", value: "#dc2626" },
    { label: "Amber Orange", value: "#d97706" },
    { label: "Cyan Blue", value: "#0891b2" },
  ];

  // Load existing event branding or fallback to system default
  useEffect(() => {
    const existing = eventData?.branding;
    if (existing) {
      setOrgTitle(existing.orgTitle || eventData?.name || "Cultural Committee GNDEC");
      setSubtitle(existing.subtitle || eventData?.venue || "GNDEC Main Auditorium, Ludhiana");
      setAccentColor(existing.accentColor || "#2563eb");
      setEntryNotes(
        existing.entryNotes ||
          "Please report 15 minutes before the event. Have this digital pass open on your screen at the gate.",
      );
      if (existing.logoPath) {
        setLogoPath(existing.logoPath);
        fetchImageFromGitHub(existing.logoPath).then((url) => {
          if (url) setLogoPreview(url);
        });
      }
    } else {
      // Fetch system defaults as baseline
      getDoc(doc(db, "system_settings", "config"))
        .then((snap) => {
          if (snap.exists() && snap.data().branding) {
            const b = snap.data().branding;
            setOrgTitle(b.orgTitle || "Cultural Committee GNDEC");
            setSubtitle(b.subtitle || "GNDEC Main Auditorium, Ludhiana");
            setAccentColor(b.accentColor || "#2563eb");
            setEntryNotes(
              b.entryNotes ||
                "Please report 15 minutes before the event. Have this digital pass open on your screen at the gate.",
            );
            if (b.logoPath) {
              setLogoPath(b.logoPath);
              fetchImageFromGitHub(b.logoPath).then((url) => {
                if (url) setLogoPreview(url);
              });
            }
          } else {
            setOrgTitle("Cultural Committee GNDEC");
            setSubtitle("GNDEC Main Auditorium, Ludhiana");
            setAccentColor("#2563eb");
            setEntryNotes(
              "Please report 15 minutes before the event. Have this digital pass open on your screen at the gate.",
            );
          }
        })
        .catch(() => {
          setOrgTitle("Cultural Committee GNDEC");
          setSubtitle("GNDEC Main Auditorium, Ludhiana");
          setAccentColor("#2563eb");
          setEntryNotes(
            "Please report 15 minutes before the event. Have this digital pass open on your screen at the gate.",
          );
        });
    }
  }, [eventData]);

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, SVG, WebP).");
      return;
    }

    setIsUploadingLogo(true);
    setError("");
    try {
      const path = await uploadToGitHub(file, file.name, "auditorium-assets");
      if (path) {
        setLogoPath(path);
        const url = await fetchImageFromGitHub(path);
        if (url) setLogoPreview(url);
      }
    } catch (err) {
      console.error("Logo upload error:", err);
      setError("Failed to upload logo to GitHub: " + err.message);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPath("");
    setLogoPreview("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgTitle.trim()) {
      setError("Please provide an Organizer Title.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const brandingData = {
        orgTitle: orgTitle.trim(),
        subtitle: subtitle.trim(),
        accentColor: accentColor.trim() || "#2563eb",
        entryNotes: entryNotes.trim(),
        logoPath: logoPath.trim(),
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, "events", eventId), {
        branding: brandingData,
      });

      setSaveSuccess(true);
      if (onSaved) onSaved(brandingData);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Failed to save event branding:", err);
      setError("Failed to save event branding: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const theme = {
    cardBg: isDarkMode ? "#0f172a" : "#ffffff",
    cardBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(203, 213, 225, 0.9)",
    textPrimary: isDarkMode ? "#f8fafc" : "#0f172a",
    textSecondary: isDarkMode ? "#94a3b8" : "#64748b",
    inputBg: isDarkMode ? "rgba(15, 23, 42, 0.85)" : "#f8fafc",
    inputBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid #cbd5e1",
    inputText: isDarkMode ? "#f8fafc" : "#0f172a",
    previewBg: isDarkMode ? "#070c18" : "#f1f5f9",
  };

  return (
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: theme.cardBg,
          border: theme.cardBorder,
          borderRadius: "26px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8)",
          maxWidth: "680px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          position: "relative",
          color: theme.textPrimary,
          animation: "brandingModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <style>{`
          @keyframes brandingModalPop {
            from { opacity: 0; transform: scale(0.96) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: isDarkMode
              ? "1px solid rgba(255, 255, 255, 0.1)"
              : "1px solid rgba(226, 232, 240, 0.9)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            background: theme.cardBg,
            zIndex: 10,
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.3rem" }}>🎨</span>
            <div>
              <h5 style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem" }}>
                Event Pass Branding
              </h5>
              <div style={{ fontSize: "0.76rem", color: theme.textSecondary }}>
                Customized for <strong>{eventData?.name || "This Event"}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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
          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#ef4444",
                borderRadius: "12px",
                padding: "10px 14px",
                fontSize: "0.84rem",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          {saveSuccess && (
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
              ✓ Event pass branding updated successfully!
            </div>
          )}

          {/* Live Preview Section */}
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                fontSize: "0.76rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: theme.textSecondary,
                marginBottom: "8px",
              }}
            >
              Live Pass Header Preview
            </div>
            <div
              style={{
                background: theme.previewBg,
                border: theme.cardBorder,
                borderRadius: "18px",
                padding: "18px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo"
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "14px",
                    objectFit: "cover",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }}
                />
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
                    color: theme.textPrimary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {orgTitle || "Event Organizer Title"}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: theme.textSecondary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {subtitle || "Venue / Subtitle"}
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
                  {eventData?.name || "Sample Event"}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* 1. Host Organization / Committee Title */}
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
                Organizer / Host Title <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Cultural Committee GNDEC or ISTE Students Chapter"
                value={orgTitle}
                onChange={(e) => setOrgTitle(e.target.value)}
                style={{
                  width: "100%",
                  background: theme.inputBg,
                  border: theme.inputBorder,
                  borderRadius: "12px",
                  padding: "10px 14px",
                  color: theme.inputText,
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
            </div>

            {/* 2. Subtitle / Venue */}
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
                Subtitle / Venue Description
              </label>
              <input
                type="text"
                placeholder="e.g. GNDEC Main Auditorium, Ludhiana"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                style={{
                  width: "100%",
                  background: theme.inputBg,
                  border: theme.inputBorder,
                  borderRadius: "12px",
                  padding: "10px 14px",
                  color: theme.inputText,
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
            </div>

            {/* 3. Accent Color */}
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
                Pass Accent / Theme Color
              </label>
              <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                {presetColors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setAccentColor(c.value)}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: c.value,
                      border:
                        accentColor.toLowerCase() === c.value.toLowerCase()
                          ? "3px solid #ffffff"
                          : "2px solid transparent",
                      outline:
                        accentColor.toLowerCase() === c.value.toLowerCase()
                          ? `2px solid ${c.value}`
                          : "none",
                      cursor: "pointer",
                      transition: "transform 0.15s ease",
                      transform:
                        accentColor.toLowerCase() === c.value.toLowerCase()
                          ? "scale(1.15)"
                          : "scale(1)",
                    }}
                    title={c.label}
                  />
                ))}
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  style={{
                    width: "36px",
                    height: "32px",
                    padding: 0,
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: "transparent",
                  }}
                  title="Pick custom color"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  style={{
                    width: "90px",
                    background: theme.inputBg,
                    border: theme.inputBorder,
                    borderRadius: "8px",
                    padding: "4px 8px",
                    color: theme.inputText,
                    fontSize: "0.82rem",
                    fontFamily: "monospace",
                  }}
                />
              </div>
            </div>

            {/* 4. Event Logo */}
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
                Event Logo (GitHub Repository Hosted)
              </label>
              <div className="d-flex align-items-center gap-3">
                <input
                  type="file"
                  id="event-logo-upload"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: "none" }}
                />
                <label
                  htmlFor="event-logo-upload"
                  style={{
                    background: isDarkMode
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.05)",
                    border: theme.inputBorder,
                    color: theme.textPrimary,
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
                  {isUploadingLogo ? "Uploading to GitHub..." : "📁 Upload Event Logo"}
                </label>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
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
                    color: theme.textSecondary,
                    marginTop: "4px",
                    fontFamily: "monospace",
                  }}
                >
                  Path: {logoPath}
                </div>
              )}
            </div>

            {/* 5. Custom Gate Entry Notes */}
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
                Gate Entry Notes & Instructions
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Please report 15 minutes prior. Show this pass on your phone at Entry Gate A."
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
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
                onClick={onClose}
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
                disabled={isSaving || isUploadingLogo}
                style={{
                  flex: 2,
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "12px",
                  padding: "10px",
                  fontWeight: 600,
                  cursor: isSaving || isUploadingLogo ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 15px rgba(37, 99, 235, 0.35)",
                }}
              >
                {isSaving ? "Saving Branding..." : "Save Event Branding"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EventBrandingModal;
