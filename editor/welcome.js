(function () {
  "use strict";

  const STORAGE_KEY = "lucarne_welcome_v1";
  const PROJECT_KEY = "lucarne_project_v2";
  const PROJECTS_INDEX_KEY = "lucarne_projects_index_v1";
  const RECENT_LIMIT = 5;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function icon(name, size) {
    const I = window.LucarneUiIcons;
    return I ? I.svg(name, { size: size || 18 }) : "";
  }

  function readPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("Welcome preferences unreadable", e);
      return null;
    }
  }

  function writePrefs(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn("Welcome preferences not saved", e);
    }
  }

  function hasStoredWork() {
    try {
      if (localStorage.getItem(PROJECT_KEY)) return true;
      const idx = JSON.parse(localStorage.getItem(PROJECTS_INDEX_KEY) || "[]");
      return Array.isArray(idx) && idx.length > 0;
    } catch (e) {
      return false;
    }
  }

  function shouldShow() {
    const prefs = readPrefs();
    if (prefs) return prefs.showOnStartup === true;
    return !hasStoredWork();
  }

  function formatWhen(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return min + " min ago";
    const h = Math.round(min / 60);
    if (h < 24) return h + " h ago";
    const days = Math.round(h / 24);
    if (days < 7) return days + (days === 1 ? " day ago" : " days ago");
    return d.toLocaleDateString();
  }

  function screenCount(project) {
    return project && Array.isArray(project.screens) ? project.screens.length : 0;
  }

  function widgetCount(project) {
    return project && Array.isArray(project.screens)
      ? project.screens.reduce((n, s) => n + ((s.widgets && s.widgets.length) || 0), 0)
      : 0;
  }

  function actionCard(parent, opts) {
    const b = el("button", "welcome-card" + (opts.primary ? " primary" : ""), parent);
    const ic = el("span", "welcome-card-icon", b);
    ic.setAttribute("aria-hidden", "true");
    ic.innerHTML = icon(opts.icon, 20);
    const text = el("span", "welcome-card-text", b);
    el("span", "welcome-card-title", text).textContent = opts.title;
    el("span", "welcome-card-sub", text).textContent = opts.sub;
    b.addEventListener("click", opts.run);
    return b;
  }

  function open(LE, opts) {
    opts = opts || {};
    const DLG = window.LucarneDialog;
    const S = window.LucarneState;
    if (!DLG || !S || !LE) return;
    const prefs = readPrefs() || {};
    const firstRun = !prefs.seen;
    writePrefs({ seen: true, showOnStartup: prefs.showOnStartup === true });

    let handle = null;
    const finish = (fn) => () => {
      if (handle) handle.close();
      if (fn) fn();
    };

    const replaceWith = (label, build, successMsg) =>
      finish(() => {
        LE.confirmReplaceProject(label, async () => {
          try {
            await LE.applyProject(build());
            LE.toast(successMsg, "success");
          } catch (e) {
            console.error("Welcome action failed", e);
            LE.toast(label + " failed: " + ((e && e.message) || "unknown error"), "error");
          }
        });
      });

    const blank = () => {
      const W = window.LucarneNewProjectWizard;
      const deviceId = (LE.project && LE.project.deviceId) || Object.keys(S.DEVICES)[0];
      const p = W && W.blankProject ? W.blankProject(S, deviceId) : S.defaultProject();
      if (W && W.blankProject) {
        delete p.panelWidth;
        delete p.panelHeight;
      }
      return p;
    };

    handle = DLG.open({
      title: "Welcome to Lucarne Studio",
      size: "lg",
      render: (body) => {
        body.classList.add("welcome");
        const lead = el("p", "welcome-lead", body);
        lead.textContent =
          "Design screens for small ESP32 and RP2040 displays, try them in the simulator or live on the board over USB, then export a ready-to-build Arduino sketch.";

        const steps = el("ol", "welcome-steps", body);
        steps.setAttribute("aria-label", "How it works");
        [
          ["graph", "Blueprint", "Lay out screens and link them together."],
          ["pen", "Designer", "Drop widgets on a screen and style them."],
          ["play", "Simulate", "Click through the UI with the device buttons."],
        ].forEach(([ic, title, sub], i) => {
          const li = el("li", "welcome-step", steps);
          const n = el("span", "welcome-step-num", li);
          n.setAttribute("aria-hidden", "true");
          n.textContent = String(i + 1);
          const t = el("span", "welcome-step-text", li);
          el("strong", "", t).textContent = i + 1 + ". " + title;
          el("span", "", t).textContent = sub;
        });

        const startLabel = el("h3", "welcome-heading", body);
        startLabel.textContent = "Start";
        const grid = el("div", "welcome-grid", body);

        const current = LE.project;
        const resumable = !firstRun && current && widgetCount(current) > 0;
        if (resumable) {
          actionCard(grid, {
            icon: "chevronRight",
            title: "Continue \u201c" + (current.name || "current project") + "\u201d",
            sub: screenCount(current) + " screen(s), " + widgetCount(current) + " widget(s) \u2014 restored from this browser",
            primary: true,
            run: finish(null),
          });
        }
        actionCard(grid, {
          icon: "sparkle",
          title: "New project",
          sub: "Guided setup: display, board, input and template",
          primary: !resumable,
          run: finish(() =>
            LE.confirmReplaceProject("Start a new project", () => {
              if (window.LucarneNewProjectWizard) window.LucarneNewProjectWizard.open(LE);
            })
          ),
        });
        actionCard(grid, {
          icon: "play",
          title: "Explore the demo",
          sub: "A dashboard with menus, gauges and charts",
          run: replaceWith("Open the demo project", () => S.defaultProject(), "Demo project loaded"),
        });
        actionCard(grid, {
          icon: "file",
          title: "Blank project",
          sub: "One empty Home screen on the current display",
          run: replaceWith("Start a blank project", blank, "Blank project ready"),
        });
        actionCard(grid, {
          icon: "folder",
          title: "Open a file\u2026",
          sub: "Load a .lucarne.json saved from the Studio",
          run: finish(() => LE.openFile()),
        });

        const PM = window.LucarneProjects;
        const recents = PM && PM.list ? PM.list().slice() : [];
        recents.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        if (recents.length) {
          const recentHead = el("div", "welcome-heading-row", body);
          el("h3", "welcome-heading", recentHead).textContent = "Saved in this browser";
          if (recents.length > RECENT_LIMIT) {
            const all = el("button", "btn ghost tiny", recentHead);
            all.textContent = "All projects (" + recents.length + ")";
            all.addEventListener(
              "click",
              finish(() => PM.openPanel(LE))
            );
          }
          const list = el("ul", "welcome-recents", body);
          recents.slice(0, RECENT_LIMIT).forEach((entry) => {
            const li = el("li", "", list);
            const b = el("button", "welcome-recent", li);
            const ic = el("span", "welcome-recent-icon", b);
            ic.setAttribute("aria-hidden", "true");
            ic.innerHTML = icon("file", 16);
            el("span", "welcome-recent-name", b).textContent = entry.name || "Untitled";
            el("span", "welcome-recent-when", b).textContent = formatWhen(entry.savedAt);
            b.title = "Open \u201c" + (entry.name || "Untitled") + "\u201d";
            b.addEventListener(
              "click",
              finish(() =>
                LE.confirmReplaceProject("Open \u201c" + (entry.name || "Untitled") + "\u201d", async () => {
                  try {
                    const ok = await PM.open(entry.id, LE);
                    if (ok) LE.toast("Project \u201c" + entry.name + "\u201d opened", "success");
                    else LE.toast("Project \u201c" + entry.name + "\u201d could not be read from browser storage", "error");
                  } catch (e) {
                    console.error("Recent project open failed", e);
                    LE.toast("Could not open \u201c" + entry.name + "\u201d: " + ((e && e.message) || "unknown error"), "error");
                  }
                })
              )
            );
          });
        }

        const foot = el("div", "welcome-foot", body);
        const learn = el("div", "welcome-learn", foot);
        const tourBtn = el("button", "btn", learn);
        tourBtn.innerHTML = icon("compass", 14) + "<span>Take the tour</span>";
        tourBtn.addEventListener(
          "click",
          finish(() => window.LucarneTour && window.LucarneTour.start(LE))
        );
        const keysBtn = el("button", "btn ghost", learn);
        keysBtn.innerHTML = icon("keyboard", 14) + "<span>Shortcuts</span>";
        keysBtn.addEventListener(
          "click",
          finish(() => window.LucarneHelp && window.LucarneHelp.openShortcuts(LE))
        );
        if (window.LucarneHelp && window.LucarneHelp.docUrl) {
          const docs = el("a", "btn ghost", learn);
          docs.href = window.LucarneHelp.docUrl("studio");
          docs.target = "_blank";
          docs.rel = "noopener";
          docs.innerHTML = icon("book", 14) + "<span>Documentation</span>";
        }

        const startup = el("label", "welcome-startup", foot);
        const cb = el("input", "", startup);
        cb.type = "checkbox";
        cb.checked = (readPrefs() || {}).showOnStartup === true;
        cb.addEventListener("change", () => {
          const p = readPrefs() || {};
          p.seen = true;
          p.showOnStartup = cb.checked;
          writePrefs(p);
        });
        el("span", "", startup).textContent = "Show on startup";

        if (opts.reason) {
          const note = el("div", "hint welcome-note", body);
          note.textContent = opts.reason;
          body.insertBefore(note, lead.nextSibling);
        }
      },
    });
    return handle;
  }

  window.LucarneWelcome = { open, shouldShow };
})();
