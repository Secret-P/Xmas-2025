// app.js
import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ---------- Small helper ----------
function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------- DOM ----------
const tabMyList = document.getElementById("tab-my-list");
const tabFamily = document.getElementById("tab-family");
const panelMyList = document.getElementById("panel-my-list");
const panelFamily = document.getElementById("panel-family");

const myItemForm = document.getElementById("my-item-form");
const myItemIdInput = document.getElementById("my-item-id");
const myItemNameInput = document.getElementById("my-item-name");
const myItemLinkInput = document.getElementById("my-item-link");
const myItemNotesInput = document.getElementById("my-item-notes");
const btnMyItemReset = document.getElementById("btn-my-item-reset");

const myItemsList = document.getElementById("my-items-list");
const myItemsEmpty = document.getElementById("my-items-empty");

const familyList = document.getElementById("family-list");
const selectedRecipientName = document.getElementById("selected-recipient-name");
const selectedRecipientEmail = document.getElementById("selected-recipient-email");

const otherItemForm = document.getElementById("other-item-form");
const otherItemRecipientId = document.getElementById("other-item-recipient-id");
const otherItemNameInput = document.getElementById("other-item-name");
const otherItemLinkInput = document.getElementById("other-item-link");
const otherItemNoteInput = document.getElementById("other-item-note");

const otherItemsList = document.getElementById("other-items-list");
const otherItemsEmpty = document.getElementById("other-items-empty");
const btnAddOtherItem = document.getElementById("btn-add-other-item");

// New filter/sort controls
const filterPurchasedModeSelect = document.getElementById("filter-purchased-mode");
const sortUnpurchasedFirstCheckbox = document.getElementById("sort-unpurchased-first");

// ---------- State ----------
let currentUser = null;

let unsubscribeMyItems = null;
let unsubscribeUsers = null;
let unsubscribeRecipientItems = null;

let currentRecipientId = null;
let usersMap = new Map(); // uid -> {displayName, email}

// items for the currently selected recipient (raw data from Firestore)
let currentRecipientItems = [];

// Filter/sort state
let purchasedFilterMode = "all"; // "all" | "unpurchased" | "purchased"
let sortUnpurchasedFirst = true;

// ---------- Tabs ----------
function setActiveTab(tab) {
  if (tab === "my-list") {
    tabMyList.classList.add("active");
    tabFamily.classList.remove("active");
    panelMyList.classList.remove("hidden");
    panelFamily.classList.add("hidden");
  } else {
    tabFamily.classList.add("active");
    tabMyList.classList.remove("active");
    panelFamily.classList.remove("hidden");
    panelMyList.classList.add("hidden");
  }
}

tabMyList.addEventListener("click", () => setActiveTab("my-list"));
tabFamily.addEventListener("click", () => setActiveTab("family"));

// Filter/sort control handlers
if (filterPurchasedModeSelect) {
  filterPurchasedModeSelect.addEventListener("change", (e) => {
    purchasedFilterMode = e.target.value || "all";
    renderRecipientItemsFromState();
  });
}

if (sortUnpurchasedFirstCheckbox) {
  sortUnpurchasedFirstCheckbox.addEventListener("change", (e) => {
    sortUnpurchasedFirst = e.target.checked;
    renderRecipientItemsFromState();
  });
}

// ---------- Auth-driven listeners ----------
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  cleanupListeners();
  clearUI();

  if (!user) return;

  initMyListListener();
  initUsersListener();
});

// ---------- Cleanup ----------
function cleanupListeners() {
  if (unsubscribeMyItems) {
    unsubscribeMyItems();
    unsubscribeMyItems = null;
  }
  if (unsubscribeUsers) {
    unsubscribeUsers();
    unsubscribeUsers = null;
  }
  if (unsubscribeRecipientItems) {
    unsubscribeRecipientItems();
    unsubscribeRecipientItems = null;
  }
}

function clearUI() {
  myItemsList.innerHTML = "";
  myItemsEmpty.classList.remove("hidden");

  familyList.innerHTML = "";
  otherItemsList.innerHTML = "";
  otherItemsEmpty.classList.remove("hidden");
  selectedRecipientName.textContent = "Choose someone";
  selectedRecipientEmail.textContent = "";
  otherItemRecipientId.value = "";
  currentRecipientId = null;
  currentRecipientItems = [];

  if (btnAddOtherItem) {
    btnAddOtherItem.disabled = true;
  }

  if (otherItemNameInput) otherItemNameInput.value = "";
  if (otherItemLinkInput) otherItemLinkInput.value = "";
  if (otherItemNoteInput) otherItemNoteInput.value = "";
}

// ---------- My List ----------
function initMyListListener() {
  if (!currentUser) return;

  const itemsRef = collection(db, "items");

  // Only items I created for myself
  const qMy = query(
    itemsRef,
    where("ownerId", "==", currentUser.uid),
    where("createdBy", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );

  unsubscribeMyItems = onSnapshot(
    qMy,
    (snapshot) => {
      renderMyItems(snapshot);
    },
    (err) => {
      console.error("My items listener error:", err);
    }
  );
}

function renderMyItems(snapshot) {
  myItemsList.innerHTML = "";

  if (snapshot.empty) {
    myItemsEmpty.classList.remove("hidden");
    return;
  }

  myItemsEmpty.classList.add("hidden");

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;

    const card = document.createElement("div");
    card.className = "item-card";
    card.dataset.itemId = id;

    // Header
    const header = document.createElement("div");
    header.className = "item-header";

    const title = document.createElement("div");
    title.className = "item-title";
    title.textContent = data.name || "(no name)";

    header.appendChild(title);

    const footerRight = document.createElement("div");
    footerRight.className = "item-footer-right";

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn btn-outline btn-small";
    btnEdit.textContent = "Edit";
    btnEdit.addEventListener("click", () => {
      myItemIdInput.value = id;
      myItemNameInput.value = data.name || "";
      myItemLinkInput.value = data.link || "";
      myItemNotesInput.value = data.notes || "";
      myItemNameInput.focus();
    });

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn btn-outline btn-small";
    btnDelete.textContent = "Delete";
    btnDelete.addEventListener("click", async () => {
      if (!confirm("Remove this item from your list?")) return;
      try {
        await deleteDoc(doc(db, "items", id));
      } catch (err) {
        console.error("Delete item error:", err);
        alert("Failed to delete item.");
      }
    });

    footerRight.appendChild(btnEdit);
    footerRight.appendChild(btnDelete);
    header.appendChild(footerRight);

    // Body – show owner's notes clearly
    const body = document.createElement("div");
    body.className = "item-body";

    const notes = (data.notes || "").trim();
    if (notes) {
      const label = document.createElement("div");
      label.style.fontSize = "0.75rem";
      label.style.color = "#9ca3af";
      label.style.marginBottom = "2px";
      label.textContent = "Your notes:";

      const notesText = document.createElement("div");
      notesText.style.whiteSpace = "pre-wrap";
      notesText.style.fontSize = "0.8rem";
      notesText.style.color = "#e5e7eb";
      notesText.textContent = notes;

      body.appendChild(label);
      body.appendChild(notesText);
    } else {
      const noNotes = document.createElement("div");
      noNotes.style.fontSize = "0.75rem";
      noNotes.style.color = "#9ca3af";
      noNotes.textContent = "No private notes.";
      body.appendChild(noNotes);
    }

    // Footer – link
    const footer = document.createElement("div");
    footer.className = "item-footer";

    const footerLeft = document.createElement("div");
    footerLeft.className = "item-footer-left";

    if (data.link) {
      const a = document.createElement("a");
      a.href = data.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "link";
      a.textContent = "Open link ↗";
      footerLeft.appendChild(a);
    }

    footer.appendChild(footerLeft);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    myItemsList.appendChild(card);
  });
}

// My list form handlers
myItemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const name = myItemNameInput.value.trim();
  const link = myItemLinkInput.value.trim();
  const notes = myItemNotesInput.value.trim();
  const existingId = myItemIdInput.value;

  if (!name) {
    alert("Item name is required.");
    return;
  }

  try {
    if (existingId) {
      const ref = doc(db, "items", existingId);
      await updateDoc(ref, {
        name,
        link: link || "",
        notes: notes || "",
        updatedAt: serverTimestamp()
      });
    } else {
      const itemsRef = collection(db, "items");
      await addDoc(itemsRef, {
        ownerId: currentUser.uid,
        createdBy: currentUser.uid,
        name,
        link: link || "",
        notes: notes || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    resetMyItemForm();
  } catch (err) {
    console.error("Save my item error:", err);
    alert("Failed to save item.");
  }
});

function resetMyItemForm() {
  myItemIdInput.value = "";
  myItemNameInput.value = "";
  myItemLinkInput.value = "";
  myItemNotesInput.value = "";
}

btnMyItemReset.addEventListener("click", () => {
  resetMyItemForm();
});

// ---------- Users / Family Lists ----------
function initUsersListener() {
  if (!currentUser) return;

  const usersRef = collection(db, "users");
  const qUsers = query(usersRef, orderBy("displayName"));

  unsubscribeUsers = onSnapshot(
    qUsers,
    (snapshot) => {
      usersMap.clear();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        usersMap.set(docSnap.id, {
          uid: docSnap.id,
          displayName: data.displayName || "(No name)",
          email: data.email || ""
        });
      });
      renderFamilyList();
    },
    (err) => {
      console.error("Users listener error:", err);
    }
  );
}

function renderFamilyList() {
  familyList.innerHTML = "";

  if (!currentUser) return;

  const entries = Array.from(usersMap.values()).filter(
    (u) => u.uid !== currentUser.uid
  );

  if (entries.length === 0) {
    const p = document.createElement("p");
    p.className = "helper-text";
    p.textContent = "No other users yet. Have family members sign in.";
    familyList.appendChild(p);
    return;
  }

  entries.forEach((user) => {
    const row = document.createElement("div");
    row.className = "family-member";
    row.dataset.uid = user.uid;

    if (user.uid === currentRecipientId) {
      row.classList.add("active");
    }

    const left = document.createElement("div");
    left.className = "family-member-left";

    const dot = document.createElement("div");
    dot.className = "dot-indicator";

    const textWrap = document.createElement("div");
    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = user.displayName;

    const countSpan = document.createElement("span");
    countSpan.className = "count";
    countSpan.textContent = "";

    textWrap.appendChild(nameSpan);
    textWrap.appendChild(countSpan);

    left.appendChild(dot);
    left.appendChild(textWrap);

    row.appendChild(left);

    row.addEventListener("click", () => {
      selectRecipient(user.uid);
    });

    familyList.appendChild(row);
  });

  if (!currentRecipientId && entries.length > 0) {
    selectRecipient(entries[0].uid);
  }
}

function selectRecipient(uid) {
  if (!usersMap.has(uid)) return;
  currentRecipientId = uid;

  Array.from(familyList.querySelectorAll(".family-member")).forEach((el) => {
    el.classList.toggle("active", el.dataset.uid === uid);
  });

  const user = usersMap.get(uid);
  selectedRecipientName.textContent = user.displayName;
  selectedRecipientEmail.textContent = user.email;
  otherItemRecipientId.value = uid;

  if (btnAddOtherItem) {
    btnAddOtherItem.disabled = false;
  }

  if (otherItemNameInput) otherItemNameInput.value = "";
  if (otherItemLinkInput) otherItemLinkInput.value = "";
  if (otherItemNoteInput) otherItemNoteInput.value = "";

  initRecipientItemsListener(uid);
}

// ---------- Recipient items (Family view) ----------
function initRecipientItemsListener(uid) {
  if (!uid || !currentUser) return;

  if (unsubscribeRecipientItems) {
    unsubscribeRecipientItems();
    unsubscribeRecipientItems = null;
  }

  const itemsRef = collection(db, "items");
  const qRecipient = query(
    itemsRef,
    where("ownerId", "==", uid),
    orderBy("createdAt", "desc")
  );

  unsubscribeRecipientItems = onSnapshot(
    qRecipient,
    async (snapshot) => {
      await updateRecipientItemsFromSnapshot(snapshot);
    },
    (err) => {
      console.error("Recipient items listener error:", err);
    }
  );
}

// Fill currentRecipientItems from snapshot, then render using state (filter + sort)
async function updateRecipientItemsFromSnapshot(snapshot) {
  currentRecipientItems = [];

  if (snapshot.empty) {
    currentRecipientItems = [];
    renderRecipientItemsFromState();
    return;
  }

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const itemId = docSnap.id;

    let purchased = false;
    let yourNote = "";
    const allGiverNotes = [];

    try {
      const giverRef = collection(db, "items", itemId, "giverData");
      const giverSnap = await getDocs(giverRef);
      giverSnap.forEach((gDoc) => {
        const g = gDoc.data();
        if (g.purchased) {
          purchased = true;
        }
        if (g.note && typeof g.note === "string" && g.note.trim() !== "") {
          allGiverNotes.push(g.note.trim());
        }
        if (gDoc.id === currentUser?.uid && g.note) {
          yourNote = g.note;
        }
      });
    } catch (err) {
      console.error("Error loading giverData for item", itemId, err);
    }

    currentRecipientItems.push({
      itemId,
      data,
      purchased,
      ownerNotes: (data.notes || "").trim(),
      allGiverNotes,
      yourNote
    });
  }

  renderRecipientItemsFromState();
}

// Renders using currentRecipientItems + filter/sort state
function renderRecipientItemsFromState() {
  otherItemsList.innerHTML = "";

  if (!currentRecipientItems || currentRecipientItems.length === 0) {
    otherItemsEmpty.classList.remove("hidden");
    return;
  }

  // Start from full list
  let items = [...currentRecipientItems];

  // Apply filter mode
  if (purchasedFilterMode === "unpurchased") {
    items = items.filter((i) => !i.purchased);
  } else if (purchasedFilterMode === "purchased") {
    items = items.filter((i) => i.purchased);
  }

  // Sorting
  if (sortUnpurchasedFirst) {
    items.sort((a, b) => {
      // false (0) before true (1)
      return Number(a.purchased) - Number(b.purchased);
    });
  }

  if (items.length === 0) {
    otherItemsEmpty.classList.remove("hidden");
    otherItemsEmpty.textContent = "No items match the current filter.";
    return;
  } else {
    otherItemsEmpty.classList.add("hidden");
    otherItemsEmpty.textContent = "No items on this list yet.";
  }

  const cards = [];

  for (const item of items) {
    const { itemId, data, purchased, ownerNotes, allGiverNotes, yourNote } = item;

    const name = data.name || "(no name)";
    const link = data.link || "";

    const purchasedTag = purchased
      ? `<span class="tag tag-purchased">✔ Purchased</span>`
      : "";

    const linkHtml = link
      ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="link">Open link ↗</a>`
      : "";

    const noteTextEscaped = escapeHtml(yourNote || "");

    // Owner's (recipient's) notes shown to all givers
    const ownerNotesHtml = ownerNotes
      ? `
        <div style="font-size:0.75rem;color:#9ca3af;margin-bottom:2px;">Their notes:</div>
        <div style="font-size:0.8rem;color:#e5e7eb;white-space:pre-wrap;">
          ${escapeHtml(ownerNotes)}
        </div>
      `
      : "";

    // Shared giver notes for *all* givers
    const giverNotesHtml = allGiverNotes.length
      ? `
        <div style="margin:4px 0 6px;">
          <div style="font-size:0.75rem;color:#9ca3af;margin-bottom:2px;">Giver notes:</div>
          <ul style="margin:0;padding-left:16px;font-size:0.78rem;color:#e5e7eb;">
            ${allGiverNotes
              .map((n) => `<li>${escapeHtml(n)}</li>`)
              .join("")}
          </ul>
        </div>
      `
      : `
        <div style="margin:4px 0 6px;font-size:0.75rem;color:#9ca3af;">
          No giver notes yet.
        </div>
      `;

    const cardClass = purchased ? "item-card purchased" : "item-card";

    const cardHtml = `
      <div class="${cardClass}" data-item-id="${itemId}">
        <div class="item-header">
          <div class="item-title">${escapeHtml(name)}</div>
          <div class="item-tags">
            ${purchasedTag}
          </div>
        </div>
        <div class="item-body">
          ${ownerNotesHtml}
          ${
            !link && !ownerNotes
              ? "<span style='font-size:0.75rem;color:#9ca3af;'>No link provided</span>"
              : ""
          }
        </div>
        <div class="item-footer">
          <div class="item-footer-left">
            ${linkHtml}
          </div>
          <div class="item-footer-right">
            <button class="btn btn-outline btn-small btn-mark-purchased"
                    data-item-id="${itemId}"
                    data-purchased="${purchased}">
              ${purchased ? "Unmark purchased" : "Mark purchased"}
            </button>
          </div>
        </div>
        <div style="margin-top:6px;">
          ${giverNotesHtml}
          <div class="form-group">
            <label style="font-size:0.75rem;color:#9ca3af;">Your giver note</label>
            <textarea class="textarea giver-note-input"
                      data-item-id="${itemId}"
                      placeholder="e.g. Already ordered, arrives 12/20.">${noteTextEscaped}</textarea>
          </div>
          <div class="row-between">
            <span class="helper-text" style="font-size:0.7rem;">
              The recipient never sees this. Other givers can still see the item is purchased and all giver notes.
            </span>
            <button class="btn btn-primary btn-small btn-save-note"
                    data-item-id="${itemId}">
              Save note
            </button>
          </div>
        </div>
      </div>
    `;

    cards.push(cardHtml);
  }

  otherItemsList.innerHTML = cards.join("");
}

// Event delegation for purchased + notes
otherItemsList.addEventListener("click", async (e) => {
  const btnPurchased = e.target.closest(".btn-mark-purchased");
  if (btnPurchased) {
    e.preventDefault();
    if (!currentUser || !currentRecipientId) return;

    const itemId = btnPurchased.dataset.itemId;
    const current = btnPurchased.dataset.purchased === "true";
    const next = !current;

    try {
      const ref = doc(db, "items", itemId, "giverData", currentUser.uid);
      await setDoc(
        ref,
        {
          ownerId: currentRecipientId,
          giverId: currentUser.uid,
          purchased: next,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      // Optimistic UI tweak: update local state so filter/sort re-render is correct
      const idx = currentRecipientItems.findIndex((i) => i.itemId === itemId);
      if (idx !== -1) {
        currentRecipientItems[idx].purchased = next;
      }
      renderRecipientItemsFromState();
    } catch (err) {
      console.error("Error updating purchased state:", err);
      alert("Failed to update purchased state.");
    }
    return;
  }

  const btnSaveNote = e.target.closest(".btn-save-note");
  if (btnSaveNote) {
    e.preventDefault();
    if (!currentUser || !currentRecipientId) return;

    const itemId = btnSaveNote.dataset.itemId;
    const card = btnSaveNote.closest(".item-card");
    const textarea = card.querySelector(".giver-note-input");
    const noteText = textarea.value.trim();

    try {
      const ref = doc(db, "items", itemId, "giverData", currentUser.uid);
      await setDoc(
        ref,
        {
          ownerId: currentRecipientId,
          giverId: currentUser.uid,
          note: noteText,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      // Update local state + re-render so shared giver notes list updates
      const idx = currentRecipientItems.findIndex((i) => i.itemId === itemId);
      if (idx !== -1) {
        currentRecipientItems[idx].yourNote = noteText;

        // Also update allGiverNotes cache so your note shows in the list
        const cleanNote = noteText.trim();
        const arr = currentRecipientItems[idx].allGiverNotes || [];
        const existingIndex = arr.findIndex(
          (n) => n.trim() === currentRecipientItems[idx].yourNote?.trim()
        );

        // For simplicity, if note is non-empty, ensure it's in the list
        if (cleanNote) {
          if (!arr.includes(cleanNote)) {
            arr.push(cleanNote);
          }
        }

        currentRecipientItems[idx].allGiverNotes = arr;
      }

      renderRecipientItemsFromState();
    } catch (err) {
      console.error("Error saving giver note:", err);
      alert("Failed to save note.");
    }
  }
});

// ---------- Add item to recipient's list ----------
otherItemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const recipientId = otherItemRecipientId.value;
  if (!recipientId) {
    alert("Select a recipient first.");
    return;
  }

  const name = otherItemNameInput.value.trim();
  const link = otherItemLinkInput.value.trim();
  const giverNote = otherItemNoteInput.value.trim();

  if (!name) {
    alert("Item name is required.");
    return;
  }

  try {
    const itemsRef = collection(db, "items");
    const itemRef = await addDoc(itemsRef, {
      ownerId: recipientId,
      createdBy: currentUser.uid,
      name,
      link: link || "",
      notes: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (giverNote) {
      const gdRef = doc(db, "items", itemRef.id, "giverData", currentUser.uid);
      await setDoc(
        gdRef,
        {
          ownerId: recipientId,
          giverId: currentUser.uid,
          note: giverNote,
          purchased: false,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    otherItemNameInput.value = "";
    otherItemLinkInput.value = "";
    otherItemNoteInput.value = "";
  } catch (err) {
    console.error("Error adding item for other recipient:", err);
    alert("Failed to add item.");
  }
});
