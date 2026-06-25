(function () {
  "use strict";

  const R = window.LucarneRender;
  const S = window.LucarneState;

  const $ = (id) => document.getElementById(id);

  const dom = {
    projectName: $("projectName"),
    deviceSel: $("deviceSel"),
    panelW: $("panelW"),
    panelH: $("panelH"),
    rotationSel: $("rotationSel"),
    graphHost: $("graphHost"),
    designerHost: $("designerHost"),
    simHost: $("simHost"),
    dockBody: $("dockBody"),
    tabInspector: $("tab-inspector"),
    tabTheme: $("tab-theme"),
    tabFonts: $("tab-fonts"),
    tabAssets: $("tab-assets"),
    tabData: $("tab-data"),
    modal: $("modal"),
    modalText: $("modalText"),
    modalFiles: $("modalFiles"),
    liveSpeed: $("liveSpeed"),
    toast: $("toast"),
    fileLoad: $("fileLoad"),
  };

  let project = S.load() || S.defaultProject();
  if (!project.panelWidth || !project.panelHeight) {
    const d = S.device(project);
    project.panelWidth = d.w;
    project.panelHeight = d.h;
  }
  let mode = "blueprint";

  const LE = {
    project,
    graphSel: null,
    selection: {},
    designerScreen: null,
    genId: S.genId,
    device: () => S.device(LE.project),
    dims: () => S.dims(LE.project),
    nativeDims: () => S.nativeDims(LE.project),
    getScreen: (id) => S.getScreen(LE.project, id),
    iconNames: () => S.iconNames(LE.project),
    liveSpeedById: (id) => S.liveSpeedById(id),
    toast,
    autosave: () => S.save(LE.project),
    fontAtlas: (id) => {
      const f = LE.project.fonts[id];
      return f && f._atlas ? f._atlas : null;
    },
    imageAtlas: (id) => {
      const img = LE.project.images && LE.project.images[id];
      return img && img.pixels ? window.LucarneAssets.atlas(img) : null;
    },
    customIconAtlas: (id) => {
      const ic = LE.project.icons && LE.project.icons[id];
      if (!ic) return null;
      return window.LucarneAssets.iconAtlas(ic);
    },
    renderTheme: () => {
      const t = LE.project.theme;
      return R.themeTo565(t, LE.fontAtlas(t.fontBodyId), LE.fontAtlas(t.fontTitleId));
    },
    env: (screen, selMap, extra) => ({
      getValue: (key) => {
        const k = LE.project.keys.find((x) => x.name === key);
        return k ? { type: k.type, value: k.value } : null;
      },
      menuSelection: (menuId, count) => {
        let i = selMap && selMap[menuId] !== undefined ? selMap[menuId] : 0;
        if (i < 0) i = 0;
        if (count && i >= count) i = count - 1;
        return i;
      },
      imageAtlas: (id) => LE.imageAtlas(id),
      customIconAtlas: (id) => LE.customIconAtlas(id),
      splashElapsedMs: extra && extra.splashElapsedMs,
    }),
    requestRender,
    markDirty,
    refreshDock,
    openDesigner,
    exitDesigner,
    setMode,
    addScreen,
  };

  let graph, designer, simulate;

  function toast(msg) {
    dom.toast.textContent = msg;
    dom.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (dom.toast.hidden = true), 1800);
  }

  function autosave() {
    S.save(LE.project);
  }

  function markDirty() {
    autosave();
    requestRender();
  }

  function requestRender() {
    if (mode === "blueprint") graph.render();
    else if (mode === "designer") designer.render();
    else if (mode === "simulate") simulate.render();
    pushLive();
  }

  function focusedScreenId() {
    if (mode === "designer" && LE.designerScreen) return LE.designerScreen;
    if (LE.graphSel && LE.graphSel.type === "node") return LE.graphSel.id;
    return LE.project.startScreen || (LE.project.screens[0] && LE.project.screens[0].id);
  }

  function pushLive() {
    if (!LE.live || !LE.live.isConnected()) return;
    if (mode === "simulate") return;
    const s = LE.getScreen(focusedScreenId());
    if (!s) return;
    const d = LE.dims();
    const disp = new R.Display(d.w, d.h);
    R.drawScreen(disp, s, LE.renderTheme(), LE.env(s, {}));
    LE.live.sendDisplay(disp);
  }

  async function sendLiveSetup() {
    if (!LE.live || !LE.live.isConnected()) return;
    const n = LE.nativeDims();
    const rot = LE.project.rotation || 0;
    await LE.live.sendSetup(n.w, n.h, rot);
    if (LE.live.resetFrame) LE.live.resetFrame();
    await new Promise((r) => setTimeout(r, 40));
    pushLive();
  }

  function setMode(m) {
    mode = m;
    dom.graphHost.hidden = m !== "blueprint";
    dom.designerHost.hidden = m !== "designer";
    dom.simHost.hidden = m !== "simulate";
    document.querySelectorAll(".modeTab").forEach((b) =>
      b.classList.toggle("active", b.dataset.mode === m)
    );
    if (m === "blueprint") graph.render();
    else if (m === "simulate") simulate.open();
    refreshDock();
    pushLive();
  }

  function openDesigner(id) {
    mode = "designer";
    dom.graphHost.hidden = true;
    dom.designerHost.hidden = false;
    dom.simHost.hidden = true;
    LE.selection = {};
    LE.designerScreen = id;
    designer.open(id);
    refreshDock();
    pushLive();
  }

  function exitDesigner() {
    setMode("blueprint");
  }

  function addScreen() {
    const id = S.genId("scr");
    const screen = {
      id,
      name: "Screen " + (LE.project.screens.length + 1),
      gx: 120 + LE.project.screens.length * 40,
      gy: 120 + LE.project.screens.length * 30,
      widgets: [],
    };
    LE.project.screens.push(screen);
    LE.graphSel = { type: "node", id };
    markDirty();
    refreshDock();
  }

  /* ---------------- Font baking ---------------- */
  async function bakeFont(entry) {
    try {
      if (entry.kind === "google") {
        await window.LucarneFonts.loadGoogle(entry.googleName || entry.family, entry.weight);
        entry.family = entry.googleName || entry.family;
      } else if (entry.kind === "upload") {
        if (entry.base64 && !entry._loaded) {
          entry.family = await window.LucarneFonts.loadBase64(
            entry.family || "Up_" + entry.id,
            entry.base64
          );
          entry._loaded = true;
        }
      }
      entry._atlas = window.LucarneFonts.bake(entry.family, entry.sizePx, entry.weight);
    } catch (e) {
      entry._atlas = null;
    }
  }

  async function ensureFonts() {
    await window.LucarneFonts.ensureDefault();
    const ids = Object.keys(LE.project.fonts);
    for (const id of ids) await bakeFont(LE.project.fonts[id]);
    requestRender();
  }

  /* ---------------- Dock ---------------- */
  function row(parent, labelText) {
    const r = document.createElement("div");
    r.className = "row";
    if (labelText !== null && labelText !== undefined) {
      const l = document.createElement("label");
      l.textContent = labelText;
      r.appendChild(l);
    }
    parent.appendChild(r);
    return r;
  }

  function input(type, value, oninput) {
    const i = document.createElement("input");
    i.className = "field";
    i.type = type;
    if (type === "checkbox") i.checked = !!value;
    else i.value = value === undefined || value === null ? "" : value;
    i.addEventListener("input", () => oninput(type === "checkbox" ? i.checked : i.value));
    return i;
  }

  function select(options, value, onchange) {
    const s = document.createElement("select");
    s.className = "field";
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.value === value) opt.selected = true;
      s.appendChild(opt);
    });
    s.addEventListener("change", () => onchange(s.value));
    return s;
  }

  function fieldRow(parent, label, type, value, oninput) {
    const r = row(parent, label);
    const i = input(type, value, oninput);
    if (type === "checkbox") i.style.flex = "0";
    else i.classList.add("field");
    r.appendChild(i);
    return i;
  }

  function selectRow(parent, label, options, value, onchange) {
    const r = row(parent, label);
    r.appendChild(select(options, value, onchange));
  }

  function iconDisplayName(ref) {
    if (!ref || ref === "none") return "none";
    if (ref.indexOf("tabler:") === 0) return ref.slice(7);
    if (ref.indexOf("streamline:") === 0) return "streamline / " + ref.slice(11);
    if (ref.indexOf("glyphs:") === 0) return "glyphs / " + ref.slice(7);
    if (ref.indexOf("c:") === 0) return ref.slice(2);
    return ref;
  }

  function iconPickerExtras() {
    const extras = [{ value: "none", label: "none" }];
    Object.keys(window.LUCARNE_ICONS || {}).forEach((n) => extras.push({ value: n, label: n }));
    Object.keys(LE.project.icons || {}).forEach((id) => {
      const ic = LE.project.icons[id];
      extras.push({ value: "c:" + id, label: ic.label || id, icon: window.LucarneAssets.iconAtlas(ic) });
    });
    return extras;
  }

  function paintIconCanvas(canvas, ref) {
    const ic = R.resolveIcon(ref, LE.env(null));
    if (window.LucarneIconFmt) window.LucarneIconFmt.drawToCanvas(canvas, ic);
  }

  async function ensureIconRefLoaded(ref) {
    if (!ref || ref === "none") return;
    const tn = window.LucarneTabler && window.LucarneTabler.parseTablerRef(ref);
    if (tn) await window.LucarneTabler.ensureIcon(tn);
    else if (window.LucarneIconPacks && (ref.indexOf("streamline:") === 0 || ref.indexOf("glyphs:") === 0)) {
      await window.LucarneIconPacks.ensureRef(ref);
    }
  }

  function applyIconToDesigner(ref) {
    if (mode !== "designer" || !LE.designerScreen) return false;
    const s = LE.getScreen(LE.designerScreen);
    if (!s) return false;
    const size = window.LucarneIconFmt ? window.LucarneIconFmt.ICON_SIZE : 32;
    const sel = LE.selection.widgetId ? s.widgets.find((x) => x.id === LE.selection.widgetId) : null;
    if (sel && sel.type === "icon") {
      sel.icon = ref;
      if (!sel.w || sel.w < size) sel.w = size;
      if (!sel.h || sel.h < size) sel.h = size;
      return true;
    }
    const id = S.genId("w");
    s.widgets.push({ id, type: "icon", x: 20, y: 20, w: size, h: size, icon: ref, scale: 1 });
    LE.selection = { widgetId: id };
    return true;
  }

  async function pickIconRef(ref, opts) {
    opts = opts || {};
    const value = ref || "none";
    try {
      await ensureIconRefLoaded(value);
    } catch (e) {
      toast("Icon load failed");
      return;
    }
    if (opts.applyToScreen !== false && applyIconToDesigner(value)) {
      markDirty();
      refreshDock();
      toast("Icon placed on screen");
      return;
    }
    if (opts.applyToScreen !== false && mode !== "designer") {
      toast("Open designer to place icons on screen");
    }
    if (opts.onSelect) opts.onSelect(value);
  }

  function iconPickerRow(parent, label, value, onchange) {
    const r = row(parent, label);
    const wrap = document.createElement("div");
    wrap.className = "icon-field";
    const cv = document.createElement("canvas");
    cv.className = "icon-field-preview";
    cv.width = 32;
    cv.height = 32;
    paintIconCanvas(cv, value);
    const name = document.createElement("span");
    name.className = "icon-field-name";
    name.textContent = iconDisplayName(value);
    wrap.appendChild(cv);
    wrap.appendChild(name);
    wrap.appendChild(
      btn("Browse…", "tiny", () => {
        window.LucarneIconPicker.open({
          value: value || "none",
          extras: iconPickerExtras(),
          onSelect: (v) => {
            const ref = v || "none";
            const done = () => {
              paintIconCanvas(cv, ref);
              name.textContent = iconDisplayName(ref);
              onchange(ref);
            };
            ensureIconRefLoaded(ref).then(done).catch(() => toast("Icon load failed"));
          },
        });
      })
    );
    r.appendChild(wrap);
  }

  async function preloadIcons() {
    try {
      if (window.LucarneIconPacks) await window.LucarneIconPacks.preloadProject(LE.project);
      if (window.LucarneTabler) await window.LucarneTabler.preloadProject(LE.project);
      requestRender();
    } catch (e) {}
  }

  function section(parent, title, action) {
    const sec = document.createElement("div");
    sec.className = "section";
    const t = document.createElement("div");
    t.className = "section-title";
    const span = document.createElement("span");
    span.textContent = title;
    t.appendChild(span);
    if (action) t.appendChild(action);
    sec.appendChild(t);
    parent.appendChild(sec);
    return sec;
  }

  function btn(text, cls, onclick) {
    const b = document.createElement("button");
    b.className = "btn " + (cls || "");
    b.textContent = text;
    b.addEventListener("click", onclick);
    return b;
  }

  function refreshDock() {
    buildInspector();
    buildTheme();
    buildFonts();
    buildAssets();
    buildData();
  }

  /* ---------- Inspector ---------- */
  function buildInspector() {
    const host = dom.tabInspector;
    host.innerHTML = "";
    if (mode === "designer") return buildDesignerInspector(host);
    if (mode === "simulate") {
      const sec = section(host, "Simulate");
      const h = document.createElement("div");
      h.className = "hint";
      h.textContent =
        "Use the on-screen pad or arrow keys to navigate. Enter selects, Backspace goes back. Transitions play as configured.";
      sec.appendChild(h);
      return;
    }
    if (LE.graphSel && LE.graphSel.type === "node") return buildNodeInspector(host);
    if (LE.graphSel && LE.graphSel.type === "link") return buildLinkInspector(host);
    return buildProjectInspector(host);
  }

  function buildProjectInspector(host) {
    const sec = section(host, "Project", btn("+ Screen", "tiny primary", addScreen));
    const opts = LE.project.screens.map((s) => ({ value: s.id, label: s.name || s.id }));
    selectRow(sec, "Start", opts, LE.project.startScreen, (v) => {
      LE.project.startScreen = v;
      markDirty();
    });
    selectRow(
      sec,
      "Transition",
      S.TRANSITIONS.map((t) => ({ value: t, label: t })),
      LE.project.transition.default,
      (v) => {
        LE.project.transition.default = v;
        markDirty();
      }
    );
    fieldRow(sec, "Duration", "number", LE.project.transition.durationMs, (v) => {
      LE.project.transition.durationMs = parseInt(v, 10) || 0;
      autosave();
    });

    buildUiSourceSection(host);

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Double-click a screen to design it. Drag an item pin onto a screen to link.";
    host.appendChild(hint);
  }

  function buildUiSourceSection(host) {
    if (!LE.project.uiSource) LE.project.uiSource = S.defaultUiSource();
    const src = LE.project.uiSource;
    const sec = section(host, "UI source");
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent =
      "Where the UI is loaded from at runtime or in Live preview. Embedded uses this project; URL and SD fetch external JSON.";
    sec.appendChild(hint);

    selectRow(
      sec,
      "Source",
      [
        { value: "project", label: "Embedded (this project)" },
        { value: "url", label: "Web server" },
        { value: "sd", label: "SD card" },
      ],
      src.mode || "project",
      (v) => {
        src.mode = v;
        markDirty();
        refreshDock();
      }
    );

    if (src.mode === "url") {
      fieldRow(sec, "URL", "text", src.url || "", (v) => {
        src.url = v.trim();
        autosave();
      });
      const r = row(sec, "");
      r.appendChild(
        btn("Load from URL", "primary tiny", () => loadFromUrl())
      );
    } else if (src.mode === "sd") {
      fieldRow(sec, "SD path", "text", src.sdPath || "/ui.lucarne.json", (v) => {
        src.sdPath = v.trim() || "/ui.lucarne.json";
        autosave();
      });
      const r = row(sec, "");
      r.appendChild(
        btn("Load from SD", "primary tiny", () => loadFromSd())
      );
      const h2 = document.createElement("div");
      h2.className = "hint";
      h2.textContent = "SD load requires Live connected and LUCARNE_LIVE_SD in LucarnePreview.";
      sec.appendChild(h2);
    }
  }

  function buildNodeInspector(host) {
    const s = LE.getScreen(LE.graphSel.id);
    if (!s) return buildProjectInspector(host);
    const sec = section(host, "Screen");
    fieldRow(sec, "Name", "text", s.name, (v) => {
      s.name = v;
      autosave();
      graph.render();
    });
    fieldRow(sec, "Corner radius", "number", s.cornerRadius || 0, (v) => {
      s.cornerRadius = Math.max(0, parseInt(v, 10) || 0);
      markDirty();
    });
    const isStart = LE.project.startScreen === s.id;
    const r = row(sec, "");
    r.appendChild(
      btn(isStart ? "Start screen" : "Set as start", isStart ? "primary" : "", () => {
        LE.project.startScreen = s.id;
        markDirty();
        refreshDock();
      })
    );

    const br = row(sec, "");
    br.appendChild(btn("Edit screen", "primary", () => openDesigner(s.id)));
    br.appendChild(
      btn("Delete", "danger", () => {
        if (LE.project.screens.length <= 1) return toast("Keep at least one screen");
        LE.project.screens = LE.project.screens.filter((x) => x.id !== s.id);
        LE.project.screens.forEach((sc) =>
          sc.widgets.forEach((w) => {
            if (w.type === "menu") (w.items || []).forEach((it) => {
              if (it.target === s.id) it.target = "";
            });
          })
        );
        if (LE.project.startScreen === s.id) LE.project.startScreen = LE.project.screens[0].id;
        LE.graphSel = null;
        markDirty();
        refreshDock();
      })
    );

    const hasMenu = s.widgets.some((w) => w.type === "menu");
    if (hasMenu) buildInputSection(host);

    const splashSec = section(host, "Splash screen");
    if (!s.splash) s.splash = { enabled: false, durationMs: 2000, showProgress: true, nextScreen: "" };
    const sp = s.splash;
    const enRow = row(splashSec, "Splash");
    const enChk = input("checkbox", sp.enabled, (v) => {
      sp.enabled = v;
      markDirty();
    });
    enChk.style.flex = "0";
    enRow.appendChild(enChk);
    fieldRow(splashSec, "Duration ms", "number", sp.durationMs || 2000, (v) => {
      sp.durationMs = parseInt(v, 10) || 0;
      autosave();
    });
    const progRow = row(splashSec, "Progress bar");
    const progChk = input("checkbox", sp.showProgress !== false, (v) => {
      sp.showProgress = v;
      autosave();
    });
    progChk.style.flex = "0";
    progRow.appendChild(progChk);
    selectRow(
      splashSec,
      "Next screen",
      [{ value: "", label: "(none)" }].concat(
        LE.project.screens.filter((x) => x.id !== s.id).map((x) => ({ value: x.id, label: x.name || x.id }))
      ),
      sp.nextScreen || "",
      (v) => {
        sp.nextScreen = v;
        markDirty();
      }
    );
    const sh = document.createElement("div");
    sh.className = "hint";
    sh.textContent = "Set this screen as start. After the duration, navigates to the next screen automatically.";
    splashSec.appendChild(sh);
  }

  function buildInputSection(host) {
    const inp = LE.project.input;
    const sec = section(host, "Navigation input");
    selectRow(
      sec,
      "Type",
      [
        { value: "buttons", label: "Buttons" },
        { value: "encoder", label: "Encoder" },
        { value: "touch", label: "Touch" },
      ],
      inp.type,
      (v) => {
        inp.type = v;
        autosave();
        refreshDock();
      }
    );
    if (inp.type === "buttons") {
      const b = inp.buttons;
      fieldRow(sec, "Up pin", "number", b.up, (v) => ((b.up = +v), autosave()));
      fieldRow(sec, "Down pin", "number", b.down, (v) => ((b.down = +v), autosave()));
      fieldRow(sec, "OK pin", "number", b.ok, (v) => ((b.ok = +v), autosave()));
      fieldRow(sec, "Back pin", "number", b.back, (v) => ((b.back = +v), autosave()));
    } else if (inp.type === "encoder") {
      const e = inp.encoder;
      fieldRow(sec, "A pin", "number", e.a, (v) => ((e.a = +v), autosave()));
      fieldRow(sec, "B pin", "number", e.b, (v) => ((e.b = +v), autosave()));
      fieldRow(sec, "Btn pin", "number", e.btn, (v) => ((e.btn = +v), autosave()));
    } else {
      const h = document.createElement("div");
      h.className = "hint";
      h.textContent = "Touch: call projet::input.feed(x, y, pressed) from your touch driver.";
      sec.appendChild(h);
    }
    const r = row(sec, "Active low");
    const c = input("checkbox", inp.activeLow, (v) => ((inp.activeLow = v), autosave()));
    c.style.flex = "0";
    r.appendChild(c);
  }

  function syncIconWidgetBounds(w, screen) {
    if (!w || w.type !== "icon") return;
    const ic = R.resolveIcon(w.icon, LE.env(screen));
    const base = ic ? ic.w || 16 : 16;
    const sc = Math.max(1, Math.min(4, parseInt(w.scale, 10) || 1));
    w.scale = sc;
    w.w = base * sc;
    w.h = base * sc;
  }

  function parseMenuItemScale(v) {
    if (v === "" || v === null || v === undefined) return 0;
    const n = parseInt(v, 10);
    if (!(n > 0)) return 0;
    return Math.min(4, n);
  }

  function rightIconMode(it) {
    const ri = it.rightIcon || "auto";
    if (ri === "none") return "none";
    if (ri === "auto" || ri === "") return "auto";
    return "custom";
  }

  function appendMenuItemFields(parent, it, menu) {
    iconPickerRow(parent, "Left icon", it.icon || "none", (v) => {
      it.icon = v;
      markDirty();
    });
    fieldRow(parent, "Left icon scale", "number", it.iconScale > 0 ? it.iconScale : "", (v) => {
      it.iconScale = parseMenuItemScale(v);
      markDirty();
    });
    const riMode = rightIconMode(it);
    selectRow(
      parent,
      "Right icon",
      [
        { value: "auto", label: "Auto (arrow if navigate)" },
        { value: "none", label: "Hidden" },
        { value: "custom", label: "Custom" },
      ],
      riMode,
      (v) => {
        if (v === "auto") it.rightIcon = "auto";
        else if (v === "none") it.rightIcon = "none";
        else it.rightIcon = riMode === "custom" && it.rightIcon && it.rightIcon !== "auto" && it.rightIcon !== "none" ? it.rightIcon : "arrow_right";
        markDirty();
        refreshDock();
      }
    );
    if (rightIconMode(it) === "custom") {
      iconPickerRow(parent, "Right icon pick", it.rightIcon || "arrow_right", (v) => {
        it.rightIcon = v;
        markDirty();
      });
    }
    fieldRow(parent, "Right icon scale", "number", it.rightIconScale > 0 ? it.rightIconScale : "", (v) => {
      it.rightIconScale = parseMenuItemScale(v);
      markDirty();
    });
    if (!it.action) it.action = it.callbackId ? "callback" : "navigate";
    selectRow(
      parent,
      "Action",
      [
        { value: "navigate", label: "Navigate" },
        { value: "callback", label: "Callback" },
      ],
      it.action,
      (v) => {
        it.action = v;
        if (v === "callback") it.target = "";
        markDirty();
        refreshDock();
      }
    );
    if (it.action === "navigate") {
      return "navigate";
    }
    fieldRow(parent, "Callback ID", "text", it.callbackId || "", (v) => {
      it.callbackId = v.replace(/[^a-zA-Z0-9_]/g, "_");
      markDirty();
    });
    return "callback";
  }

  function buildLinkInspector(host) {
    const sel = LE.graphSel;
    const s = LE.getScreen(sel.screen);
    const m = s && s.widgets.find((w) => w.id === sel.menu);
    const it = m && (m.items || []).find((i) => i.id === sel.item);
    if (!it) return buildProjectInspector(host);
    const sec = section(host, "Link");
    const r0 = row(sec, "From");
    const lbl = document.createElement("div");
    lbl.className = "field";
    lbl.textContent = (s.name || s.id) + " · " + (it.label || "item");
    r0.appendChild(lbl);
    if (!it.action) it.action = it.target ? "navigate" : "callback";
    appendMenuItemFields(sec, it, m);
    if ((it.action || "navigate") === "navigate") {
      selectRow(
        sec,
        "Target",
        [{ value: "", label: "(none)" }].concat(
          LE.project.screens.filter((x) => x.id !== s.id).map((x) => ({ value: x.id, label: x.name || x.id }))
        ),
        it.target || "",
        (v) => {
          it.target = v;
          markDirty();
        }
      );
      selectRow(
        sec,
        "Transition",
        [{ value: "Inherit", label: "Inherit (" + LE.project.transition.default + ")" }].concat(
          S.TRANSITIONS.map((t) => ({ value: t, label: t }))
        ),
        it.transition || "Inherit",
        (v) => {
          it.transition = v;
          autosave();
        }
      );
    } else {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "In loop(): switch (ui.pollMenuAction()) { case projet::ACTION_" + (it.callbackId || "id").replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase() + ": ... }";
      sec.appendChild(hint);
    }
    const r = row(sec, "");
    r.appendChild(
      btn("Remove link", "danger", () => {
        if (it.action === "navigate") it.target = "";
        else it.callbackId = "";
        LE.graphSel = null;
        markDirty();
        refreshDock();
      })
    );
  }

  /* ---------- Designer inspector (widget props) ---------- */
  function buildDesignerInspector(host) {
    const s = LE.getScreen(LE.designerScreen);
    if (!s) return;
    const w = LE.selection.widgetId ? s.widgets.find((x) => x.id === LE.selection.widgetId) : null;
    if (!w) {
      const sec = section(host, "Screen");
      fieldRow(sec, "Name", "text", s.name, (v) => {
        s.name = v;
        autosave();
      });
      const h = document.createElement("div");
      h.className = "hint";
      h.textContent = "Select a widget to edit it, or add one from the palette.";
      host.appendChild(h);
      return;
    }

    const sec = section(host, w.type.charAt(0).toUpperCase() + w.type.slice(1));
    const geo = row(sec, "Pos / Size");
    const wrap = document.createElement("div");
    wrap.className = "field inline";
    wrap.style.border = "0";
    wrap.style.padding = "0";
    wrap.style.background = "transparent";
    ["x", "y", "w", "h"].forEach((k) => {
      const i = input("number", w[k] || 0, (v) => {
        w[k] = parseInt(v, 10) || 0;
        const d = LE.dims();
        const bw = w.w && w.w > 0 ? w.w : 40;
        const bh = w.h && w.h > 0 ? w.h : 16;
        if (w.x < 0) w.x = 0;
        if (w.y < 0) w.y = 0;
        if (w.x + bw > d.w) w.x = d.w - bw;
        if (w.y + bh > d.h) w.y = d.h - bh;
        if (w.w > 0 && w.x + w.w > d.w) w.w = d.w - w.x;
        if (w.h > 0 && w.y + w.h > d.h) w.h = d.h - w.y;
        markDirty();
      });
      wrap.appendChild(i);
    });
    geo.appendChild(wrap);

    if (w.type === "label") {
      fieldRow(sec, "Text", "text", w.text, (v) => ((w.text = v), markDirty()));
      selectRow(sec, "Align", [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ], w.align || "left", (v) => ((w.align = v), markDirty()));
      selectRow(sec, "Font", [
        { value: "body", label: "Body" },
        { value: "title", label: "Title" },
      ], w.font || "body", (v) => ((w.font = v), markDirty()));
      colorRow(sec, "Color", w.color, true, (v) => ((w.color = v), markDirty()));
    } else if (w.type === "metric") {
      fieldRow(sec, "Label", "text", w.label, (v) => ((w.label = v), markDirty()));
      keyRow(sec, "Key", w.key, (v) => ((w.key = v), markDirty()));
      fieldRow(sec, "Unit", "text", w.unit, (v) => ((w.unit = v), markDirty()));
      fieldRow(sec, "Decimals", "number", w.decimals === undefined ? 1 : w.decimals, (v) => ((w.decimals = parseInt(v, 10) || 0), markDirty()));
      colorRow(sec, "Accent", w.accent, true, (v) => ((w.accent = v), markDirty()));
    } else if (w.type === "bar") {
      keyRow(sec, "Key", w.key, (v) => ((w.key = v), markDirty()));
      fieldRow(sec, "Min", "number", w.min === undefined ? 0 : w.min, (v) => ((w.min = parseFloat(v) || 0), markDirty()));
      fieldRow(sec, "Max", "number", w.max === undefined ? 1 : w.max, (v) => ((w.max = parseFloat(v) || 0), markDirty()));
      const r = row(sec, "Show value");
      const c = input("checkbox", w.showValue, (v) => ((w.showValue = v), markDirty()));
      c.style.flex = "0";
      r.appendChild(c);
      colorRow(sec, "Color", w.color, true, (v) => ((w.color = v), markDirty()));
    } else if (w.type === "icon") {
      syncIconWidgetBounds(w, s);
      iconPickerRow(sec, "Icon", w.icon || "chart", (v) => {
        w.icon = v;
        ensureIconRefLoaded(v)
          .then(() => {
            syncIconWidgetBounds(w, s);
            markDirty();
          })
          .catch(() => toast("Icon load failed"));
      });
      const scaleInput = fieldRow(sec, "Scale", "number", w.scale || 1, (v) => {
        w.scale = Math.max(1, Math.min(4, parseInt(v, 10) || 1));
        syncIconWidgetBounds(w, s);
        markDirty();
      });
      scaleInput.min = "1";
      scaleInput.max = "4";
      colorRow(sec, "Color", w.color, true, (v) => ((w.color = v), markDirty()));
    } else if (w.type === "image") {
      if (!LE.project.images) LE.project.images = {};
      const imgOpts = [{ value: "", label: "(none)" }].concat(
        Object.keys(LE.project.images).map((id) => ({
          value: id,
          label: (LE.project.images[id].label || id) + " (" + (LE.project.images[id].storage || "flash") + ")",
        }))
      );
      selectRow(sec, "Image", imgOpts, w.imageId || "", (v) => ((w.imageId = v), markDirty()));
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "Import and manage images in the Assets tab.";
      sec.appendChild(hint);
    } else if (w.type === "menu") {
      const menuLeftScale = fieldRow(sec, "Default left icon scale", "number", w.iconScale || 1, (v) => {
        w.iconScale = Math.max(1, Math.min(4, parseInt(v, 10) || 1));
        markDirty();
      });
      menuLeftScale.min = "1";
      menuLeftScale.max = "4";
      const menuRightScale = fieldRow(sec, "Default right icon scale", "number", w.badgeScale || 1, (v) => {
        w.badgeScale = Math.max(1, Math.min(4, parseInt(v, 10) || 1));
        markDirty();
      });
      menuRightScale.min = "1";
      menuRightScale.max = "4";
      buildMenuItems(host, s, w);
    }

    const del = row(sec, "");
    del.appendChild(
      btn("Delete widget", "danger", () => {
        s.widgets = s.widgets.filter((x) => x.id !== w.id);
        LE.selection = {};
        markDirty();
        refreshDock();
      })
    );
  }

  function buildMenuItems(host, screen, menu) {
    const sec = section(
      host,
      "Menu items",
      btn("+ Item", "tiny primary", () => {
        menu.items = menu.items || [];
        menu.items.push({
          id: S.genId("it"),
          label: "Item",
          icon: "none",
          rightIcon: "auto",
          action: "navigate",
          target: "",
          transition: "Inherit",
          callbackId: "",
        });
        markDirty();
        refreshDock();
      })
    );
    (menu.items || []).forEach((it, idx) => {
      const card = document.createElement("div");
      card.className = "section";
      card.style.background = "var(--panel)";
      card.style.border = "1px solid var(--edge)";
      card.style.borderRadius = "9px";
      card.style.padding = "8px";
      fieldRow(card, "Label", "text", it.label, (v) => ((it.label = v), markDirty()));
      appendMenuItemFields(card, it, menu);
      if (it.action === "navigate") {
        selectRow(
          card,
          "Target",
          [{ value: "", label: "(none)" }].concat(
            LE.project.screens.filter((x) => x.id !== screen.id).map((x) => ({ value: x.id, label: x.name || x.id }))
          ),
          it.target || "",
          (v) => ((it.target = v), markDirty())
        );
        selectRow(
          card,
          "Transition",
          [{ value: "Inherit", label: "Inherit" }].concat(S.TRANSITIONS.map((t) => ({ value: t, label: t }))),
          it.transition || "Inherit",
          (v) => ((it.transition = v), autosave())
        );
      } else if (it.callbackId) {
        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = "loop: case projet::ACTION_" + it.callbackId.replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
        card.appendChild(hint);
      }
      const r = row(card, "");
      r.appendChild(
        btn("Remove", "danger tiny", () => {
          menu.items.splice(idx, 1);
          markDirty();
          refreshDock();
        })
      );
      sec.appendChild(card);
    });
  }

  function colorRow(parent, label, value, clearable, onchange) {
    const r = document.createElement("div");
    r.className = "row color";
    const l = document.createElement("label");
    l.textContent = label;
    r.appendChild(l);
    const c = document.createElement("input");
    c.type = "color";
    c.value = value || "#5e96ff";
    c.addEventListener("input", () => onchange(c.value));
    r.appendChild(c);
    if (clearable) {
      const x = btn("auto", "tiny", () => {
        onchange(undefined);
        refreshDock();
      });
      r.appendChild(x);
    }
    parent.appendChild(r);
  }

  function keyRow(parent, label, value, onchange) {
    const opts = [{ value: "", label: "(none)" }].concat(
      LE.project.keys.map((k) => ({ value: k.name, label: k.name }))
    );
    selectRow(parent, label, opts, value || "", onchange);
  }

  /* ---------- Theme pane ---------- */
  function buildTheme() {
    const host = dom.tabTheme;
    host.innerHTML = "";
    const t = LE.project.theme;
    const sec = section(host, "Colors");
    S.THEME_KEYS.forEach(([k, label]) => {
      colorRow(sec, label, t[k], false, (v) => {
        t[k] = v;
        markDirty();
      });
    });
    const sec2 = section(host, "Metrics");
    fieldRow(sec2, "Radius", "number", t.radius, (v) => ((t.radius = +v), markDirty()));
    fieldRow(sec2, "Padding", "number", t.padding, (v) => ((t.padding = +v), markDirty()));
    fieldRow(sec2, "Row height", "number", t.rowHeight, (v) => ((t.rowHeight = +v), markDirty()));

    const fontOpts = Object.values(LE.project.fonts).map((f) => ({ value: f.id, label: f.label }));
    const sec3 = section(host, "Fonts");
    selectRow(sec3, "Body", fontOpts, t.fontBodyId, (v) => ((t.fontBodyId = v), markDirty()));
    selectRow(sec3, "Title", fontOpts, t.fontTitleId, (v) => ((t.fontTitleId = v), markDirty()));
    fieldRow(sec3, "Fallback size", "number", t.textSize, (v) => ((t.textSize = +v || 1), markDirty()));
  }

  /* ---------- Fonts pane ---------- */
  function buildFonts() {
    const host = dom.tabFonts;
    host.innerHTML = "";
    const list = section(host, "Defined fonts");
    Object.values(LE.project.fonts).forEach((f) => {
      const card = document.createElement("div");
      card.className = "section";
      card.style.background = "var(--panel)";
      card.style.border = "1px solid var(--edge)";
      card.style.borderRadius = "9px";
      card.style.padding = "8px";
      const title = document.createElement("div");
      title.className = "section-title";
      const span = document.createElement("span");
      span.textContent = f.label + (f.builtin ? " (built-in)" : "");
      title.appendChild(span);
      card.appendChild(title);
      const info = document.createElement("div");
      info.className = "hint";
      info.textContent = (f.family || "") + " · " + f.sizePx + "px" + (f.weight ? " · w" + f.weight : "");
      card.appendChild(info);
      fieldRow(card, "Label", "text", f.label, (v) => ((f.label = v), autosave(), buildTheme()));
      fieldRow(card, "Size", "number", f.sizePx, async (v) => {
        f.sizePx = parseInt(v, 10) || f.sizePx;
        await bakeFont(f);
        markDirty();
      });
      if (!f.builtin) {
        const r = row(card, "");
        r.appendChild(
          btn("Delete", "danger tiny", () => {
            const t = LE.project.theme;
            if (t.fontBodyId === f.id) t.fontBodyId = "f_body";
            if (t.fontTitleId === f.id) t.fontTitleId = "f_title";
            delete LE.project.fonts[f.id];
            markDirty();
            refreshDock();
          })
        );
      }
      list.appendChild(card);
    });

    const add = section(host, "Add Google font");
    const gName = fieldRow(add, "Family", "text", "Roboto", () => {});
    const gSize = fieldRow(add, "Size", "number", 16, () => {});
    const gWeight = fieldRow(add, "Weight", "number", 400, () => {});
    const gr = row(add, "");
    gr.appendChild(
      btn("Add", "primary", async () => {
        const id = S.genId("f");
        const entry = {
          id,
          label: gName.value,
          builtin: false,
          kind: "google",
          googleName: gName.value,
          family: gName.value,
          weight: parseInt(gWeight.value, 10) || 400,
          sizePx: parseInt(gSize.value, 10) || 16,
          cName: "Font_" + id,
        };
        LE.project.fonts[id] = entry;
        await bakeFont(entry);
        markDirty();
        refreshDock();
        toast("Font added");
      })
    );

    const up = section(host, "Upload TTF/OTF");
    const upSize = fieldRow(up, "Size", "number", 16, () => {});
    const ur = row(up, "");
    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".ttf,.otf";
    file.className = "field";
    file.addEventListener("change", async () => {
      if (!file.files || !file.files[0]) return;
      const res = await window.LucarneFonts.loadUpload(file.files[0]);
      const id = S.genId("f");
      const entry = {
        id,
        label: file.files[0].name.replace(/\.[^.]+$/, ""),
        builtin: false,
        kind: "upload",
        family: res.family,
        base64: res.base64,
        _loaded: true,
        weight: 400,
        sizePx: parseInt(upSize.value, 10) || 16,
        cName: "Font_" + id,
      };
      LE.project.fonts[id] = entry;
      await bakeFont(entry);
      markDirty();
      refreshDock();
      toast("Font uploaded");
    });
    ur.appendChild(file);
  }

  /* ---------- Assets pane ---------- */
  function buildAssets() {
    const host = dom.tabAssets;
    if (!host) return;
    host.innerHTML = "";
    buildUiSourceSection(host);

    if (!LE.project.images) LE.project.images = {};
    if (!LE.project.icons) LE.project.icons = {};

    const imgSec = section(host, "Image library");
    const imgHint = document.createElement("div");
    imgHint.className = "hint";
    imgHint.textContent = "Images are shared across all screens. Choose where they live on the device at export time.";
    imgSec.appendChild(imgHint);

    const imgFile = document.createElement("input");
    imgFile.type = "file";
    imgFile.accept = "image/png,image/jpeg,image/webp";
    imgFile.hidden = true;
    const imgAdd = row(imgSec, "");
    imgAdd.appendChild(btn("Import image", "primary tiny", () => imgFile.click()));
    imgSec.appendChild(imgFile);

    imgFile.addEventListener("change", async () => {
      const file = imgFile.files && imgFile.files[0];
      if (!file) return;
      try {
        const data = await window.LucarneAssets.importFile(file);
        const id = S.genId("img");
        LE.project.images[id] = data;
        markDirty();
        refreshDock();
        toast("Image added to library");
      } catch (e) {
        toast("Import failed");
      }
      imgFile.value = "";
    });

    Object.keys(LE.project.images).forEach((id) => {
      const img = LE.project.images[id];
      const card = document.createElement("div");
      card.className = "section";
      card.style.background = "var(--panel)";
      card.style.border = "1px solid var(--edge)";
      card.style.borderRadius = "9px";
      card.style.padding = "8px";
      card.style.marginTop = "8px";
      const title = document.createElement("div");
      title.className = "section-title";
      title.textContent = img.label || id;
      card.appendChild(title);
      const info = document.createElement("div");
      info.className = "hint";
      info.textContent = img.w + "×" + img.h + " px";
      card.appendChild(info);
      fieldRow(card, "Label", "text", img.label || "", (v) => {
        img.label = v;
        markDirty();
      });
      selectRow(
        card,
        "Storage",
        window.LucarneAssets.IMAGE_STORAGE,
        img.storage || "flash",
        (v) => {
          img.storage = v;
          markDirty();
        }
      );
      if (img.storage === "sd") {
        fieldRow(card, "SD path", "text", img.source || "", (v) => {
          img.source = v;
          markDirty();
        });
      } else if (img.storage === "web") {
        fieldRow(card, "URL", "text", img.source || "", (v) => {
          img.source = v;
          markDirty();
        });
      }
      const r = row(card, "");
      r.appendChild(
        btn("Delete", "danger tiny", () => {
          delete LE.project.images[id];
          LE.project.screens.forEach((sc) => {
            sc.widgets.forEach((w) => {
              if (w.type === "image" && w.imageId === id) w.imageId = "";
            });
          });
          markDirty();
          refreshDock();
        })
      );
      imgSec.appendChild(card);
    });

    const icSec = section(host, "Icon library");
    const icHint = document.createElement("div");
    icHint.className = "hint";
    icHint.textContent =
      "Pick an icon to place it on the screen (designer). Saves to library only from blueprint/simulate.";
    icSec.appendChild(icHint);

    const icBrowse = row(icSec, "");
    icBrowse.appendChild(
      btn("Browse icons", "primary tiny", () => {
        window.LucarneIconPicker.open({
          value: "none",
          extras: iconPickerExtras(),
          onSelect: (ref) => pickIconRef(ref, { applyToScreen: true }),
        });
      })
    );

    const icFile = document.createElement("input");
    icFile.type = "file";
    icFile.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
    icFile.hidden = true;
    const icAdd = row(icSec, "");
    icAdd.appendChild(btn("Import icon", "primary tiny", () => icFile.click()));
    icSec.appendChild(icFile);

    icFile.addEventListener("change", async () => {
      const file = icFile.files && icFile.files[0];
      if (!file) return;
      try {
        const data = await window.LucarneAssets.importIcon(file);
        const id = S.genId("ico");
        LE.project.icons[id] = data;
        markDirty();
        refreshDock();
        toast("Icon added to library");
      } catch (e) {
        toast("Import failed");
      }
      icFile.value = "";
    });

    Object.keys(LE.project.icons).forEach((id) => {
      const ic = LE.project.icons[id];
      const card = document.createElement("div");
      card.className = "section";
      card.style.background = "var(--panel)";
      card.style.border = "1px solid var(--edge)";
      card.style.borderRadius = "9px";
      card.style.padding = "8px";
      card.style.marginTop = "8px";
      const cv = document.createElement("canvas");
      cv.width = 32;
      cv.height = 32;
      cv.style.width = "32px";
      cv.style.height = "32px";
      cv.style.imageRendering = "pixelated";
      cv.style.background = "#0a0e14";
      cv.style.borderRadius = "4px";
      cv.style.marginBottom = "6px";
      paintIconCanvas(cv, "c:" + id);
      card.appendChild(cv);
      fieldRow(card, "Label", "text", ic.label || id, (v) => {
        ic.label = v;
        markDirty();
      });
      const r = row(card, "");
      r.appendChild(
        btn("Delete", "danger tiny", () => {
          delete LE.project.icons[id];
          const prefix = "c:" + id;
          LE.project.screens.forEach((sc) => {
            sc.widgets.forEach((w) => {
              if (w.type === "icon" && w.icon === prefix) w.icon = "none";
              if (w.type === "menu") {
                (w.items || []).forEach((it) => {
                  if (it.icon === prefix) it.icon = "none";
                });
              }
            });
          });
          markDirty();
          refreshDock();
        })
      );
      icSec.appendChild(card);
    });
  }

  /* ---------- Data pane ---------- */
  function buildData() {
    const host = dom.tabData;
    host.innerHTML = "";
    const sec = section(
      host,
      "Data keys",
      btn("+ Key", "tiny primary", () => {
        LE.project.keys.push({ name: "key" + LE.project.keys.length, type: "float", value: 0 });
        markDirty();
        refreshDock();
      })
    );
    LE.project.keys.forEach((k, idx) => {
      const card = document.createElement("div");
      card.className = "section";
      card.style.background = "var(--panel)";
      card.style.border = "1px solid var(--edge)";
      card.style.borderRadius = "9px";
      card.style.padding = "8px";
      fieldRow(card, "Name", "text", k.name, (v) => ((k.name = v), markDirty()));
      selectRow(card, "Type", [
        { value: "float", label: "float" },
        { value: "int", label: "int" },
        { value: "bool", label: "bool" },
        { value: "string", label: "string" },
      ], k.type, (v) => {
        k.type = v;
        if (v === "bool") k.value = !!k.value;
        else if (v === "string") k.value = String(k.value || "");
        else k.value = Number(k.value) || 0;
        markDirty();
        refreshDock();
      });
      if (k.type === "bool") {
        const r = row(card, "Value");
        const c = input("checkbox", k.value, (v) => ((k.value = v), markDirty()));
        c.style.flex = "0";
        r.appendChild(c);
      } else {
        fieldRow(card, "Value", k.type === "string" ? "text" : "number", k.value, (v) => {
          k.value = k.type === "string" ? v : Number(v) || 0;
          markDirty();
        });
      }
      const r = row(card, "");
      r.appendChild(
        btn("Remove", "danger tiny", () => {
          LE.project.keys.splice(idx, 1);
          markDirty();
          refreshDock();
        })
      );
      sec.appendChild(card);
    });
  }

  /* ---------------- Toolbar ---------------- */
  function buildDeviceSelect() {
    dom.deviceSel.innerHTML = "";
    Object.keys(S.DEVICES).forEach((id) => {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = S.DEVICES[id].label;
      if (id === LE.project.deviceId) o.selected = true;
      dom.deviceSel.appendChild(o);
    });
  }

  function syncToolbar() {
    dom.projectName.value = LE.project.name || "MyProject";
    buildDeviceSelect();
    const n = LE.nativeDims();
    dom.panelW.value = String(n.w);
    dom.panelH.value = String(n.h);
    dom.rotationSel.value = String(LE.project.rotation || 0);
    if (dom.liveSpeed) dom.liveSpeed.value = S.getLiveSpeedId();
  }

  function rerenderViews() {
    autosave();
    if (mode === "blueprint") graph.render();
    else if (mode === "designer") designer.render();
    else if (mode === "simulate") simulate.render();
  }

  function applyPanelDims(w, h) {
    const pw = parseInt(w, 10);
    const ph = parseInt(h, 10);
    if (pw > 0) LE.project.panelWidth = pw;
    if (ph > 0) LE.project.panelHeight = ph;
    rerenderViews();
    sendLiveSetup();
  }

  function applyRotation(rot) {
    LE.project.rotation = rot;
    rerenderViews();
    sendLiveSetup();
  }

  function wireToolbar() {
    dom.projectName.addEventListener("input", () => {
      LE.project.name = dom.projectName.value;
      autosave();
    });
    dom.deviceSel.addEventListener("change", () => {
      LE.project.deviceId = dom.deviceSel.value;
      const d = S.device(LE.project);
      LE.project.panelWidth = d.w;
      LE.project.panelHeight = d.h;
      syncToolbar();
      rerenderViews();
      sendLiveSetup();
    });
    dom.panelW.addEventListener("change", () => applyPanelDims(dom.panelW.value, dom.panelH.value));
    dom.panelH.addEventListener("change", () => applyPanelDims(dom.panelW.value, dom.panelH.value));
    dom.rotationSel.addEventListener("change", () => {
      applyRotation(parseInt(dom.rotationSel.value, 10) || 0);
    });
    document.querySelectorAll(".modeTab").forEach((b) =>
      b.addEventListener("click", () => setMode(b.dataset.mode))
    );
    document.querySelectorAll(".dockTab").forEach((b) =>
      b.addEventListener("click", () => {
        document.querySelectorAll(".dockTab").forEach((x) => x.classList.toggle("active", x === b));
        ["inspector", "theme", "fonts", "assets", "data"].forEach((t) => {
          $("tab-" + t).hidden = t !== b.dataset.tab;
        });
      })
    );

    $("btnLive").addEventListener("click", toggleLive);
    if (dom.liveSpeed) {
      dom.liveSpeed.addEventListener("change", () => {
        S.setLiveSpeedId(dom.liveSpeed.value);
        if (LE.live && LE.live.setBaudRate) LE.live.setBaudRate(S.getLiveBaud());
        toast("Speed: " + (S.liveSpeedById(dom.liveSpeed.value) || {}).label + " — reconnect Live");
      });
    }
    $("btnExport").addEventListener("click", openExport);
    $("btnSave").addEventListener("click", saveProject);
    $("btnLoad").addEventListener("click", () => dom.fileLoad.click());
    dom.fileLoad.addEventListener("change", loadProject);
    $("btnNew").addEventListener("click", newProject);

    $("modalClose").addEventListener("click", closeExport);
    $("modalCopy").addEventListener("click", copyExport);
    $("modalDownload").addEventListener("click", downloadExport);
    dom.modal.addEventListener("click", (ev) => {
      if (ev.target === dom.modal) closeExport();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !dom.modal.hidden) closeExport();
    });
  }

  /* ---------------- Export modal ---------------- */
  let exportFiles = [];
  let exportIndex = 0;

  function openExport() {
    (async () => {
      try {
        if (window.LucarneIconPacks) await window.LucarneIconPacks.preloadProject(LE.project);
        if (window.LucarneTabler) await window.LucarneTabler.preloadProject(LE.project);
        exportFiles = window.LucarneExport.buildAll(LE);
      } catch (e) {
        exportFiles = [{ name: "Error", content: "Export error:\n" + (e && e.stack ? e.stack : e) }];
      }
      exportIndex = 0;
      dom.modalFiles.innerHTML = "";
      exportFiles.forEach((f, i) => {
        const b = document.createElement("button");
        b.className = "modal-file" + (i === 0 ? " active" : "");
        b.textContent = f.name;
        b.addEventListener("click", () => {
          exportIndex = i;
          dom.modalText.value = exportFiles[i].content;
          dom.modalFiles.querySelectorAll(".modal-file").forEach((x, j) =>
            x.classList.toggle("active", j === i)
          );
        });
        dom.modalFiles.appendChild(b);
      });
      dom.modalText.value = exportFiles[0].content;
      dom.modal.hidden = false;
    })();
  }

  function closeExport() {
    dom.modal.hidden = true;
  }

  function copyExport() {
    navigator.clipboard.writeText(exportFiles[exportIndex].content).then(() => toast("Copied"));
  }

  function downloadExport() {
    const f = exportFiles[exportIndex];
    const blob = new Blob([f.content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------------- Save / Load / New ---------------- */
  function saveProject() {
    const clone = JSON.parse(JSON.stringify(LE.project));
    if (LE.project.images) {
      clone.images = {};
      Object.keys(LE.project.images).forEach((id) => {
        const img = LE.project.images[id];
        if (img && img.pixels) clone.images[id] = window.LucarneAssets.serialize(img);
        else clone.images[id] = img;
      });
    }
    if (LE.project.icons) {
      clone.icons = {};
      Object.keys(LE.project.icons).forEach((id) => {
        clone.icons[id] = window.LucarneAssets.serializeIcon(LE.project.icons[id]);
      });
    }
    Object.values(clone.fonts).forEach((f) => {
      delete f._atlas;
      delete f._loaded;
    });
    const blob = new Blob([JSON.stringify(clone, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (LE.project.name || "project") + ".lucarne.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Project saved");
  }

  function loadProject(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const obj = JSON.parse(reader.result);
        applyProject(obj);
        toast("Project loaded");
      } catch (e) {
        toast("Invalid file");
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  }

  async function applyProject(obj) {
    LE.project = S.hydrate(obj);
    project = LE.project;
    if (!LE.project.fonts || !LE.project.fonts.f_body) LE.project.fonts = S.defaultFonts();
    if (!LE.project.images) LE.project.images = {};
    if (!LE.project.icons) LE.project.icons = {};
    if (!LE.project.panelWidth || !LE.project.panelHeight) {
      const d = S.device(LE.project);
      LE.project.panelWidth = d.w;
      LE.project.panelHeight = d.h;
    }
    LE.graphSel = null;
    LE.selection = {};
    syncToolbar();
    await ensureFonts();
    setMode("blueprint");
    refreshDock();
    autosave();
    preloadIcons();
  }

  async function loadFromUrl() {
    const src = LE.project.uiSource || S.defaultUiSource();
    const url = (src.url || "").trim();
    if (!url) {
      toast("Set URL in Inspector → UI source");
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const obj = await res.json();
      await applyProject(obj);
      toast("Loaded from URL");
    } catch (e) {
      toast("URL: " + (e && e.message ? e.message : "load failed"));
    }
  }

  async function loadFromSd() {
    if (!LE.live || !LE.live.isConnected()) {
      toast("Connect Live first");
      return;
    }
    const src = LE.project.uiSource || S.defaultUiSource();
    const path = (src.sdPath || "/ui.lucarne.json").trim();
    if (!path) {
      toast("Set SD path in Inspector → UI source");
      return;
    }
    try {
      const obj = await LE.live.loadFromSd(path);
      await applyProject(obj);
      toast("Loaded from SD");
    } catch (e) {
      toast("SD: " + (e && e.message ? e.message : "load failed"));
    }
  }

  function newProject() {
    applyProject(S.defaultProject());
  }

  /* ---------------- Boot ---------------- */
  function updateLiveBtn(on) {
    const b = $("btnLive");
    if (!b) return;
    b.classList.toggle("on", on);
    b.textContent = on ? "Live \u25CF" : "Live";
  }

  async function toggleLive() {
    if (!LE.live) return;
    if (LE.live.isConnected()) {
      await LE.live.disconnect();
    } else {
      try {
        if (LE.live.setBaudRate) LE.live.setBaudRate(S.getLiveBaud());
        await LE.live.connect();
        await sendLiveSetup();
        toast("Live connected");
      } catch (e) {
        toast("Live: " + (e && e.message ? e.message : "connection failed"));
      }
    }
  }

  function boot() {
    graph = window.LucarneGraph.init(dom.graphHost, LE);
    designer = window.LucarneDesigner.init(dom.designerHost, LE);
    simulate = window.LucarneSimulate.init(dom.simHost, LE);
    LE.live = window.LucarneLive.init({ onState: updateLiveBtn, baudRate: S.getLiveBaud() });
    LE.graph = graph;
    LE.designer = designer;
    LE.simulate = simulate;

    syncToolbar();
    wireToolbar();
    refreshDock();
    setMode("blueprint");
    ensureFonts();
    preloadIcons();
  }

  boot();
})();
