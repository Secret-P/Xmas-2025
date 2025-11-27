// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// 🧩 Replace with your Firebase project config from the console
const firebaseConfig = {
  apiKey: "AIzaSyBXN2T28e3ODSi4R5lha1Zp1XvNO4rG0fI",
  authDomain: "xmas-2025.firebaseapp.com",
  projectId: "xmas-2025",
  storageBucket: "xmas-2025.firebasestorage.app",
  messagingSenderId: "375497812428",
  appId: "1:375497812428:web:2f5b7a8689a9438fa31569",
  measurementId: "G-27CX0NV4WK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { app, auth, db, provider };
