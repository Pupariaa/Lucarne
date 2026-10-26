(function () {
  "use strict";

  function webRoot() {
    const path = location.pathname.replace(/\\/g, "/");
    if (/\/editor\/v[^/]+/.test(path)) return "../../";
    if (path.indexOf("/editor/") !== -1) return "../";
    return "./";
  }

  function docUrl(page) {
    const anchor = page ? String(page).replace(/^#/, "") : "studio";
    return webRoot() + "doc/#" + anchor;
  }

  const GROUPS = [
    {
      title: "Global",
      rows: [
        ["Ctrl+Z", "Undo"],
        ["Ctrl+Shift+Z, Ctrl+Y", "Redo"],
        ["1 / 2 / 3", "Switch to Blueprint / Designer / Simulate"],
        ["?", "Open this shortcuts reference"],
      ],
    },
    {
      title: "Blueprint",
      rows: [
        ["Ctrl+C", "Copy selected screen"],
        ["Ctrl+V", "Paste screen"],
        ["Delete, Backspace", "Delete selected screen"],
        ["+, =", "Zoom in"],
        ["-", "Zoom out"],
        ["F", "Fit graph to view"],
      ],
    },
    {
      title: "Designer",
      rows: [
        ["Arrow keys", "Nudge selected widget by 1 px"],
        ["Shift + arrows", "Nudge selected widget by 8 px"],
        ["Escape", "Deselect widget"],
        ["Ctrl+C / Ctrl+V", "Copy and paste widget"],
        ["Delete, Backspace", "Delete selected widget"],
      ],
    },
    {
      title: "Simulate",
      rows: [
        ["Arrow keys", "Navigate menus and focus"],
        ["Enter, Space", "Select / activate"],
        ["Backspace", "Back"],
      ],
    },
  ];

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function renderShortcutsBody(body) {
    body.classList.add("help-shortcuts");
    const intro = el("p", "help-shortcuts-lead hint", body);
    intro.textContent =
      "Shortcuts apply when focus is not in a text field. On tablet widths, open the inspector drawer from the panel button if a step of the tour points at the dock.";
    GROUPS.forEach((g) => {
      const sec = el("section", "help-shortcuts-group", body);
      el("h3", "help-shortcuts-title", sec).textContent = g.title;
      const table = el("table", "help-shortcuts-table", sec);
      const tbody = el("tbody", "", table);
      g.rows.forEach((row) => {
        const tr = el("tr", "", tbody);
        const k = el("td", "help-shortcuts-key", tr);
        k.textContent = row[0];
        el("td", "help-shortcuts-desc", tr).textContent = row[1];
      });
    });
    const foot = el("div", "help-shortcuts-foot", body);
    const a = el("a", "btn ghost", foot);
    a.href = docUrl("studio");
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Open full documentation";
  }

  function openShortcuts(LE) {
    const DLG = window.LucarneDialog;
    if (!DLG) return;
    DLG.open({
      title: "Keyboard shortcuts",
      size: "lg",
      render: (body) => renderShortcutsBody(body),
      actions: [{ label: "Close", cls: "primary" }],
    });
  }

  window.LucarneHelp = { openShortcuts, docUrl };
})();
