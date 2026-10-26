(function () {
  "use strict";

  // In-browser multi-project store, separate from the single-slot autosave
  // (lucarne_project_v2) and from manual file download/upload. Each entry is
  // a full, self-contained project snapshot (base64 images/icons inlined),
  // so it never depends on the shared image IndexedDB store.
  const INDEX_KEY = "lucarne_projects_index_v1";
  const SLOT_PREFIX = "lucarne_project_slot_v1_";

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function loadIndex() {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveIndex(list) {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  }

  function list() {
    return loadIndex().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }

  function genId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function readSlot(id) {
    try {
      const raw = localStorage.getItem(SLOT_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeSlot(id, clone, name) {
    localStorage.setItem(SLOT_PREFIX + id, JSON.stringify(clone));
    const idx = loadIndex();
    const entry = idx.find((p) => p.id === id);
    const now = Date.now();
    if (entry) {
      entry.name = name;
      entry.savedAt = now;
    } else {
      idx.push({ id, name, savedAt: now, createdAt: now });
    }
    saveIndex(idx);
  }

  // Saves the current project as a brand-new entry and tags it so future
  // "Update" saves target this same slot.
  function saveAs(LE, name) {
    const id = genId();
    const clone = LE.serializeProjectClone();
    clone.name = name || clone.name || "Project";
    writeSlot(id, clone, clone.name);
    LE.project._pmId = id;
    return id;
  }

  function update(LE, id) {
    const clone = LE.serializeProjectClone();
    writeSlot(id, clone, clone.name || "Project");
  }

  function rename(id, name) {
    const clone = readSlot(id);
    if (!clone) return false;
    clone.name = name;
    writeSlot(id, clone, name);
    return true;
  }

  function remove(id) {
    localStorage.removeItem(SLOT_PREFIX + id);
    saveIndex(loadIndex().filter((p) => p.id !== id));
  }

  function duplicate(id) {
    const clone = readSlot(id);
    if (!clone) return null;
    const newId = genId();
    const name = (clone.name || "Project") + " copy";
    clone.name = name;
    writeSlot(newId, clone, name);
    return newId;
  }

  async function open(id, LE) {
    const clone = readSlot(id);
    if (!clone) return false;
    clone._pmId = id;
    await LE.applyProject(clone);
    return true;
  }

  function estimateSize(id) {
    const raw = localStorage.getItem(SLOT_PREFIX + id);
    return raw ? raw.length : 0;
  }

  function formatSize(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  }

  function formatDate(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function openPanel(LE) {
    const DLG = window.LucarneDialog;
    if (!DLG) return;
    pendingAction = null;
    DLG.open({
      title: "Projects",
      render: (body) => render(body, LE),
    });
  }

  // Inline rename/delete confirmation state for the entry currently being
  // acted on, rendered inside the same dialog instead of native prompt()/
  // confirm() (which would look out of place next to the custom dialog).
  let pendingAction = null;

  async function openEntry(entry, LE) {
    try {
      const ok = await open(entry.id, LE);
      if (window.LucarneDialog) window.LucarneDialog.close();
      if (!LE.toast) return;
      if (ok) LE.toast("Project \u201c" + entry.name + "\u201d opened", "success");
      else LE.toast("Project \u201c" + entry.name + "\u201d could not be read from browser storage", "error");
    } catch (e) {
      console.error("Project open failed", e);
      if (LE.toast) LE.toast("Could not open \u201c" + entry.name + "\u201d: " + ((e && e.message) || "unknown error"), "error");
    }
  }

  function renderEntryCard(card, entry, LE, body) {
    card.innerHTML = "";
    if (pendingAction && pendingAction.id === entry.id && pendingAction.type === "rename") {
      const head = el("div", "row-label", card);
      head.textContent = "Rename \u201c" + entry.name + "\u201d";
      const inputRow = el("div", "row row-actions", card);
      const nameInput = document.createElement("input");
      nameInput.className = "field";
      nameInput.type = "text";
      nameInput.setAttribute("aria-label", "New project name");
      nameInput.value = entry.name;
      inputRow.appendChild(nameInput);
      const actions = el("div", "row btn-row", card);
      const saveBtn = el("button", "btn primary tiny", actions);
      saveBtn.textContent = "Save";
      const commit = () => {
        const next = nameInput.value.trim();
        if (next) rename(entry.id, next);
        pendingAction = null;
        render(body, LE);
      };
      saveBtn.addEventListener("click", commit);
      nameInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") commit();
        if (ev.key === "Escape") {
          pendingAction = null;
          render(body, LE);
        }
      });
      const cancelBtn = el("button", "btn tiny", actions);
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        pendingAction = null;
        render(body, LE);
      });
      nameInput.focus();
      nameInput.select();
      return;
    }
    if (pendingAction && pendingAction.id === entry.id && pendingAction.type === "open") {
      const head = el("div", "row-label hint-warn", card);
      head.textContent =
        "Open \u201c" + entry.name + "\u201d? It replaces \u201c" + (LE.project.name || "the current project") + "\u201d in the editor and clears its undo history.";
      const actions = el("div", "row btn-row", card);
      const confirmBtn = el("button", "btn primary tiny", actions);
      confirmBtn.textContent = "Open";
      confirmBtn.addEventListener("click", () => {
        pendingAction = null;
        openEntry(entry, LE);
      });
      const cancelBtn = el("button", "btn tiny", actions);
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        pendingAction = null;
        render(body, LE);
      });
      confirmBtn.focus();
      return;
    }
    if (pendingAction && pendingAction.id === entry.id && pendingAction.type === "delete") {
      const head = el("div", "row-label hint-bad", card);
      head.textContent = "Delete \u201c" + entry.name + "\u201d? This cannot be undone.";
      const actions = el("div", "row btn-row", card);
      const confirmBtn = el("button", "btn danger tiny", actions);
      confirmBtn.textContent = "Delete";
      confirmBtn.addEventListener("click", () => {
        remove(entry.id);
        if (entry.id === LE.project._pmId) delete LE.project._pmId;
        pendingAction = null;
        render(body, LE);
      });
      const cancelBtn = el("button", "btn tiny", actions);
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        pendingAction = null;
        render(body, LE);
      });
      return;
    }

    const head = el("div", "row-between", card);
    const title = el("strong", "", head);
    title.textContent = entry.name + (entry.id === LE.project._pmId ? " (current)" : "");
    const meta = el("div", "hint", card);
    meta.textContent = formatDate(entry.savedAt) + " \u00b7 " + formatSize(estimateSize(entry.id));

    const actions = el("div", "row btn-row", card);
    const openBtn = el("button");
    openBtn.className = "btn primary tiny";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => {
      const isCurrent = entry.id === LE.project._pmId;
      if (!isCurrent && LE.projectHasWork && LE.projectHasWork()) {
        pendingAction = { type: "open", id: entry.id };
        render(body, LE);
        return;
      }
      openEntry(entry, LE);
    });
    actions.appendChild(openBtn);

    const renameBtn = el("button");
    renameBtn.className = "btn tiny";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", () => {
      pendingAction = { type: "rename", id: entry.id };
      render(body, LE);
    });
    actions.appendChild(renameBtn);

    const dupBtn = el("button");
    dupBtn.className = "btn tiny";
    dupBtn.textContent = "Duplicate";
    dupBtn.addEventListener("click", () => {
      duplicate(entry.id);
      render(body, LE);
    });
    actions.appendChild(dupBtn);

    const delBtn = el("button");
    delBtn.className = "btn danger tiny";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      pendingAction = { type: "delete", id: entry.id };
      render(body, LE);
    });
    actions.appendChild(delBtn);
  }

  function render(body, LE) {
    body.innerHTML = "";

    const saveSec = el("div", "section subcard", body);
    const saveLabel = el("div", "row-label", saveSec);
    saveLabel.textContent = "Save current project to this browser";
    const inputRow = el("div", "row row-actions", saveSec);
    const nameInput = document.createElement("input");
    nameInput.className = "field";
    nameInput.type = "text";
    nameInput.setAttribute("aria-label", "Project name");
    nameInput.value = LE.project.name || "Project";
    inputRow.appendChild(nameInput);
    const saveBtns = el("div", "row btn-row", saveSec);
    const currentId = LE.project._pmId;
    const currentEntry = currentId ? list().find((p) => p.id === currentId) : null;
    if (currentEntry) {
      const updateBtn = el("button");
      updateBtn.className = "btn primary";
      updateBtn.textContent = "Update \u201c" + currentEntry.name + "\u201d";
      updateBtn.addEventListener("click", () => {
        LE.project.name = nameInput.value.trim() || LE.project.name;
        try {
          update(LE, currentId);
          render(body, LE);
          if (LE.toast) LE.toast("Project updated", "success");
        } catch (e) {
          if (LE.toast) LE.toast("Save failed - browser storage is full (delete an entry or export to a file)", "error");
        }
      });
      saveBtns.appendChild(updateBtn);
    }
    const saveAsBtn = el("button");
    saveAsBtn.className = "btn" + (currentEntry ? "" : " primary");
    saveAsBtn.textContent = "Save as new entry";
    saveAsBtn.addEventListener("click", () => {
      const name = nameInput.value.trim() || "Project";
      LE.project.name = name;
      try {
        saveAs(LE, name);
        render(body, LE);
        if (LE.toast) LE.toast("Saved \u201c" + name + "\u201d to this browser", "success");
      } catch (e) {
        if (LE.toast) LE.toast("Save failed - browser storage is full (delete an entry or export to a file)", "error");
      }
    });
    saveBtns.appendChild(saveAsBtn);

    const entries = list();
    const listLabel = el("div", "row-label", body);
    listLabel.textContent = "Saved projects (" + entries.length + ")";

    if (!entries.length) {
      const hint = el("div", "hint", body);
      hint.textContent = "No project saved in this browser yet. Use \u201cSave as new entry\u201d above, or drag your .lucarne.json onto the Load button.";
      return;
    }

    entries.forEach((entry) => {
      const card = el("div", "section subcard", body);
      renderEntryCard(card, entry, LE, body);
    });
  }

  window.LucarneProjects = {
    list,
    saveAs,
    update,
    rename,
    remove,
    duplicate,
    open,
    openPanel,
  };
})();
