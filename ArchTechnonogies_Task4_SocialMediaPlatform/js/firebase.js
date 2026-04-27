import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1O2jotXleSsVAwr3_3PVrJ7f309WlJRU",
  authDomain: "socialmediaplatform-1e7f2.firebaseapp.com",
  projectId: "socialmediaplatform-1e7f2",
  storageBucket: "socialmediaplatform-1e7f2.firebasestorage.app",
  messagingSenderId: "944367830890",
  appId: "1:944367830890:web:93499ca843dfafe1b6c713"
};

const placeholderKeys = Object.values(firebaseConfig).some((value) => value.startsWith("PASTE_"));

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { serverTimestamp };

export function ensureFirebaseConfigured() {
  if (placeholderKeys) {
    throw new Error("Firebase config missing. Open js/firebase.js and paste your Firebase keys.");
  }
}
