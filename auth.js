// auth.js
import { auth, db } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ---------- DOM ELEMENTS ----------
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");

const btnGoogleLogin = document.getElementById("btn-google-login");
const btnLogout = document.getElementById("btn-logout");

const userAvatar = document.getElementById("user-avatar");
const userDisplayNameEl = document.getElementById("user-display-name");
const userEmailEl = document.getElementById("user-email");

// ---------- HELPERS ----------
function showAuthScreen() {
  if (authScreen) authScreen.style.display = "flex";
  if (appShell) appShell.style.display = "none";
}

function showAppShell() {
  if (authScreen) authScreen.style.display = "none";
  if (appShell) appShell.style.display = "flex";
}

function setUserChip(user) {
  if (!user) {
    if (userAvatar) userAvatar.textContent = "";
    if (userDisplayNameEl) userDisplayNameEl.textContent = "Signed out";
    if (userEmailEl) userEmailEl.textContent = "";
    return;
  }

  const name = user.displayName || "(No name)";
  const email = user.email || "";
  const photoURL = user.photoURL || "";

  if (userDisplayNameEl) userDisplayNameEl.textContent = name;
  if (userEmailEl) userEmailEl.textContent = email;

  if (userAvatar) {
    userAvatar.innerHTML = ""; // clear

    if (photoURL) {
      const img = document.createElement("img");
      img.src = photoURL;
      img.alt = name;
      userAvatar.appendChild(img);
    } else {
      // Fallback to initial
      const initial = name.trim().charAt(0).toUpperCase() || "?";
      userAvatar.textContent = initial;
    }
  }
}

// ---------- LOGIN / LOGOUT ----------
if (btnGoogleLogin) {
  btnGoogleLogin.addEventListener("click", async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle the rest
    } catch (err) {
      console.error("Google sign-in error:", err);
      alert("Sign-in failed. Please try again.");
    }
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out error:", err);
      alert("Sign-out failed. Please try again.");
    }
  });
}

// ---------- AUTH STATE ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Signed out
    setUserChip(null);
    showAuthScreen();
    return;
  }

  // Check if this user is "registered" (has a /users/{uid} doc)
  const userDocRef = doc(db, "users", user.uid);

  let isRegistered = false;

  try {
    const snap = await getDoc(userDocRef);
    // If they don't have permission to read OR doc doesn't exist,
    // this will either throw or snap.exists() will be false (for existing family, it's true).
    if (snap.exists()) {
      isRegistered = true;
    }
  } catch (err) {
    console.warn("Error checking user registration:", err);
    isRegistered = false;
  }

  if (!isRegistered) {
    // Not in the /users collection under current rules → not a family member
    alert("This app is currently limited to registered family members.");
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out unregistered user:", err);
    }
    return;
  }

  // At this point, Firestore rules consider them a registered user.
  // Safe to show the app.
  showAppShell();
  setUserChip(user);

  // Update profile fields in /users/{uid} (allowed by your rules as update)
  try {
    await setDoc(
      userDocRef,
      {
        displayName: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true } // update-only; rules prevent new users from creating this
    );
  } catch (err) {
    console.error("Error updating user profile doc:", err);
    // Not fatal for app usage, so we don't block them here
  }
});
