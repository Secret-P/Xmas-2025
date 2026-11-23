import { startAuth } from "./auth.js";
import { watchMine, watchMembers, watchRecipient, saveWish, deleteWish, updateGiver } from "./data.js";
import { selectGifts } from "./family-list.js";
import { giftRow, safeLink } from "./gift-row.js";

const $ = id => document.getElementById(id);
const form = $("gift-form");
const editor = $("editor");
const fields = form.elements;
const rows = new Map();
let user, family = false, recipient = "", items = [], members = new Map();
let stopList = () => {}, stopMembers = () => {}, revision = 0, session = 0;
let editorState, toastTimer, memberError = false, memberListReady = false;

function notify(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  toastTimer = setTimeout(() => { $("toast").textContent = ""; }, 3200);
}

function fullName(member) { return member?.displayName || member?.email || "Family member"; }
function giverName(id) { return fullName(members.get(id)); }

function showHeading() {
  const name = giverName(recipient);
  $("list-title").textContent = family ? (recipient ? name + "’s list" : "Family Lists") : "My List";
  $("picker").hidden = !family || !members.size;
  $("add").textContent = family ? "+ Add a surprise" : "+ Add a wish";
  $("add").disabled = family && !recipient;
  $("filters").hidden = !family || !recipient;
  for (const [id, selected] of [["my-tab", !family], ["family-tab", family]]) {
    if (selected) $(id).setAttribute("aria-current", "page");
    else $(id).removeAttribute("aria-current");
  }
}

function clearEditor() {
  editorState = null;
  if (editor.open) editor.close();
}

function clearRows() {
  rows.clear();
  $("items").replaceChildren();
  $("list-summary").textContent = "";
}

function render() {
  const host = $("items");
  const shown = family ? selectGifts(items, $("filter").value, $("sort").checked) : items;
  const available = family ? items.filter(i => !i.givers.some(g => g.purchased === true)).length : 0;
  $("list-summary").textContent = family ? available + " available · " + items.length + " total"
    : items.length + (items.length === 1 ? " wish" : " wishes");
  $("list-message").textContent = shown.length ? "" : items.length ? "No gifts match this filter."
    : family ? "No gifts here yet. Add a surprise for " + giverName(recipient) + "." : "Your list is ready for its first wish.";
  const version = revision;
  const current = () => version === revision;
  const living = new Set(items.map(i => i.id));
  for (const [id, row] of rows) {
    if (!living.has(id)) { row.node.remove(); rows.delete(id); }
  }
  const visible = new Set(shown.map(i => i.id));
  for (const [id, row] of rows) if (!visible.has(id)) row.node.remove();
  shown.forEach((item, index) => {
    let row = rows.get(item.id);
    if (!row) {
      row = giftRow({ family, uid: user.uid, giverName, edit: openEditor, remove: removeWish,
        change: (gift, fields) => updateGiver(user.uid, recipient, gift.id, fields), current, notify });
      rows.set(item.id, row);
    }
    row.update(item);
    const before = host.children[index] || null;
    if (before !== row.node) host.insertBefore(row.node, before);
  });
}

function loadList() {
  const version = ++revision;
  stopList();
  stopList = () => {};
  items = [];
  clearRows();
  clearEditor();
  showHeading();
  $("retry").hidden = true;
  if (!user) return;
  if (family && !recipient) {
    $("list-message").textContent = memberError ? "Couldn’t load family members." : memberListReady ? "No other family members yet." : "Loading family members…";
    $("retry").hidden = !memberError;
    return;
  }
  $("list-message").textContent = "Loading wishes…";
  function received(next) {
    if (version !== revision) return;
    if (next === null) {
      // Do not offer purchase actions against an incomplete coordination snapshot.
      $("items").hidden = true;
      $("list-summary").textContent = "";
      $("list-message").textContent = "Checking gift details…";
      return;
    }
    items = next;
    $("items").hidden = false;
    render();
  }
  function failed(error) {
    if (version !== revision) return;
    ++revision;
    stopList();
    items = [];
    clearRows();
    $("list-message").textContent = "Couldn’t load the complete list. Check your connection and try again.";
    $("retry").hidden = false;
    console.warn("List unavailable", error.code);
  }
  stopList = family ? watchRecipient(user.uid, recipient, received, failed) : watchMine(user.uid, received, failed);
}

function subscribeMembers() {
  stopMembers();
  const version = session;
  memberError = false;
  memberListReady = false;
  stopMembers = watchMembers(users => {
    if (version !== session) return;
    memberListReady = true;
    const others = users.filter(m => m.id !== user.uid).sort((a,b) => fullName(a).localeCompare(fullName(b)));
    members = new Map(others.map(m => [m.id, m]));
    $("recipient").replaceChildren(...others.map(m => new Option(fullName(m), m.id)));
    const previous = recipient;
    if (!members.has(recipient)) recipient = others[0]?.id || "";
    $("recipient").value = recipient;
    if (family && (previous !== recipient || !recipient)) loadList();
    else if (family) { showHeading(); if (items.length) render(); }
  }, () => {
    if (version !== session) return;
    memberError = true;
    members.clear();
    recipient = "";
    $("recipient").replaceChildren();
    if (family) loadList();
  });
}

function openEditor(item = null) {
  if (!user || (family && !recipient)) return;
  form.reset();
  $("form-error").textContent = "";
  $("save").disabled = false;
  editorState = { id: item?.id, owner: family ? recipient : user.uid, uid: user.uid };
  $("form-title").textContent = item ? "Edit wish" : family ? "A surprise for " + giverName(recipient) : "Add a wish";
  $("notes-label").textContent = family ? "Giver note" : "Wishlist notes";
  $("note-hint").textContent = family ? "You and the other givers can see this. It’s hidden from " + giverName(recipient) + "." : "Everyone in the family can see these notes.";
  $("save").textContent = family ? "Save surprise" : "Save wish";
  fields.name.value = item?.name || "";
  fields.link.value = item?.link || "";
  fields.notes.value = item?.notes || "";
  fields.link.setCustomValidity("");
  fields.name.setCustomValidity("");
  editor.showModal();
}

fields.link.oninput = () => fields.link.setCustomValidity("");
fields.name.oninput = () => fields.name.setCustomValidity("");
form.onsubmit = async e => {
  e.preventDefault();
  const target = editorState;
  if (!target || $("save").disabled) return;
  const name = fields.name.value.trim(), link = fields.link.value.trim(), notes = fields.notes.value.trim();
  fields.name.setCustomValidity(name ? "" : "Enter a gift name.");
  fields.link.setCustomValidity(link && !safeLink(link) ? "Use an http or https product link." : "");
  if (!form.reportValidity()) return;
  $("save").disabled = true;
  try {
    await saveWish(target.uid, target.owner, target.id, { name, link, notes });
    if (target === editorState) {
      clearEditor();
      notify(family ? "Surprise added" : "Wish saved");
    }
  } catch {
    if (target === editorState) $("form-error").textContent = "Couldn’t save this gift. Your draft is still here.";
  } finally { if (target === editorState) $("save").disabled = false; }
};

async function removeWish(item) {
  if (family || !confirm("Delete “" + item.name + "” from your wish list?")) return;
  const version = revision;
  try { await deleteWish(item.id); if (revision === version) notify("Wish deleted"); }
  catch { if (revision === version) notify("Couldn’t delete the wish. Please try again."); }
}

function switchView(next) {
  if (next === family) return;
  family = next;
  loadList();
}
$("my-tab").onclick = () => switchView(false);
$("family-tab").onclick = () => switchView(true);
$("recipient").onchange = e => { recipient = e.target.value; loadList(); };
$("filter").onchange = $("sort").onchange = () => { if (!$("retry").hidden || $("items").hidden || !items.length) return; render(); };
$("add").onclick = () => openEditor();
$("cancel").onclick = clearEditor;
editor.oncancel = () => { editorState = null; };
$("retry").onclick = () => { if (family && memberError) subscribeMembers(); loadList(); };

startAuth(member => {
  ++session;
  stopMembers();
  clearTimeout(toastTimer);
  $("toast").textContent = "";
  user = member;
  members.clear();
  recipient = "";
  memberError = false;
  memberListReady = false;
  family = false;
  $("filter").value = "all";
  $("sort").checked = true;
  $("recipient").replaceChildren();
  $("account-name").textContent = member ? fullName(member) : "";
  $("welcome").hidden = Boolean(member);
  $("book").hidden = !member;
  loadList();
  if (member) subscribeMembers();
});
