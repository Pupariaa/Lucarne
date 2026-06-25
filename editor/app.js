(function () {
  "use strict";

  const R = window.LucarneRender;
  const S = window.LucarneState;

  const $ = (id) => document.getElementById(id);

  const dom = {
    projectName: $("projectName"),
    deviceSel: $("deviceSel"),
    rotationSel: $("rotationSel"),
    graphHost: $("graphHost"),
    designerHost: $("designerHost"),
    simHost: $("simHost"),
    dockBody: $("dockBody"),
    tabInspector: $("tab-inspector"),
    tabTheme: $("tab-theme"),
    tabFonts: $("tab-fonts"),
    tabData: $("tab-data"),
    modal: $("modal"),
    modalText: $("modalText"),
    modalFiles: $("modalFiles"),
    toast: $("toast"),
    fileLoad: $("fileLoad"),
  };

  let project = S.load() || S.defaultProject();
  let mode = "blueprint";

  const LE = {
    project,
    graphSel: null,
    selection: {},
    designerScreen: null,
    genId: S.genId,
    device: () => S.device(LE.project),
    dims: () => S.dims(LE.project),
    getScreen: (id) => S.getScreen(LE.project, id),
    iconNames: S.iconNames,
    toast,
    autosave: () => S.save(LE.project),
    fontAtlas: (id) => {
      const f = LE.project.fonts[id];
      return f && f._atlas ? f._atlas : null;
    },
    renderTheme: () => {
      const t = LE.project.theme;
      return R.themeTo565(t, LE.fontAtlas(t.fontBodyId), LE.fontAtlas(t.fontTitleId));
    },
    env: (screen, selMap) => ({
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
    const d = LE.live.deviceDims() || LE.dims();
    const disp = new R.Display(d.w, d.h);
    R.drawScreen(disp, s, LE.renderTheme(), LE.env(s, {}));
    LE.live.sendDisplay(disp);
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

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Double-click a screen to design it. Drag an item pin onto a screen to link.";
    host.appendChild(hint);
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
    const r = row(sec, "");
    r.appendChild(
      btn("Remove link", "danger", () => {
        it.target = "";
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
      selectRow(sec, "Icon", LE.iconNames().map((n) => ({ value: n, label: n })), w.icon, (v) => ((w.icon = v), markDirty()));
      fieldRow(sec, "Scale", "number", w.scale || 1, (v) => ((w.scale = parseInt(v, 10) || 1), markDirty()));
      colorRow(sec, "Color", w.color, true, (v) => ((w.color = v), markDirty()));
    } else if (w.type === "menu") {
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
        menu.items.push({ id: S.genId("it"), label: "Item", icon: "none", target: "", transition: "Inherit" });
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
      selectRow(card, "Icon", LE.iconNames().map((n) => ({ value: n, label: n })), it.icon || "none", (v) => ((it.icon = v), markDirty()));
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
    dom.rotationSel.value = String(LE.project.rotation || 0);
  }

  function wireToolbar() {
    dom.projectName.addEventListener("input", () => {
      LE.project.name = dom.projectName.value;
      autosave();
    });
    dom.deviceSel.addEventListener("change", () => {
      LE.project.deviceId = dom.deviceSel.value;
      markDirty();
    });
    dom.rotationSel.addEventListener("change", () => {
      LE.project.rotation = parseInt(dom.rotationSel.value, 10) || 0;
      markDirty();
    });
    document.querySelectorAll(".modeTab").forEach((b) =>
      b.addEventListener("click", () => setMode(b.dataset.mode))
    );
    document.querySelectorAll(".dockTab").forEach((b) =>
      b.addEventListener("click", () => {
        document.querySelectorAll(".dockTab").forEach((x) => x.classList.toggle("active", x === b));
        ["inspector", "theme", "fonts", "data"].forEach((t) => {
          $("tab-" + t).hidden = t !== b.dataset.tab;
        });
      })
    );

    $("btnLive").addEventListener("click", toggleLive);
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
    try {
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
    LE.project = obj;
    project = obj;
    if (!LE.project.fonts || !LE.project.fonts.f_body) LE.project.fonts = S.defaultFonts();
    LE.graphSel = null;
    LE.selection = {};
    syncToolbar();
    await ensureFonts();
    setMode("blueprint");
    refreshDock();
    autosave();
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
        await LE.live.connect();
        pushLive();
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
    LE.live = window.LucarneLive.init({ onState: updateLiveBtn });
    LE.graph = graph;
    LE.designer = designer;
    LE.simulate = simulate;

    syncToolbar();
    wireToolbar();
    refreshDock();
    setMode("blueprint");
    ensureFonts();
  }

  boot();
})();
