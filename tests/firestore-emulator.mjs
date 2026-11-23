import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch, serverTimestamp } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-family-wishes",
  firestore: { host: "127.0.0.1", port: 8080, rules: await readFile("firestore.rules", "utf8") }
});
try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const id of ["recipient", "giver", "sibling"]) await setDoc(doc(db, "users", id), { displayName: id });
  });
  const dbFor = id => env.authenticatedContext(id).firestore();
  const giver = dbFor("giver"), recipient = dbFor("recipient"), sibling = dbFor("sibling"), visitor = dbFor("visitor");
  const gift = (db, id) => doc(db, "items", id);
  const privateRecord = db => doc(db, "items", "surprise", "giverData", "giver");
  const wishlist = (createdBy, name) => ({ ownerId: "recipient", createdBy, name, link: "", notes: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const coord = { ownerId: "recipient", giverId: "giver", note: "Sample giver note", purchased: false, updatedAt: serverTimestamp() };

  await assertSucceeds(setDoc(gift(recipient, "wish"), wishlist("recipient", "Sample wish")));
  const batch = writeBatch(giver);
  batch.set(gift(giver, "surprise"), wishlist("giver", "Sample surprise"));
  batch.set(privateRecord(giver), coord);
  await assertSucceeds(batch.commit());
  assert.equal((await assertSucceeds(getDoc(privateRecord(sibling)))).data().note, coord.note);
  await assertFails(getDoc(gift(recipient, "surprise")));
  await assertFails(getDoc(privateRecord(recipient)));

  for (const purchased of [true, false]) {
    await assertSucceeds(setDoc(privateRecord(giver), { ownerId: "recipient", giverId: "giver", purchased, updatedAt: serverTimestamp() }, { merge: true }));
    assert.equal((await getDoc(privateRecord(sibling))).data().purchased, purchased);
  }
  await assertSucceeds(updateDoc(privateRecord(giver), { note: "Arrived" }));
  await assertFails(updateDoc(privateRecord(sibling), { note: "Edited by someone else" }));
  const own = await assertSucceeds(getDocs(query(collection(recipient, "items"), where("ownerId", "==", "recipient"), where("createdBy", "==", "recipient"))));
  assert.deepEqual(own.docs.map(d => d.id), ["wish"]);
  const family = await assertSucceeds(getDocs(query(collection(giver, "items"), where("ownerId", "==", "recipient"))));
  assert.deepEqual(family.docs.map(d => d.id).sort(), ["surprise", "wish"]);
  await assertFails(getDoc(gift(visitor, "wish")));
  await assertFails(setDoc(doc(visitor, "users", "visitor"), { displayName: "Visitor" }));
  console.log("Passed: surprise and note batch, purchase and unmark, note editing, privacy, membership and both list queries.");
} finally {
  await env.cleanup();
}
