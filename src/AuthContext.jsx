import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let docUnsubscribe = null;

    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (docUnsubscribe) {
        docUnsubscribe();
        docUnsubscribe = null;
      }

      if (currentUser) {
        setUser(currentUser);
        // Real-time listener on user doc
        const userDocRef = doc(db, "users", currentUser.uid);
        docUnsubscribe = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const userRole = data.role || null;
              setRole(userRole);
              setUserName(
                data.name ||
                  currentUser.displayName ||
                  currentUser.email?.split("@")[0] ||
                  "Staff",
              );

              // If account was revoked, force sign-out
              if (userRole === "revoked") {
                signOut(auth);
                setRole(null);
              }
            } else {
              setRole(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Failed to fetch user profile:", error);
            setRole(null);
            setLoading(false);
          },
        );
      } else {
        setUser(null);
        setRole(null);
        setUserName("");
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (docUnsubscribe) docUnsubscribe();
    };
  }, []);

  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin" || isSuperAdmin;
  const isUser = role === "user";

  const value = {
    user,
    role,
    userName,
    isSuperAdmin,
    isAdmin,
    isUser,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
