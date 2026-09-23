// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Dynamic authDomain: uses current hostname on deployed environments (e.g. test-audi.vercel.app)
// to enable first-party authentication proxying via vercel.json.
// Falls back to theatre-event-gndec.firebaseapp.com on localhost.
const getAuthDomain = () => {
  if (typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return hostname;
    }
  }
  return "theatre-event-gndec.firebaseapp.com";
};

const firebaseConfig = {
  apiKey: "AIzaSyAFEpIvkp0jx--oLelEstYbDXrzJ1rghqQ",
  authDomain: getAuthDomain(),
  projectId: "theatre-event-gndec",
  storageBucket: "theatre-event-gndec.firebasestorage.app",
  messagingSenderId: "232017137108",
  appId: "1:232017137108:web:66575167758c8c536b9a41"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { firebaseConfig };