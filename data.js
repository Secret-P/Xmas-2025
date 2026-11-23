import { db } from "./firebase-config.js";
import { collection, query, where, onSnapshot, doc, setDoc, addDoc, updateDoc,
  deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { watchFamilyList } from "./family-list.js";

const items = collection(db, "items");

function listen(ref, receive, failed) {
  return onSnapshot(ref, { includeMetadataChanges: true }, snap => {
    // A partial local cache can't establish gift availability or membership.
    if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
    receive(snap.docs.map(d => ({ ...d.data(), id: d.id })));
  }, failed);
}

function watchItems(uid, ownOnly, receive, failed) {
  const constraints = [where("ownerId", "==", uid)];
  if (ownOnly) constraints.push(where("createdBy", "==", uid));
  return listen(query(items, ...constraints), rows => {
    const time = row => row.createdAt?.toMillis?.() ?? 0;
    receive(rows.sort((a, b) => time(b) - time(a) || a.id.localeCompare(b.id)));
  }, failed);
}

export function watchMine(uid, receive, failed) {
  return watchItems(uid, true, receive, failed);
}

export function watchMembers(receive, failed) {
  return listen(collection(db, "users"), receive, failed);
}

export function watchRecipient(viewer, recipient, publish, failed) {
  if (!recipient || recipient === viewer) throw new Error("Choose another family member.");
  return watchFamilyList({
    watchItems: (next, error) => watchItems(recipient, false, next, error),
    watchGivers: (id, next, error) => listen(collection(items, id, "giverData"), next, error),
    publish, failed
  });
}

export async function saveWish(uid, recipient, existing, { name, link, notes }) {
  const gift = { name, link, updatedAt: serverTimestamp() };
  if (existing) return updateDoc(doc(items, existing), { ...gift, notes });
  Object.assign(gift, { ownerId: recipient, createdBy: uid, notes: recipient === uid ? notes : "", createdAt: serverTimestamp() });
  if (recipient === uid || !notes) return addDoc(items, gift);

  // Commit the surprise and its private note together, including on retry.
  const ref = doc(items);
  const batch = writeBatch(db);
  batch.set(ref, gift);
  batch.set(doc(ref, "giverData", uid), { ownerId: recipient, giverId: uid, note: notes, purchased: false, updatedAt: serverTimestamp() });
  return batch.commit();
}

export function deleteWish(id) {
  return deleteDoc(doc(items, id));
}

export function updateGiver(uid, ownerId, id, fields) {
  if (uid === ownerId) throw new Error("Choose another family member.");
  return setDoc(doc(items, id, "giverData", uid), {
    ownerId, giverId: uid, ...fields, updatedAt: serverTimestamp()
  }, { merge: true });
}
