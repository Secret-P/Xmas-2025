import { auth, db, provider } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { doc, getDocFromServer, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

export function startAuth(setMember) {
  const login = document.getElementById("login");
  const message = document.getElementById("auth-message");
  let generation = 0;
  let feedback = "";
  login.onclick = async () => {
    login.disabled = true;
    feedback = "";
    message.textContent = "Signing in…";
    try {
      await signInWithPopup(auth, provider);
    } catch {
      login.disabled = false;
      message.textContent = "Sign-in didn’t finish. Please try again.";
    }
  };
  document.getElementById("logout").onclick = async () => {
    try { await signOut(auth); }
    catch { window.alert("Sign-out didn’t finish. Please try again."); }
  };
  onAuthStateChanged(auth, async user => {
    const version = ++generation;
    const current = () => version === generation && auth.currentUser?.uid === user?.uid;
    setMember(null);
    login.disabled = Boolean(user);
    if (!user) {
      message.textContent = feedback || "For registered family members.";
      return;
    }

    message.textContent = "Checking family membership…";
    const ref = doc(db, "users", user.uid);
    let member;
    try {
      member = (await getDocFromServer(ref)).exists();
      if (current() && !member) feedback = "This wish list is for registered family members.";
    } catch {
      if (current()) feedback = "Couldn’t verify family access. Check your connection and sign in again.";
    }
    if (!current()) return;
    if (!member) {
      message.textContent = feedback;
      try { await signOut(auth); }
      catch { login.disabled = false; }
      return;
    }

    feedback = "";
    setMember(user);
    try {
      await updateDoc(ref, {
        displayName: user.displayName || "", email: user.email || "",
        photoURL: user.photoURL || "", lastLoginAt: new Date().toISOString()
      });
    } catch (error) { console.warn("Family profile update failed", error.code); }
  });
}
