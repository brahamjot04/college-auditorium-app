// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAFEpIvkp0jx--oLelEstYbDXrzJ1rghqQ",
  authDomain: "theatre-event-gndec.firebaseapp.com",
  projectId: "theatre-event-gndec",
  storageBucket: "theatre-event-gndec.firebasestorage.app",
  messagingSenderId: "232017137108",
  appId: "1:232017137108:web:66575167758c8c536b9a41"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);