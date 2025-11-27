// auth.js
import { auth, db, provider } from "./firebase-config.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const btnLogin = document.getElementById("btn-google-login");
const btnLogout = document.getElementById("btn-logout");

const userDisplayName = document.getElementById("user-display-name");
const userEmail = document.getElementById("user-email");
const userAvatar = document.getElementById("user-avatar");
const myListOwnerLabel = document.getElementById("my-list-owner-label");

btnLogin.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Sign-in error:", err);
    alert("Sign-in failed. Check console for details.");
  }
});

btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Sign-out error:", err);
  }
});

function setAvatar(user) {
  userAvatar.innerHTML = "";
  if (user.photoURL) {
    const img = document.createElement("img");
    img.src = user.photoURL;
    img.alt = user.displayName || "User";
    userAvatar.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.textContent = (user.displayName || user.email || "?")[0].toUpperCase();
    userAvatar.appendChild(span);
  }
}

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  await setDoc(
    ref,
    {
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || ""
    },
    { merge: true }
  );
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authScreen.style.display = "none";
    appShell.style.display = "flex";

    userDisplayName.textContent = user.displayName || "Anonymous";
    userEmail.textContent = user.email || "";
    myListOwnerLabel.textContent = "You";

    setAvatar(user);
    await ensureUserDoc(user);
  } else {
    authScreen.style.display = "flex";
    appShell.style.display = "none";
  }
});
