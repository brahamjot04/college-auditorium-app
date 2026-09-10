import { useState, useRef, useEffect } from "react";

function CustomSelect({
  value,
  onChange,
  options = [],
  isDarkMode = false,
  placeholder = "Select an option...",
  disabled = false,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < options.length) {
        onChange(options[highlightedIndex].value);
        setIsOpen(false);
      } else {
        setIsOpen((prev) => !prev);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : 0,
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(options.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : options.length - 1,
        );
      }
    }
  };

  const selectedOption = options.find((opt) => opt.value === value);

  // Colors based on theme
  const theme = {
    triggerBg: isDarkMode
      ? "rgba(15, 23, 42, 0.65)"
      : "rgba(255, 255, 255, 0.85)",
    triggerBorder: isOpen
      ? isDarkMode
        ? "1px solid #3b82f6"
        : "1px solid #2563eb"
      : isDarkMode
        ? "1px solid rgba(255, 255, 255, 0.12)"
        : "1px solid rgba(203, 213, 225, 0.85)",
    triggerShadow: isOpen
      ? isDarkMode
        ? "0 0 0 3px rgba(59, 130, 246, 0.25), 0 8px 20px rgba(0, 0, 0, 0.35)"
        : "0 0 0 3px rgba(37, 99, 235, 0.18), 0 8px 20px rgba(30, 58, 138, 0.12)"
      : "none",
    textPrimary: isDarkMode ? "#f8fafc" : "#0f172a",
    textSecondary: isDarkMode ? "#94a3b8" : "#64748b",
    chevronColor: isDarkMode ? "#94a3b8" : "#64748b",
    menuBg: isDarkMode
      ? "rgba(15, 23, 42, 0.96)"
      : "rgba(255, 255, 255, 0.98)",
    menuBorder: isDarkMode
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "1px solid rgba(219, 234, 254, 0.8)",
    menuShadow: isDarkMode
      ? "0 20px 45px -10px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.06)"
      : "0 20px 45px -10px rgba(30, 58, 138, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.9)",
    optionHoverBg: isDarkMode
      ? "rgba(59, 130, 246, 0.14)"
      : "rgba(239, 246, 255, 0.95)",
    optionSelectedBg: isDarkMode
      ? "rgba(37, 99, 235, 0.25)"
      : "rgba(219, 234, 254, 0.75)",
    accentColor: isDarkMode ? "#60a5fa" : "#2563eb",
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        userSelect: "none",
      }}
    >
      {/* TRIGGER BUTTON */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          background: theme.triggerBg,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: theme.triggerBorder,
          borderRadius: "14px",
          padding: "11px 16px",
          color: selectedOption ? theme.textPrimary : theme.textSecondary,
          fontSize: "0.92rem",
          fontWeight: 500,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: theme.triggerShadow,
          outline: "none",
          transition: "all 0.2s ease",
          opacity: disabled ? 0.6 : 1,
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minWidth: 0,
            flexGrow: 1,
          }}
        >
          {selectedOption?.icon && (
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        {/* ROTATING CHEVRON ICON */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.chevronColor,
            fontSize: "0.75rem",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 1100,
            background: theme.menuBg,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: theme.menuBorder,
            borderRadius: "16px",
            boxShadow: theme.menuShadow,
            padding: "6px",
            maxHeight: "280px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            animation: "customSelectFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <style>{`
            @keyframes customSelectFadeIn {
              from {
                opacity: 0;
                transform: translateY(-6px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>

          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightedIndex;

            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  background: isSelected
                    ? theme.optionSelectedBg
                    : isHighlighted
                      ? theme.optionHoverBg
                      : "transparent",
                  color: isSelected ? theme.accentColor : theme.textPrimary,
                  transition: "background 0.15s ease, color 0.15s ease",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    minWidth: 0,
                    flexGrow: 1,
                  }}
                >
                  {opt.icon && (
                    <span
                      style={{
                        fontSize: "1.15rem",
                        flexShrink: 0,
                        width: "28px",
                        height: "28px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "8px",
                        background: isDarkMode
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(0, 0, 0, 0.04)",
                      }}
                    >
                      {opt.icon}
                    </span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: isSelected ? 600 : 500,
                        fontSize: "0.88rem",
                        lineHeight: 1.3,
                      }}
                    >
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: theme.textSecondary,
                          marginTop: "2px",
                          lineHeight: 1.25,
                        }}
                      >
                        {opt.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Checkmark for Selected State */}
                {isSelected && (
                  <span
                    style={{
                      color: theme.accentColor,
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      flexShrink: 0,
                      paddingRight: "4px",
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomSelect;
