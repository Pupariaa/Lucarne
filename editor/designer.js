(function () {

  "use strict";



  const R = window.LucarneRender;

  const ANIM_INTERVAL_MS = 1000 / 12;



  function el(tag, cls, parent) {

    const e = document.createElement(tag);

    if (cls) e.className = cls;

    if (parent) parent.appendChild(e);

    return e;

  }



  const PALETTE_GROUPS = [
    {
      id: "text",
      label: "Text",
      items: [
        { type: "label", label: "Label" },
        { type: "metric", label: "Metric" },
        { type: "list", label: "List" },
      ],
    },
    {
      id: "graphs",
      label: "Charts",
      items: [
        { type: "graph", graphType: "line", mode: "stream", label: "Line graph" },
        { type: "graph", graphType: "bar", mode: "stream", label: "Bar graph" },
        { type: "graph", graphType: "area", mode: "stream", label: "Area graph" },
        { type: "graph", graphType: "sparkline", mode: "stream", label: "Sparkline" },
        { type: "graph", graphType: "line", mode: "keys", label: "Multi-key chart" },
        { type: "chart", label: "Chart (legacy)" },
        { type: "gauge", label: "Gauge" },
        { type: "bar", label: "Progress bar" },
      ],
    },
    {
      id: "input",
      label: "Input",
      items: [
        { type: "button", label: "Button" },
        { type: "switch", label: "Switch" },
        { type: "slider", label: "Slider" },
        { type: "shape", shape: "rect", label: "Rectangle" },
        { type: "shape", shape: "circle", label: "Circle" },
        { type: "shape", shape: "triangle", label: "Triangle" },
        { type: "textfield", label: "Text input", inputKind: "text" },
        { type: "textfield", label: "Numeric input", inputKind: "numeric" },
        { type: "textfield", label: "Integer input", inputKind: "integer" },
        { type: "textfield", label: "Hex input", inputKind: "hex" },
        { type: "textfield", label: "Password input", inputKind: "password" },
        { type: "keyboard", label: "Keyboard" },
      ],
    },
    {
      id: "nav",
      label: "Navigation",
      items: [{ type: "menu", label: "Menu" }],
    },
    {
      id: "media",
      label: "Media",
      items: [
        { type: "icon", label: "Icon" },
        { type: "image", label: "Image" },
        { type: "dynamicimage", label: "Dynamic image" },
      ],
    },
    {
      id: "system",
      label: "System",
      items: [
        { type: "battery", label: "Battery" },
        { type: "clock", label: "Clock" },
        { type: "date", label: "Date" },
        { type: "status", label: "Status" },
      ],
    },
  ];



  function init(host, LE) {

    host.innerHTML = "";

    const root = el("div", "designer", host);



    const bar = el("div", "designer-bar", root);

    const UI = window.LucarneUiIcons;

    const back = el("button", "btn designer-back", bar);

    back.type = "button";

    back.title = "Back to Blueprint";

    back.innerHTML = (UI ? UI.svg("chevronLeft", { size: 14 }) : "") + '<span class="bar-label">Blueprint</span>';

    back.setAttribute("aria-label", "Back to Blueprint");

    const nameInput = el("input", "field designer-name", bar);

    nameInput.setAttribute("aria-label", "Screen name");

    nameInput.placeholder = "Screen name";

    const togglePaletteBtn = el("button", "btn panel-collapse", bar);

    togglePaletteBtn.type = "button";

    togglePaletteBtn.title = "Toggle widgets panel";

    togglePaletteBtn.setAttribute("aria-label", "Toggle widgets panel");

    togglePaletteBtn.innerHTML = UI ? UI.svg("chevronLeft", { size: 14 }) : "&lt;";

    const toggleLayersBtn = el("button", "btn panel-collapse", bar);

    toggleLayersBtn.type = "button";

    toggleLayersBtn.title = "Toggle layers panel";

    toggleLayersBtn.setAttribute("aria-label", "Toggle layers panel");

    toggleLayersBtn.innerHTML = UI ? UI.svg("chevronRight", { size: 14 }) : "&gt;";

    const deselectBtn = el("button", "btn", bar);

    deselectBtn.type = "button";

    deselectBtn.textContent = "Deselect";

    deselectBtn.hidden = true;

    el("div", "bar-spacer", bar);

    const startBtn = el("button", "btn", bar);

    startBtn.type = "button";



    const body = el("div", "designer-body", root);

    const palette = el("div", "palette", body);

    const paletteSearch = document.createElement("input");
    paletteSearch.type = "search";
    paletteSearch.className = "field palette-search";
    paletteSearch.placeholder = "Search widgets\u2026";
    paletteSearch.setAttribute("aria-label", "Search widgets");
    palette.appendChild(paletteSearch);

    const paletteGroupEls = [];
    PALETTE_GROUPS.forEach((group) => {
      const groupEl = el("div", "palette-group", palette);
      const title = el("div", "palette-group-title", groupEl);
      title.textContent = group.label;
      const box = el("div", "palette-group-items", groupEl);
      const itemEls = [];
      group.items.forEach((p) => {
        const item = el("button", "palette-item", box);
        item.type = "button";
        item.textContent = p.label;
        item.title = "Add " + p.label.toLowerCase() + " to this screen";
        item.addEventListener("click", () => {
          addWidget(p.type, p);
          if (isOverlayMode()) paletteResizeCtl.collapse();
        });
        itemEls.push({ el: item, label: p.label.toLowerCase() });
      });
      paletteGroupEls.push({ el: groupEl, items: itemEls });
    });

    function filterPalette() {
      const q = paletteSearch.value.trim().toLowerCase();
      paletteGroupEls.forEach((g) => {
        let visible = 0;
        g.items.forEach((it) => {
          const show = !q || it.label.indexOf(q) >= 0;
          it.el.style.display = show ? "" : "none";
          if (show) visible++;
        });
        g.el.classList.toggle("filtered-empty", visible === 0);
      });
    }
    paletteSearch.addEventListener("input", filterPalette);



    const tplTitle = el("div", "layers-title palette-tpl-title", palette);

    tplTitle.textContent = "Template";

    const tplSel = document.createElement("select");

    tplSel.className = "select palette-tpl-select";

    tplSel.setAttribute("aria-label", "Screen template");

    if (window.LucarneTemplates) {

      window.LucarneTemplates.list().forEach((p) => {

        const o = document.createElement("option");

        o.value = p.id;

        o.textContent = p.label;

        tplSel.appendChild(o);

      });

    }

    palette.appendChild(tplSel);

    const tplBtn = el("button", "btn palette-tpl-btn", palette);

    tplBtn.type = "button";

    tplBtn.textContent = "Insert template";

    tplBtn.addEventListener("click", () => {

      if (!window.LucarneTemplates) return;

      const s = currentScreen();

      if (!s) return;

      window.LucarneTemplates.apply(tplSel.value, s, LE.dims(), LE.genId, LE.project);

      LE.markDirty("Insert template");

      LE.refreshInspector();

      render();

    });



    const center = el("div", "designer-center", body);

    const wrap = el("div", "canvas-wrap", center);

    const device = el("div", "device", wrap);

    const stack = el("div", "screen-stack", device);

    const canvas = el("canvas", "", stack);

    canvas.id = "designerCanvas";

    const overlay = el("div", "overlay", stack);

    const ctx2d = canvas.getContext("2d");



    const paletteResizer = el("div", "resizer", null);

    body.insertBefore(paletteResizer, palette.nextSibling);

    const layersCol = el("div", "layers-panel", body);

    const layersResizer = el("div", "resizer", null);

    body.insertBefore(layersResizer, layersCol);

    const layersTitle = el("div", "layers-title", layersCol);

    layersTitle.textContent = "Layers";

    layersTitle.id = "designerLayersTitle";

    const layers = el("div", "layers-list", layersCol);

    layers.setAttribute("role", "listbox");

    layers.setAttribute("aria-labelledby", "designerLayersTitle");

    function loadPanelPref(key, fallback) {
      try {
        const raw = localStorage.getItem("lucarne_panel_" + key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    }

    function savePanelPref(key, val) {
      try {
        localStorage.setItem("lucarne_panel_" + key, JSON.stringify(val));
      } catch (e) {}
    }

    const overlayMq = window.matchMedia("(max-width: 1024px)");
    const MIN_CANVAS_W = 360;

    function isOverlayMode() {
      return overlayMq.matches;
    }

    const panelCtls = [];

    function setupResizer(panelEl, resizerEl, toggleBtn, storageKey, opts) {
      opts = opts || {};
      const min = opts.min || 120;
      const max = opts.max || 420;
      const sign = opts.sign || 1;
      const pref = loadPanelPref(storageKey, { width: opts.defaultWidth || 200, collapsed: false });
      let width = Math.max(min, Math.min(max, pref.width || opts.defaultWidth || 200));
      let userCollapsed = !!pref.collapsed;
      function othersRaw() {
        return panelCtls
          .filter((c) => c.panel !== panelEl && !c.isCollapsed())
          .reduce((sum, c) => sum + c.rawWidth(), 0);
      }
      function limit() {
        if (isOverlayMode()) return Math.min(max, Math.max(min, Math.round(body.clientWidth * 0.8)));
        const avail = body.clientWidth - othersRaw() - MIN_CANVAS_W - 12;
        return Math.max(min, Math.min(max, avail));
      }
      function effective() {
        return Math.max(min, Math.min(width, limit()));
      }
      function apply() {
        panelEl.style.setProperty(opts.cssVar, effective() + "px");
      }
      function setCollapsed(on) {
        panelEl.classList.toggle("collapsed", on);
        panelEl.inert = on;
        if (toggleBtn) {
          toggleBtn.setAttribute("aria-expanded", String(!on));
          toggleBtn.classList.toggle("on", !on);
        }
      }
      function persist() {
        savePanelPref(storageKey, { width, collapsed: userCollapsed });
      }
      function syncMode() {
        setCollapsed(isOverlayMode() ? true : userCollapsed);
        apply();
      }
      resizerEl.addEventListener("pointerdown", (ev) => {
        if (panelEl.classList.contains("collapsed") || isOverlayMode()) return;
        ev.preventDefault();
        resizerEl.classList.add("active");
        const sx = ev.clientX;
        const startW = effective();
        function move(e) {
          width = Math.max(min, Math.min(limit(), startW + sign * (e.clientX - sx)));
          apply();
          if (autoFitZoom) render();
        }
        function up() {
          resizerEl.classList.remove("active");
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
          persist();
          if (autoFitZoom) applyFitZoom();
          render();
          if (LE.fitDock) LE.fitDock();
        }
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      });
      const ctl = {
        panel: panelEl,
        rawWidth: () => width,
        width: () => (panelEl.classList.contains("collapsed") ? 0 : effective()),
        apply,
        syncMode,
        toggle() {
          const willOpen = panelEl.classList.contains("collapsed");
          if (isOverlayMode()) {
            if (willOpen) panelCtls.forEach((c) => c !== ctl && c.collapse());
            setCollapsed(!willOpen);
          } else {
            userCollapsed = !willOpen;
            setCollapsed(userCollapsed);
            persist();
          }
          panelCtls.forEach((c) => c.apply());
          if (autoFitZoom) applyFitZoom();
          render();
          if (LE.fitDock) LE.fitDock();
        },
        collapse() {
          if (panelEl.classList.contains("collapsed")) return;
          setCollapsed(true);
          if (!isOverlayMode()) {
            userCollapsed = true;
            persist();
          }
        },
        isCollapsed() {
          return panelEl.classList.contains("collapsed");
        },
      };
      panelCtls.push(ctl);
      return ctl;
    }

    function syncPanelsLayout() {
      panelCtls.forEach((c) => c.syncMode());
      panelCtls.forEach((c) => c.apply());
      if (autoFitZoom) applyFitZoom();
      render();
    }

    function sidePanelsWidth() {
      if (isOverlayMode()) return 0;
      return panelCtls.reduce((sum, c) => sum + c.width(), 0);
    }



    const paletteResizeCtl = setupResizer(palette, paletteResizer, togglePaletteBtn, "designer_palette", {
      min: 140,
      max: 320,
      defaultWidth: 168,
      sign: 1,
      cssVar: "--palette-w",
    });

    const layersResizeCtl = setupResizer(layersCol, layersResizer, toggleLayersBtn, "designer_layers", {
      min: 160,
      max: 360,
      defaultWidth: 210,
      sign: -1,
      cssVar: "--layers-w",
    });

    togglePaletteBtn.addEventListener("click", () => paletteResizeCtl.toggle());

    toggleLayersBtn.addEventListener("click", () => layersResizeCtl.toggle());

    overlayMq.addEventListener("change", syncPanelsLayout);

    window.addEventListener("resize", () => {
      panelCtls.forEach((c) => c.apply());
    });

    const controls = el("div", "preview-controls", center);

    controls.setAttribute("role", "toolbar");

    controls.setAttribute("aria-label", "Canvas view options");

    function pcToggle(label, checked) {
      const chip = el("label", "pc-chip clickable", controls);
      const track = el("label", "toggle pc-toggle", chip);
      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.checked = !!checked;
      track.appendChild(inp);
      track.appendChild(el("span", "toggle-track"));
      chip.appendChild(document.createTextNode(label));
      return inp;
    }

    const realInput = pcToggle("Realistic 1:1", false);

    const calibBtn = el("button", "btn tiny pc-calib", controls);
    calibBtn.type = "button";
    calibBtn.textContent = "Calibrate";
    calibBtn.title = "Match a real object against the screen so \u201cRealistic 1:1\u201d reflects your actual monitor";
    calibBtn.hidden = true;
    calibBtn.addEventListener("click", () => {
      if (window.LucarneScreenCalibration) {
        window.LucarneScreenCalibration.openCalibrator({
          onSave: () => render(),
        });
      }
    });

    const gridChk = el("label", "pc-chip", controls);

    const gridSel = document.createElement("select");

    gridSel.className = "select";

    gridSel.title = "Grid spacing";

    gridSel.setAttribute("aria-label", "Grid spacing");

    [{ v: "0", l: "No grid" }, { v: "1", l: "1 px" }, { v: "4", l: "4 px" }, { v: "8", l: "8 px" }, { v: "16", l: "16 px" }].forEach((o) => {

      const opt = document.createElement("option");

      opt.value = o.v;

      opt.textContent = o.l;

      gridSel.appendChild(opt);

    });

    gridChk.appendChild(gridSel);

    gridSel.value = "8";

    const snapInput = pcToggle("Snap", true);

    const zoomInput = document.createElement("input");

    zoomInput.type = "range";

    zoomInput.min = "0.05";

    zoomInput.max = "4";

    zoomInput.step = "0.05";

    zoomInput.value = "1";

    zoomInput.className = "pc-zoom";

    zoomInput.setAttribute("aria-label", "Zoom");

    controls.appendChild(zoomInput);

    const fitBtn = el("button", "btn tiny", controls);

    fitBtn.type = "button";

    fitBtn.textContent = "Fit";

    fitBtn.title = "Fit canvas to view";

    const zoomLbl = el("span", "muted pc-zoom-label", controls);



    let realistic = false;

    let gridStep = 8;

    let snapGrid = true;

    const CB = window.LucarneClipboard;

    let autoFitZoom = true;

    let canvasW = 0;

    let canvasH = 0;

    let layersKey = "";

    let handleMap = new Map();

    let dragging = false;

    let dragPaintRaf = null;

    let lastAnimPaint = 0;



    function ppi() {

      const dev = LE.device();

      const diag = Math.sqrt(dev.w * dev.w + dev.h * dev.h);

      return diag / dev.inch;

    }



    function fitScale() {

      const d = LE.dims();

      const pad = 56;

      const availW = Math.max(64, wrap.clientWidth - pad);

      const availH = Math.max(64, wrap.clientHeight - pad);

      let s = Math.min(availW / d.w, availH / d.h);

      if (!isFinite(s) || s <= 0) s = 1;

      s = Math.max(0.05, Math.min(4, s));

      return Math.round(s * 100) / 100;

    }



    function applyFitZoom() {

      autoFitZoom = true;

      zoomInput.value = String(fitScale());

    }



    function computeScale() {

      const d = LE.dims();

      if (realistic) {

        const SC = window.LucarneScreenCalibration;

        const pxPerInch = SC ? SC.get() : 96;

        return Math.max(0.05, pxPerInch / ppi());

      }

      if (autoFitZoom) {

        return fitScale();

      }

      return parseFloat(zoomInput.value) || 1;

    }



    function currentScreen() {

      return LE.getScreen(LE.designerScreen);

    }



    function paintCanvas() {

      const s = currentScreen();

      if (!s) return;

      const d = LE.dims();

      if (canvas.width !== d.w || canvas.height !== d.h) {

        canvas.width = d.w;

        canvas.height = d.h;

        canvasW = d.w;

        canvasH = d.h;

      }

      const disp = LE.getSharedDisplay ? LE.getSharedDisplay(d.w, d.h) : new R.Display(d.w, d.h);

      R.drawScreen(disp, s, LE.renderTheme(LE.designerScreen), LE.env(s));

      R.blitDisplayToCanvas(disp, ctx2d, LE.project);

    }



    function snapCoord(v) {

      if (!snapGrid || gridStep < 2) return Math.round(v);

      return Math.round(v / gridStep) * gridStep;

    }



    function syncCanvasLayout(scale) {

      const d = LE.dims();

      canvas.style.width = d.w * scale + "px";

      canvas.style.height = d.h * scale + "px";

      canvas.style.imageRendering = scale >= 1 ? "pixelated" : "auto";

      overlay.style.width = d.w * scale + "px";

      overlay.style.height = d.h * scale + "px";

      const layers = [];

      if (gridStep >= 1) {

        const minor = "rgba(94,150,255,0.22)";

        const major = "rgba(94,150,255,0.42)";

        const stepPx = (gridStep >= 2 ? gridStep : 1) * scale;

        const majorPx = stepPx * 4;

        layers.push(

          "repeating-linear-gradient(0deg, " + minor + " 0 1px, transparent 1px " + stepPx + "px)",

          "repeating-linear-gradient(90deg, " + minor + " 0 1px, transparent 1px " + stepPx + "px)",

          "repeating-linear-gradient(0deg, " + major + " 0 1px, transparent 1px " + majorPx + "px)",

          "repeating-linear-gradient(90deg, " + major + " 0 1px, transparent 1px " + majorPx + "px)"

        );

      }

      const cx = (d.w * scale) / 2;

      const cy = (d.h * scale) / 2;

      const center = "rgba(246,183,55,0.75)";

      layers.push(

        "linear-gradient(90deg, transparent " + (cx - 1) + "px, " + center + " " + cx + "px, transparent " + (cx + 1) + "px)",

        "linear-gradient(0deg, transparent " + (cy - 1) + "px, " + center + " " + cy + "px, transparent " + (cy + 1) + "px)"

      );

      overlay.style.backgroundImage = layers.join(",");

    }



    function syncChrome(scale) {

      const s = currentScreen();

      if (!s) return;

      zoomLbl.textContent = realistic ? "~" + ppi().toFixed(0) + " PPI" : (scale < 1 ? scale.toFixed(2) : String(Math.round(scale * 100) / 100)) + "x";

      nameInput.value = s.name || "";

      startBtn.textContent = LE.project.startScreen === s.id ? "Start screen" : "Set as start";

      startBtn.classList.toggle("primary", LE.project.startScreen === s.id);

      deselectBtn.hidden = !(LE.selection && LE.selection.widgetId);

    }



    function render(opts) {

      opts = opts || {};

      const s = currentScreen();

      if (!s) return;

      const scale = computeScale();

      syncChrome(scale);

      syncCanvasLayout(scale);

      paintCanvas();

      if (!opts.skipOverlay) {

        buildHandles(s, scale);

        buildLayers(s);

      }

    }



    function scheduleDragPaint(scale) {

      if (dragPaintRaf) return;

      dragPaintRaf = requestAnimationFrame(() => {

        dragPaintRaf = null;

        paintCanvas();

        updateHandlePositions(safeScreen(), scale);

      });

    }



    function safeScreen() {

      return currentScreen() || { widgets: [] };

    }



    function buildHandles(s, scale) {

      overlay.innerHTML = "";

      handleMap.clear();

      s.widgets.forEach((w) => {

        const bw = w.w && w.w > 0 ? w.w : measureW(w);

        const bh = w.h && w.h > 0 ? w.h : measureH(w);

        const h = el("div", "handle", overlay);

        h.dataset.wid = w.id;

        positionHandle(h, w, bw, bh, scale);

        const selected = LE.selection && LE.selection.widgetId === w.id;

        if (!selected) h.classList.add("unselected");

        if (selected) {

          const tag = el("div", "tag", h);

          tag.textContent = w.type;

          const grip = el("div", "grip", h);

          grip.addEventListener("pointerdown", (ev) => startResize(ev, w, scale));

          const d = LE.dims();

          if (bw >= d.w - 2 && bh >= d.h - 2) h.classList.add("fullscreen");

        }

        h.addEventListener("pointerdown", (ev) => {

          if (ev.target.classList.contains("grip")) return;

          ev.stopPropagation();

          startMove(ev, w, scale);

        });

        handleMap.set(w.id, h);

      });

    }



    function positionHandle(h, w, bw, bh, scale) {

      h.style.left = w.x * scale + "px";

      h.style.top = w.y * scale + "px";

      h.style.width = bw * scale + "px";

      h.style.height = bh * scale + "px";

    }



    function updateHandlePositions(s, scale) {

      s.widgets.forEach((w) => {

        const h = handleMap.get(w.id);

        if (!h) return;

        const bw = w.w && w.w > 0 ? w.w : measureW(w);

        const bh = w.h && w.h > 0 ? w.h : measureH(w);

        positionHandle(h, w, bw, bh, scale);

      });

    }



    function ensureProjectKey(name, type, value) {
      if (!name || !LE.project.keys) return;
      if (!LE.project.keys.find((k) => k.name === name)) {
        LE.project.keys.push({ name, type, value });
      }
    }

    function addWidget(type, spec) {

      spec = spec || {};

      const d = LE.dims();

      const s = currentScreen();

      if (!s) return;

      const id = LE.genId("w");

      let w;

      if (type === "label")

        w = { id, type, x: 20, y: 20, w: 120, h: 24, text: "Label", textStyle: { fontId: "body", align: "left" } };

      else if (type === "metric")

        w = { id, type, x: 14, y: 24, w: Math.min(212, d.w - 16), h: 34, label: "Label", key: "", unit: "", decimals: 1 };

      else if (type === "bar")

        w = { id, type, x: 14, y: 24, w: Math.min(212, d.w - 16), h: 18, key: "", min: 0, max: 1, showValue: true };

      else if (type === "icon")

        w = { id, type, x: 20, y: 20, w: 32, h: 32, icon: "chart", scale: 1 };

      else if (type === "image")

        w = { id, type, x: 0, y: 0, w: d.w, h: d.h, imageId: "" };

      else if (type === "menu")

        w = { id, type, x: 12, y: 24, w: d.w - 24, h: d.h - 48, iconScale: 1, badgeScale: 1, items: [] };

      else if (type === "button")

        w = { id, type, x: 14, y: d.h - 44, w: d.w - 28, h: 32, label: "Button", icon: "none", action: "navigate", target: "", transition: "Inherit", callbackId: "" };

      else if (type === "shape") {

        const kind = (spec && spec.shape) || "rect";

        const side = kind === "triangle" ? 72 : 80;

        w = {

          id,

          type,

          shape: kind,

          x: Math.trunc((d.w - side) / 2),

          y: Math.trunc((d.h - side) / 2),

          w: side,

          h: side,

          fill: "#334155",

          stroke: "#475569",

          strokeWidth: 2,

          activeFill: "#2563EB",

          activeStroke: "#1d4ed8",

          activeText: "#ffffff",

          group: "menu",

          label: "",

          action: "navigate",

          target: "",

          transition: "Inherit",

          callbackId: "",

        };

      }

      else if (type === "switch")

        w = { id, type, x: 14, y: 40, w: d.w - 28, h: 28, label: "Switch", key: "" };

      else if (type === "slider")

        w = { id, type, x: 14, y: 80, w: d.w - 28, h: 32, key: "", min: 0, max: 100 };

      else if (type === "chart")

        w = { id, type, x: 14, y: 72, w: d.w - 28, h: 56, keys: ["", ""], min: 0, max: 100 };

      else if (type === "graph") {

        const gType = (spec && spec.graphType) || "line";

        const mode = (spec && spec.mode) || "stream";

        const h = gType === "sparkline" ? 28 : 56;

        w = {

          id,

          type: "graph",

          graphType: gType,

          mode,

          key: mode === "stream" ? "sensor" : undefined,

          keys: mode === "keys" ? ["", ""] : undefined,

          capacity: 32,

          min: 0,

          max: 100,

          color: "#2563EB",

          grid: gType !== "sparkline",

          x: 14,

          y: 72,

          w: d.w - 28,

          h,

          samples: [18, 22, 20, 28, 35, 32, 38, 42, 40, 45, 48, 52, 50, 55, 58, 60],

        };

      }

      else if (type === "gauge")

        w = { id, type, x: 14, y: 12, w: Math.min(80, d.w - 28), h: 72, label: "Gauge", key: "", min: 0, max: 100, decimals: 1 };

      else if (type === "list")

        w = { id, type, x: 14, y: 120, w: d.w - 28, h: Math.min(100, d.h - 128), items: [] };

      else if (type === "battery")

        w = { id, type, x: d.w - 52, y: 6, w: 44, h: 18, key: "battery", showPercent: false, chargingKey: "charging", lowThreshold: 20 };

      else if (type === "clock")

        w = { id, type, x: 8, y: 4, w: 72, h: 20, hourKey: "hour", minuteKey: "minute", secondKey: "", format: "hm", textStyle: { fontId: "title" } };

      else if (type === "date")

        w = { id, type, x: 8, y: 24, w: 100, h: 18, dayKey: "day", monthKey: "month", yearKey: "year", format: "dmy", textStyle: { fontId: "body" } };

      else if (type === "status")

        w = { id, type, x: d.w - 80, y: 4, w: 72, h: 18, wifiKey: "wifi", rssiKey: "rssi", bluetoothKey: "bt" };

      else if (type === "dynamicimage")

        w = { id, type, x: 0, y: 0, w: d.w, h: d.h, pathKey: "img_path", storage: "sd", imgW: 0, imgH: 0 };

      else if (type === "textfield") {

        const KB = window.LucarneKeyboard;

        const inputKind = KB ? KB.normalizeInputKind(spec.inputKind || "text") : spec.inputKind || "text";

        const labels = { text: "Text", numeric: "Value", integer: "Count", hex: "Hex", password: "Password" };

        const placeholders = {
          text: "Enter text",
          numeric: "0.0",
          integer: "0",
          hex: "00FF",
          password: "********",
        };

        const keyName = "tf_" + id;

        w = {
          id,
          type,
          x: 14,
          y: 24,
          w: d.w - 28,
          h: Math.min(32, d.h - 48),
          label: labels[inputKind] || "Input",
          placeholder: placeholders[inputKind] || "",
          key: keyName,
          maxLen: inputKind === "hex" ? 16 : inputKind === "password" ? 64 : 32,
          inputKind,
        };

        if (KB) {
          KB.ensureFieldDataKey(w, LE.project);
        } else if (!LE.project.keys.find((k) => k.name === keyName)) {
          LE.project.keys.push({ name: keyName, type: "string", value: "" });
        }

      }

      else if (type === "keyboard") {

        const KB = window.LucarneKeyboard;

        const hwLayout = LE.project.hardware && LE.project.hardware.keyboard ? LE.project.hardware.keyboard.layout : "compact";

        const layout = KB ? KB.normalizeLayout(hwLayout) : "compact";

        const dock = LE.project.hardware && LE.project.hardware.keyboard ? LE.project.hardware.keyboard.dock || "bottom" : "bottom";

        if (KB) {

          const base = KB.defaultWidget(d, layout, dock);

          w = { id, type, x: base.x, y: base.y, w: base.w, h: base.h, layout: base.layout, dock };

        } else {

          w = { id, type, x: 0, y: Math.max(0, d.h - 80), w: d.w, h: 80, layout: "compact", dock: "bottom" };

        }

      }

      if (w && type === "battery") {
        ensureProjectKey(w.key || "battery", "float", 72);
        if (w.chargingKey) ensureProjectKey(w.chargingKey, "bool", false);
      } else if (w && type === "clock") {
        ensureProjectKey(w.hourKey || "hour", "int", 14);
        ensureProjectKey(w.minuteKey || "minute", "int", 30);
        if (w.format === "hms" || w.secondKey) ensureProjectKey(w.secondKey || "second", "int", 0);
      } else if (w && type === "date") {
        ensureProjectKey(w.dayKey || "day", "int", 29);
        ensureProjectKey(w.monthKey || "month", "int", 7);
        ensureProjectKey(w.yearKey || "year", "int", 2026);
      } else if (w && type === "status") {
        if (w.wifiKey) ensureProjectKey(w.wifiKey, "bool", true);
        if (w.rssiKey) ensureProjectKey(w.rssiKey, "int", -58);
        if (w.bluetoothKey) ensureProjectKey(w.bluetoothKey, "bool", false);
      } else if (w && type === "dynamicimage") {
        ensureProjectKey(w.pathKey || "img_path", "string", "/assets/cover.rgb565");
      } else if (w && type === "graph") {
        if ((w.mode || "stream") === "stream" && w.key) ensureProjectKey(w.key, "float", 50);
        else if (w.mode === "keys" && w.keys) {
          w.keys.forEach((key, i) => {
            if (key) ensureProjectKey(key, "float", 20 + i * 8);
          });
        }
      }

      s.widgets.push(w);

      LE.selection = { widgetId: id };

      LE.markDirty("Add " + type);

      LE.refreshInspector();

      if (LE.switchDockTab) LE.switchDockTab("inspector");

      render();

    }



    function cloneWidgetData(w) {

      return window.LucarneState.cloneWidgetData(w);

    }



    function copySelection() {

      const s = currentScreen();

      if (!s || !LE.selection.widgetId) return;

      const w = s.widgets.find((x) => x.id === LE.selection.widgetId);

      if (w) CB.setWidget(w);

    }



    function deleteSelection() {

      const s = currentScreen();

      if (!s || !LE.selection.widgetId) return;

      const idx = s.widgets.findIndex((x) => x.id === LE.selection.widgetId);

      if (idx < 0) return;

      s.widgets.splice(idx, 1);

      LE.selection = {};

      LE.markDirty("Delete widget");

      LE.refreshInspector();

      render();

      announceDelete("Widget deleted");

    }

    function announceDelete(msg) {

      if (!LE.toast) return;

      LE.toast(msg, { type: "info", action: LE.undo ? { label: "Undo", run: () => LE.undo() } : null });

    }

    let nudgeTimer = null;

    function nudgeSelection(dx, dy) {

      const s = currentScreen();

      if (!s || !LE.selection || !LE.selection.widgetId) return false;

      const w = s.widgets.find((x) => x.id === LE.selection.widgetId);

      if (!w) return false;

      w.x = (w.x || 0) + dx;

      w.y = (w.y || 0) + dy;

      clampPos(w);

      render();

      clearTimeout(nudgeTimer);

      nudgeTimer = setTimeout(() => {

        nudgeTimer = null;

        LE.markDirty("Nudge widget");

        LE.refreshInspector();

      }, 350);

      return true;

    }



    function pasteClipboard() {

      if (!CB.hasWidget()) return;

      const s = currentScreen();

      if (!s) return;

      const w = cloneWidgetData(CB.getWidget());

      w.x = snapCoord((w.x || 0) + 8);

      w.y = snapCoord((w.y || 0) + 8);

      clampPos(w);

      s.widgets.push(w);

      LE.selection = { widgetId: w.id };

      LE.markDirty("Paste widget");

      LE.refreshInspector();

      if (LE.switchDockTab) LE.switchDockTab("inspector");

      render();

    }



    function widgetSize(w) {

      const bw = w.w && w.w > 0 ? w.w : measureW(w);

      const bh = w.h && w.h > 0 ? w.h : measureH(w);

      return { bw, bh };

    }



    function allowsOverflow(w) {
      return w && (w.type === "image" || w.type === "icon" || w.type === "dynamicimage");
    }

    function clampPos(w) {

      if (allowsOverflow(w)) return;

      const d = LE.dims();

      const { bw, bh } = widgetSize(w);

      if (w.x < 0) w.x = 0;

      if (w.y < 0) w.y = 0;

      if (w.x + bw > d.w) w.x = d.w - bw;

      if (w.y + bh > d.h) w.y = d.h - bh;

    }



    function clampSize(w) {

      if (allowsOverflow(w)) {
        if (w.w < 4) w.w = 4;
        if (w.h < 4) w.h = 4;
        return;
      }

      const d = LE.dims();

      if (w.w < 4) w.w = 4;

      if (w.h < 4) w.h = 4;

      if (w.x + w.w > d.w) w.w = d.w - w.x;

      if (w.y + w.h > d.h) w.h = d.h - w.y;

    }



    function deselect() {

      LE.selection = {};

      deselectBtn.hidden = true;

      LE.refreshInspector();

      render();

    }



    function measureW(w) {

      const t = LE.renderTheme(LE.designerScreen);

      if (w.type === "label") {

        const atlas = w.font === "title" ? t.fontTitle : t.fontBody;

        if (atlas) return R.getAATextBounds(atlas, w.text || "").w;

        return (w.text || "").length * 6 * (w.size || 1);

      }

      if (w.type === "keyboard" && window.LucarneKeyboard) {

        const d = LE.dims();

        return window.LucarneKeyboard.measure(w.layout || "compact", w.w > 0 ? w.w : d.w, d.h).w;

      }

      if (w.type === "textfield") return w.w > 0 ? w.w : Math.max(80, LE.dims().w - 28);

      if (w.type === "image" && w.imageId && LE.project.images[w.imageId]) {
        const img = LE.project.images[w.imageId];
        if (w.scaleMode === "native") return w.w > 0 ? w.w : img.w;
      }

      if (w.type === "icon" && w.w > 0 && (w.lockSize || w.scaleMode === "native")) return w.w;

      return 40;

    }

    function measureH(w) {

      const t = LE.renderTheme(LE.designerScreen);

      if (w.type === "label") {

        const atlas = w.font === "title" ? t.fontTitle : t.fontBody;

        if (atlas) return R.getAATextBounds(atlas, w.text || "").h;

        return 8 * (w.size || 1);

      }

      if (w.type === "keyboard" && window.LucarneKeyboard) {

        const d = LE.dims();

        return window.LucarneKeyboard.measure(w.layout || "compact", w.w > 0 ? w.w : d.w, d.h).h;

      }

      if (w.type === "textfield") return w.h > 0 ? w.h : 28;

      if (w.type === "image" && w.imageId && LE.project.images[w.imageId]) {
        const img = LE.project.images[w.imageId];
        if (w.scaleMode === "native") return w.h > 0 ? w.h : img.h;
      }

      if (w.type === "icon" && w.h > 0 && (w.lockSize || w.scaleMode === "native")) return w.h;

      return 16;

    }



    function startMove(ev, w, scale) {

      ev.preventDefault();

      ev.stopPropagation();

      const wasSelected = LE.selection && LE.selection.widgetId === w.id;

      LE.selection = { widgetId: w.id };

      render({ skipOverlay: true });

      dragging = true;

      const sx = ev.clientX;

      const sy = ev.clientY;

      const ox = w.x;

      const oy = w.y;

      let moved = false;

      function move(e) {

        if (!moved && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 3) return;

        moved = true;

        w.x = snapCoord(ox + (e.clientX - sx) / scale);

        w.y = snapCoord(oy + (e.clientY - sy) / scale);

        clampPos(w);

        scheduleDragPaint(scale);

      }

      function up() {

        dragging = false;

        LE.refreshInspector();

        document.removeEventListener("pointermove", move);

        document.removeEventListener("pointerup", up);

        if (moved) LE.markDirty("Move widget");

        render();

        if (!moved && !wasSelected && LE.revealInspector) LE.revealInspector();

      }

      document.addEventListener("pointermove", move);

      document.addEventListener("pointerup", up);

    }



    function startResize(ev, w, scale) {

      ev.preventDefault();

      ev.stopPropagation();

      dragging = true;

      const sx = ev.clientX;

      const sy = ev.clientY;

      const ow = w.w && w.w > 0 ? w.w : measureW(w);

      const oh = w.h && w.h > 0 ? w.h : measureH(w);

      function move(e) {

        w.w = Math.max(4, snapCoord(ow + (e.clientX - sx) / scale));

        w.h = Math.max(4, snapCoord(oh + (e.clientY - sy) / scale));

        clampSize(w);

        scheduleDragPaint(scale);

      }

      function up() {

        dragging = false;

        if (allowsOverflow(w)) w.lockSize = true;

        document.removeEventListener("pointermove", move);

        document.removeEventListener("pointerup", up);

        LE.markDirty("Resize widget");

        render();

      }

      document.addEventListener("pointermove", move);

      document.addEventListener("pointerup", up);

    }



    function buildLayers(s) {

      const sel = LE.selection && LE.selection.widgetId ? LE.selection.widgetId : "";

      const key = s.widgets.map((w) => w.id).join(",") + "|" + sel;

      if (key === layersKey) {

        layers.querySelectorAll(".layer").forEach((row) => {

          row.classList.toggle("sel", row.dataset.wid === sel);

          row.setAttribute("aria-selected", String(row.dataset.wid === sel));

        });

        return;

      }

      layersKey = key;

      layers.innerHTML = "";

      for (let i = s.widgets.length - 1; i >= 0; i--) {

        const w = s.widgets[i];

        const row = el("div", "layer", layers);

        row.dataset.wid = w.id;

        row.setAttribute("role", "option");

        row.tabIndex = 0;

        row.setAttribute("aria-selected", String(sel === w.id));

        if (sel === w.id) row.classList.add("sel");

        const handle = el("span", "layer-handle", row);

        handle.title = "Drag to reorder";

        handle.setAttribute("aria-hidden", "true");

        if (UI) handle.innerHTML = UI.svg("grip", { size: 12 });

        const name = el("span", "layer-name", row);

        const layerLabel = w.type + (w.text ? " · " + w.text : w.label ? " · " + w.label : "");

        name.textContent = layerLabel;

        const x = el("button", "x", row);

        x.type = "button";

        x.tabIndex = -1;

        x.title = "Delete widget";

        x.setAttribute("aria-label", "Delete " + layerLabel);

        if (UI) x.innerHTML = UI.svg("close", { size: 12 });

        else x.textContent = "x";

        const removeLayer = () => {

          const idx = s.widgets.indexOf(w);

          if (idx === -1) return;

          s.widgets.splice(idx, 1);

          layersKey = "";

          if (LE.selection && LE.selection.widgetId === w.id) LE.selection = {};

          LE.markDirty("Delete widget");

          LE.refreshInspector();

          render();

          announceDelete("Widget deleted");

        };

        x.addEventListener("click", (ev) => {

          ev.stopPropagation();

          removeLayer();

        });

        const selectLayer = () => {

          LE.selection = { widgetId: w.id };

          LE.refreshInspector();

          render();

        };

        row.addEventListener("click", () => {

          selectLayer();

          if (LE.revealInspector) LE.revealInspector();

        });

        row.addEventListener("keydown", (ev) => {

          if (ev.key === "Enter" || ev.key === " ") {

            ev.preventDefault();

            selectLayer();

            const again = layers.querySelector('.layer[data-wid="' + w.id + '"]');

            if (again) again.focus();

          } else if (ev.key === "Delete" || ev.key === "Backspace") {

            ev.preventDefault();

            ev.stopPropagation();

            removeLayer();

            const first = layers.querySelector(".layer");

            if (first) first.focus();

          } else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {

            ev.preventDefault();

            ev.stopPropagation();

            const sib = ev.key === "ArrowDown" ? row.nextElementSibling : row.previousElementSibling;

            if (sib) sib.focus();

          }

        });

        handle.addEventListener("pointerdown", (ev) => startLayerDrag(ev, s, row));

      }

    }



    function startLayerDrag(ev, s, row) {

      ev.preventDefault();

      ev.stopPropagation();

      const rows = Array.from(layers.querySelectorAll(".layer"));

      const startIndex = rows.indexOf(row);

      if (startIndex === -1) return;

      let dropIndex = startIndex;

      row.classList.add("dragging");

      function clearIndicators() {

        rows.forEach((r) => r.classList.remove("drag-over-top", "drag-over-bottom"));

      }

      function move(e) {

        for (let i = 0; i < rows.length; i++) {

          const r = rows[i];

          if (r === row) continue;

          const rect = r.getBoundingClientRect();

          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {

            clearIndicators();

            if (e.clientY < rect.top + rect.height / 2) {

              r.classList.add("drag-over-top");

              dropIndex = i;

            } else {

              r.classList.add("drag-over-bottom");

              dropIndex = i + 1;

            }

            return;

          }

        }

      }

      function up() {

        document.removeEventListener("pointermove", move);

        document.removeEventListener("pointerup", up);

        row.classList.remove("dragging");

        clearIndicators();

        if (dropIndex !== startIndex && dropIndex !== startIndex + 1) {

          const visual = s.widgets.slice().reverse();

          const [moved] = visual.splice(startIndex, 1);

          const insertAt = dropIndex > startIndex ? dropIndex - 1 : dropIndex;

          visual.splice(insertAt, 0, moved);

          s.widgets = visual.slice().reverse();

          layersKey = "";

          LE.markDirty("Reorder widget");

        }

        render();

      }

      document.addEventListener("pointermove", move);

      document.addEventListener("pointerup", up);

    }



    back.addEventListener("click", () => LE.exitDesigner());

    deselectBtn.addEventListener("click", deselect);

    nameInput.addEventListener("input", () => {

      const s = currentScreen();

      if (s) {

        s.name = nameInput.value;

        LE.autosave();

      }

    });

    startBtn.addEventListener("click", () => {

      const s = currentScreen();

      if (s) {

        LE.project.startScreen = s.id;

        LE.markDirty("Set start screen");

        render();

      }

    });

    realInput.addEventListener("change", () => {

      realistic = realInput.checked;

      zoomInput.disabled = realistic;

      calibBtn.hidden = !realistic;

      render();

    });

    gridSel.addEventListener("change", () => {

      gridStep = parseInt(gridSel.value, 10) || 0;

      render();

    });

    snapInput.addEventListener("change", () => {

      snapGrid = snapInput.checked;

    });

    zoomInput.addEventListener("input", () => {

      autoFitZoom = false;

      render();

    });

    fitBtn.addEventListener("click", () => {

      applyFitZoom();

      render();

    });

    if (typeof ResizeObserver !== "undefined") {

      const ro = new ResizeObserver(() => {

        if (autoFitZoom && !realistic && !host.hidden) render();

      });

      ro.observe(wrap);

    }



    function pointerDeselect(ev) {

      if (ev.target.closest(".grip")) return;

      const handle = ev.target.closest(".handle");

      if (handle && !handle.classList.contains("fullscreen")) return;

      deselect();

    }



    wrap.addEventListener("pointerdown", pointerDeselect);

    layersCol.addEventListener("pointerdown", (ev) => {

      if (ev.target === layersCol || ev.target === layers || ev.target === layersTitle) deselect();

    });

    palette.addEventListener("pointerdown", (ev) => {

      if (ev.target === palette) deselect();

    });



    document.addEventListener("keydown", (ev) => {

      if (!LE.designerScreen || host.hidden) return;

      const tag = (ev.target && ev.target.tagName) || "";

      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (ev.target && ev.target.isContentEditable) return;

      if (document.querySelector(".modal:not([hidden])") || document.querySelector(".tour-root")) return;

      const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

      if (ARROWS[ev.key] && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {

        const step = ev.shiftKey ? 8 : 1;

        if (nudgeSelection(ARROWS[ev.key][0] * step, ARROWS[ev.key][1] * step)) ev.preventDefault();

        return;

      }

      if (ev.key === "Escape" && LE.selection && LE.selection.widgetId) deselect();

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "c") {

        ev.preventDefault();

        copySelection();

      }

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "v") {

        ev.preventDefault();

        pasteClipboard();

      }

      if (ev.key === "Delete" || ev.key === "Backspace") {

        if (LE.selection && LE.selection.widgetId) {

          ev.preventDefault();

          deleteSelection();

        }

      }

    });



    let animFrameId = null;



    function stopAnimLoop() {

      if (animFrameId) {

        cancelAnimationFrame(animFrameId);

        animFrameId = null;

      }

      if (window.LucarneFluentEmoji && window.LucarneFluentEmoji.pauseAnimated) {

        window.LucarneFluentEmoji.pauseAnimated();

      }

    }



    function startAnimLoop() {

      if (animFrameId) return;

      const FE = window.LucarneFluentEmoji;

      if (!FE || !FE.projectUsesAnimatedEmoji(LE.project)) return;

      if (FE.resumeAnimated) FE.resumeAnimated();

      function tick(now) {

        if (host.hidden) {

          stopAnimLoop();

          return;

        }

        if (now - lastAnimPaint >= ANIM_INTERVAL_MS) {

          lastAnimPaint = now;

          paintCanvas();

          if (LE.pushLiveScreen) LE.pushLiveScreen();

        }

        animFrameId = requestAnimationFrame(tick);

      }

      lastAnimPaint = 0;

      animFrameId = requestAnimationFrame(tick);

    }



    function open(screenId) {

      LE.designerScreen = screenId;

      LE.selection = {};

      layersKey = "";

      applyFitZoom();

      render();

      startAnimLoop();

    }



    panelCtls.forEach((c) => c.syncMode());

    return {
      render,
      open,
      startAnimLoop,
      stopAnimLoop,
      fitZoom: applyFitZoom,
      sidePanelsWidth,
      togglePalette: () => paletteResizeCtl.toggle(),
      paletteVisible: () => !paletteResizeCtl.isCollapsed(),
      nudge: nudgeSelection,
    };

  }



  window.LucarneDesigner = { init };

})();


