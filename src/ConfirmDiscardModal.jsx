import { useEffect } from "react";

function ConfirmDiscardModal({
  isOpen,
  onKeepEditing,
  onDiscard,
  isDarkMode = false,
  title = "Unsaved Changes",
  message = "You have unsaved changes that will be lost, including any newly uploaded logo. Are you sure you want to discard your changes and close?",
}) {
  // Listen for Escape key to close the confirmation dialog (Keep Editing)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onKeepEditing();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onKeepEditing]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onKeepEditing();
      }}
    >
      <div
        style={{
          background: isDarkMode ? "#0f172a" : "#ffffff",
          border: isDarkMode
            ? "1px solid rgba(255, 255, 255, 0.12)"
            : "1px solid rgba(203, 213, 225, 0.9)",
          borderRadius: "24px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
          maxWidth: "440px",
          width: "100%",
          padding: "26px",
          color: isDarkMode ? "#f8fafc" : "#0f172a",
          animation: "confirmModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          position: "relative",
        }}
      >
        <style>{`
          @keyframes confirmModalPop {
            from { opacity: 0; transform: scale(0.95) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Warning Icon & Header */}
        <div className="d-flex align-items-center gap-3 mb-3">
          <div
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "14px",
              background: isDarkMode
                ? "rgba(239, 68, 68, 0.15)"
                : "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.4rem",
              flexShrink: 0,
            }}
          >
            ⚠️
          </div>
          <div>
            <h5
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: "1.1rem",
                color: isDarkMode ? "#f8fafc" : "#0f172a",
              }}
            >
              {title}
            </h5>
            <div
              style={{
                fontSize: "0.76rem",
                color: isDarkMode ? "#94a3b8" : "#64748b",
                fontWeight: 500,
                marginTop: "2px",
              }}
            >
              Changes will not be saved
            </div>
          </div>
        </div>

        {/* Body Text */}
        <p
          style={{
            fontSize: "0.86rem",
            color: isDarkMode ? "#cbd5e1" : "#475569",
            lineHeight: 1.55,
            marginBottom: "24px",
          }}
        >
          {message}
        </p>

        {/* Action Buttons */}
        <div className="d-flex gap-2 justify-content-end">
          <button
            type="button"
            onClick={onKeepEditing}
            style={{
              flex: 1,
              background: isDarkMode
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.05)",
              border: isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.12)"
                : "1px solid #cbd5e1",
              color: isDarkMode ? "#f8fafc" : "#0f172a",
              borderRadius: "12px",
              padding: "10px 16px",
              fontWeight: 600,
              fontSize: "0.86rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            style={{
              flex: 1.2,
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              border: "none",
              color: "#ffffff",
              borderRadius: "12px",
              padding: "10px 16px",
              fontWeight: 600,
              fontSize: "0.86rem",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)",
              transition: "all 0.15s ease",
            }}
          >
            Discard & Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDiscardModal;
