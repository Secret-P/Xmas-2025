export function safeLink(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function giftRow({ family, uid, giverName, edit, remove, change, notify, current }) {
  const row = element("details", "", "gift");
  const summary = element("summary");
  const title = element("span", "", "name");
  const status = element("span", "", "status");
  const body = element("div", "", "details");
  const notes = element("section");
  const notesTitle = element("h3", family ? "Wishlist notes" : "Your wishlist notes");
  const notesText = element("p");
  const link = element("a", "Open product link ↗");
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  notes.append(notesTitle, notesText);
  summary.append(title, status);
  body.append(notes, link);
  row.append(summary, body);
  let item;
  let updateCoordination = () => {};
  if (!family) {
    const actions = element("div", "", "actions");
    const editButton = element("button", "Edit wish");
    const removeButton = element("button", "Delete");
    editButton.onclick = () => edit(item);
    removeButton.onclick = () => remove(item);
    actions.append(editButton, removeButton);
    body.append(actions);
  } else {
    const section = element("section", "", "coordination");
    const label = element("label", "Your giver note");
    const input = element("textarea");
    input.rows = 2;
    label.append(input);
    const shared = element("div");
    const purchase = element("button");
    const save = element("button", "Save note");
    const error = element("p", "", "error");
    error.setAttribute("role", "alert");
    section.append(element("h3", "Givers only"), purchase, shared, label, save, error);
    body.append(section);
    let dirty = false;
    let writing = false;
    let mine = false;
    let bought = false;
    let savedNote = "";
    function controls() {
      purchase.disabled = writing || (bought && !mine);
      purchase.textContent = mine ? "Unmark my purchase" : bought ? "Already purchased" : "Mark purchased";
      save.disabled = writing || !dirty;
    }
    input.oninput = () => { dirty = input.value !== savedNote; controls(); };
    async function write(fields, success) {
      if (writing || !current()) return;
      writing = true;
      error.textContent = "";
      controls();
      try {
        await change(item, fields);
        if (current()) notify(success);
      } catch {
        if (current()) error.textContent = "Couldn’t save that change. Please try again.";
      } finally { writing = false; controls(); }
    }
    purchase.onclick = () => write({ purchased: !mine }, mine ? "Purchase unmarked" : "Marked as purchased");
    save.onclick = () => write({ note: input.value }, "Giver note saved");
    updateCoordination = () => {
      const buyers = item.givers.filter(g => g.purchased === true);
      const own = item.givers.find(g => g.id === uid);
      bought = buyers.length > 0;
      mine = own?.purchased === true;
      const names = buyers.map(g => g.id === uid ? "you" : giverName(g.id));
      status.textContent = bought ? "✓ Purchased · " + names.join(", ") : "Available";
      row.classList.toggle("bought", bought);
      savedNote = typeof own?.note === "string" ? own.note : "";
      if (!dirty || input.value === savedNote) { input.value = savedNote; dirty = false; }
      shared.replaceChildren();
      for (const giver of item.givers) {
        if (typeof giver.note !== "string" || !giver.note.trim() || giver.id === uid) continue;
        shared.append(element("h3", giverName(giver.id)), element("p", giver.note, "giver-note"));
      }
      shared.hidden = !shared.childElementCount;
      controls();
    };
  }
  function update(data) {
    item = data;
    title.textContent = item.name || "Untitled wish";
    notesText.textContent = item.notes || "";
    notes.hidden = !item.notes;
    const href = safeLink(item.link);
    link.hidden = !href;
    if (href) link.href = href;
    else link.removeAttribute("href");
    updateCoordination();
  }
  return { node: row, update };
}
