import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { useAuth } from "./AuthContext";

function Navbar({ isDarkMode = false }) {
  const { user, userName, isAdmin, isSuperAdmin } = useAuth();
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [members, setMembers] = useState([]);
  const navigate = useNavigate();

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

  const activeMembers = members.filter(
    (u) => u.role === "superadmin" || u.role === "admin" || u.role === "user",
  );

  // Logout with user confirmation
  const handleLogout = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to log out of the Cultural Committee GNDEC Auditorium Portal?",
    );
    if (!confirmed) return;

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
          zIndex: 1020,
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

          {/* User Profile Info & Controls */}
          <div className="d-flex align-items-center flex-wrap gap-2">
            {/* User Pill */}
            <div
              style={{
                background: navTheme.pillBg,
                border: navTheme.pillBorder,
                borderRadius: "30px",
                padding: "6px 14px",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ color: navTheme.textSecondary }}>Signed in as</span>
              <strong style={{ color: navTheme.textPrimary }}>{userName}</strong>
              <span
                style={{
                  borderRadius: "20px",
                  padding: "2px 8px",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  background: isSuperAdmin
                    ? "rgba(239, 68, 68, 0.2)"
                    : isAdmin
                      ? "rgba(59, 130, 246, 0.2)"
                      : "rgba(16, 185, 129, 0.2)",
                  color: isSuperAdmin
                    ? "#f87171"
                    : isAdmin
                      ? "#60a5fa"
                      : "#34d399",
                  border: isSuperAdmin
                    ? "1px solid rgba(239, 68, 68, 0.4)"
                    : isAdmin
                      ? "1px solid rgba(59, 130, 246, 0.4)"
                      : "1px solid rgba(16, 185, 129, 0.4)",
                }}
              >
                {isSuperAdmin
                  ? "👑 Super Admin"
                  : isAdmin
                    ? "🛡️ Admin"
                    : "👤 Staff"}
              </span>
            </div>

            {/* Manage Staff Button (Admin Only) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowStaffModal(true)}
                style={{
                  background: isDarkMode
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(255, 255, 255, 0.9)",
                  border: navTheme.btnBorder,
                  color: navTheme.textPrimary,
                  borderRadius: "14px",
                  padding: "7px 14px",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
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
                <span>👥 Manage Staff</span>
                <span
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    borderRadius: "20px",
                    padding: "1px 7px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  {activeMembers.length}
                </span>
              </button>
            )}

            {/* Logout Button with Confirmation */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: isDarkMode ? "#fca5a5" : "#b91c1c",
                borderRadius: "14px",
                padding: "7px 14px",
                fontSize: "0.84rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.22)";
                e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
              }}
            >
              Logout
            </button>
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
    </>
  );
}

export default Navbar;
