// ============================================================
// 📁 FOLDER: database/schema.js
//
// WHAT THIS FILE IS:
//   This file describes the shape of ALL data we store.
//   Think of it as the blueprint for our database.
//
//   Right now the app saves data to the browser's localStorage
//   (built into every browser, no setup needed).
//   This is fine for the hackathon demo.
//
//   Tomorrow if we want data to sync across devices or persist
//   properly, we swap localStorage for Firebase Firestore.
//   This file shows what Firebase documents will look like.
//
// WHERE DATA IS STORED RIGHT NOW:
//   localStorage key: "sage_profile"
//   That's it — one key, one JSON object, lives in the browser.
//   See useUserProfile.js for how we read/write it.
//
// WHERE DATA WILL LIVE IN FIREBASE (tomorrow):
//   Collection: "users"
//   Document ID: the user's unique ID (from Firebase Auth)
//   Fields: everything in USER_PROFILE_SHAPE below
//
// ✅ DONE:
//   - Full data shape defined for the user profile
//   - localStorage helpers (readProfile, saveProfile, clearProfile)
//   - Firebase setup instructions (commented out, ready to activate)
//
// 🔲 TODO TOMORROW:
//   - [ ] Create a free Firebase project at firebase.google.com
//   - [ ] Copy your Firebase config into FIREBASE_CONFIG below
//   - [ ] Uncomment the Firebase functions at the bottom
//   - [ ] Replace localStorage calls in useUserProfile.js with Firebase calls
// ============================================================


// ── WHAT A USER PROFILE LOOKS LIKE ───────────────────────────────
//
// This is the shape of data we store for every user.
// Read this to understand what information Sage collects over time.
//
// NEW USER:    most fields are empty/null
// RETURNING USER: fields fill up as Sage learns more about them
//
export const USER_PROFILE_SHAPE = {

  // Basic info — collected during onboarding
  name:     "",         // "Margaret" — learned from first conversation
  age:      null,       // 78 — optional, asked during onboarding
  joinedAt: null,       // "2025-04-18" — date they first opened the app

  // Health — Sage listens for these and saves them quietly
  health: {
    conditions:  [],    // ["knee pain", "mild hypertension"]
    medications: [],    // ["lisinopril", "aspirin"]
  },

  // Interests — extracted from conversation by Gemini
  // Used to suggest events and match users with similar hobbies
  interests: [],        // ["gardening", "jazz music", "knitting"]

  // Family members mentioned in conversation
  family: [],           // [{ name: "Sarah", relationship: "daughter" }]

  // Emergency contacts — added during onboarding or from settings
  // These are the phone numbers Photon sends SMS alerts to
  emergencyContacts: [],
  // [
  //   { id: 1, name: "Sarah (Daughter)", phone: "+16095550101", relationship: "Family" },
  //   { id: 2, name: "Dr. Patel",        phone: "+16095550102", relationship: "Doctor" },
  // ]

  // Conversation history — one summary saved per session
  // Used so Sage can reference past conversations across days
  conversations: [],
  // [
  //   {
  //     date:            "2025-04-16",
  //     summary:         "Margaret talked about her garden and her knee hurting",
  //     mood:            "content",
  //     topicsDiscussed: ["garden", "knee pain", "daughter Sarah"],
  //   }
  // ]

  // User preferences — adjusts how Sage behaves
  preferences: {
    voiceSpeed:  "slow",    // "slow" | "normal" | "fast"
    textSize:    "large",   // "normal" | "large" | "xlarge"
    preferVoice: true,      // true = mic is default, false = text is default
  },
};


// ─────────────────────────────────────────────────────────────────
//  OPTION A — LOCALSTORAGE (WORKS RIGHT NOW, NO SETUP)
//  Use this for the hackathon demo.
//  Data lives in the browser. Clears if user clears browser data.
// ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sage_profile";

// Read the saved profile from the browser
// Returns the profile object, or null if nothing saved yet
export function readProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null; // if JSON is corrupted, start fresh
  }
}

// Save the profile to the browser
// Call this every time the profile changes
export function saveProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("Could not save profile:", err);
  }
}

// Delete the profile completely (resets app to new user state)
// Useful for testing or if the user wants to start over
export function clearProfile() {
  localStorage.removeItem(STORAGE_KEY);
}


// ─────────────────────────────────────────────────────────────────
//  OPTION B — FIREBASE FIRESTORE (SYNCS ACROSS DEVICES)
//  TODO TOMORROW: uncomment this and swap out the localStorage
//  functions above.
//
//  SETUP STEPS:
//  1. Go to firebase.google.com → create a project → add a web app
//  2. Copy the config object Firebase gives you into FIREBASE_CONFIG
//  3. Run in your frontend folder:
//       npm install firebase
//  4. Uncomment everything below
//  5. In useUserProfile.js, replace readProfile/saveProfile
//     with the Firebase versions below
// ─────────────────────────────────────────────────────────────────

/*

import { initializeApp }              from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// Step 1: paste your Firebase config here
// You get this from Firebase Console → Project Settings → Your Apps
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// Step 2: initialize Firebase and Firestore
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db          = getFirestore(firebaseApp);

// Step 3: use these instead of readProfile/saveProfile above

// Read profile from Firestore
// userId = a unique ID for this user (create one with crypto.randomUUID())
export async function readProfileFirebase(userId) {
  const docRef  = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

// Save profile to Firestore
export async function saveProfileFirebase(userId, profile) {
  const docRef = doc(db, "users", userId);
  await setDoc(docRef, profile, { merge: true });
  // merge: true means it only updates changed fields,
  // instead of overwriting the entire document
}

*/
