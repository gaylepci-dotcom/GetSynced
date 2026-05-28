// ── firebase.js ──
// Shared Firebase initialization & auth utilities
// Import this in any page that needs Firebase.

import { initializeApp }  from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAnalytics }   from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// ── Config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBSDXY2thKUA_hFX3_AAt8NkymbmqnYEFk",
  authDomain:        "thepcompany-fdc3a.firebaseapp.com",
  projectId:         "thepcompany-fdc3a",
  storageBucket:     "thepcompany-fdc3a.firebasestorage.app",
  messagingSenderId: "474105576770",
  appId:             "1:474105576770:web:d936d2cd0db46eab381cdb",
  measurementId:     "G-XK79GD5DDL",
};

// ── Init ─────────────────────────────────────────────────
const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth      = getAuth(app);
const db        = getFirestore(app);
const provider  = new GoogleAuthProvider();

// ── Friendly error messages ───────────────────────────────
export function friendlyError(code) {
  const map = {
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect password. Please try again.",
    "auth/invalid-credential":     "Invalid email or password. Please try again.",
    "auth/too-many-requests":      "Too many failed attempts. Try again later or reset your password.",
    "auth/user-disabled":          "This account has been disabled. Contact your HR Administrator.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/popup-closed-by-user":   "Google sign-in was cancelled.",
    "auth/popup-blocked":          "Popup was blocked. Please allow popups for this site.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ── Auth ──────────────────────────────────────────────────

/** Sign in with email + password. remember=true persists across sessions. */
export async function loginWithEmail(email, password, remember = false) {
  const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);
  return signInWithEmailAndPassword(auth, email, password);
}

/** Sign in with Google popup. */
export async function loginWithGoogle() {
  return signInWithPopup(auth, provider);
}

/** Send a password-reset email. */
export async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

/** Sign the current user out. */
export async function logout() {
  return signOut(auth);
}

/** Listen for auth state changes. Callback receives (user | null). */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export { auth, db, analytics };