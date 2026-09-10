import { useState } from "react";

function Footer({ isDarkMode = false, style = {}, className = "" }) {
  const [isHovered, setIsHovered] = useState(false);
  const currentYear = new Date().getFullYear();

  const textColor = isDarkMode
    ? "rgba(148, 163, 184, 0.75)"
    : "rgba(100, 116, 139, 0.85)";
  const accentColor = isDarkMode ? "#93c5fd" : "#2563eb";

  return (
    <footer
      style={{
        width: "100%",
        textAlign: "center",
        padding: "20px 16px",
        fontSize: "0.83rem",
        userSelect: "none",
        transition: "color 0.25s ease",
        marginTop: "auto",
        flexShrink: 0,
        ...style,
      }}
      className={`d-print-none ${className}`.trim()}
    >
      <span
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "inline-block",
          cursor: "pointer",
          transition: "all 0.25s ease",
          color: isHovered ? accentColor : textColor,
          letterSpacing: "0.2px",
        }}
        title={
          isHovered
            ? "Designed by Brahamjot Singh (Batch 2026)"
            : "Managed by Record Keeping Team"
        }
      >
        © {currentYear}{" "}
        <span
          style={{
            fontWeight: isHovered ? 600 : 500,
            transition: "all 0.2s ease",
          }}
        >
          {isHovered
            ? "Designed by Brahamjot Singh (Batch 2026)"
            : "Managed by Record Keeping Team"}
        </span>{" "}
        - Cultural Committee GNDEC
      </span>
    </footer>
  );
}

export default Footer;
