(function () {
  "use strict";

  const R = window.LucarneRender;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  const PALETTE = [
    { type: "label", label: "Label" },
    { type: "metric", label: "Metric" },
    { type: "bar", label: "Bar" },
    { type: "icon", label: "Icon" },
    { type: "image", label: "Image" },
    { type: "menu", label: "Menu" },
  ];

  function init(host, LE) {
    host.innerHTML = "";
    const root = el("div", "designer", host);

    const bar = el("div", "designer-bar", root);
    const back = el("button", "btn", bar);
    back.textContent = "< Blueprint";
    const nameInput = el("input", "field", bar);
    nameInput.style.maxWidth = "180px";
    const deselectBtn = el("button", "btn", bar);
    deselectBtn.textContent = "Deselect";
    deselectBtn.hidden = true;
    const spacer = el("div", "", bar);
    spacer.style.flex = "1";
    const startBtn = el("button", "btn", bar);

    const body = el("div", "designer-body", root);
    const palette = el("div", "palette", body);
    PALETTE.forEach((p) => {
      const item = el("div", "palette-item", palette);
      item.textContent = p.label;
      item.addEventListener("click", () => addWidget(p.type));
    });

    const wrap = el("div", "canvas-wrap", body);
    const device = el("div", "device", wrap);
    const stack = el("div", "screen-stack", device);
    const canvas = el("canvas", "", stack);
    canvas.id = "designerCanvas";
    const overlay = el("div", "overlay", stack);

    const layersCol = el("div", "layers-panel", body);
    const layersTitle = el("div", "layers-title", layersCol);
    layersTitle.textContent = "Layers";
    const layers = el("div", "layers-list", layersCol);

    const controls = el("div", "preview-controls", wrap);
    const realChk = el("label", "check", controls);
    const realInput = document.createElement("input");
    realInput.type = "checkbox";
    realChk.appendChild(realInput);
    realChk.appendChild(document.createTextNode("Realistic 1:1"));
    const gridChk = el("label", "check", controls);
    const gridInput = document.createElement("input");
    gridInput.type = "checkbox";
    gridChk.appendChild(gridInput);
    gridChk.appendChild(document.createTextNode("Pixel grid"));
    const zoomInput = document.createElement("input");
    zoomInput.type = "range";
    zoomInput.min = "1";
    zoomInput.max = "8";
    zoomInput.step = "1";
    zoomInput.value = "2";
    controls.appendChild(zoomInput);
    const zoomLbl = el("span", "muted", controls);

    let realistic = false;
    let grid = false;

    function ppi() {
      const dev = LE.device();
      const diag = Math.sqrt(dev.w * dev.w + dev.h * dev.h);
      return diag / dev.inch;
    }

    function computeScale() {
      const d = LE.dims();
      if (realistic) {
        return Math.max(0.5, 96 / ppi());
      }
      return parseInt(zoomInput.value, 10);
    }

    function currentScreen() {
      return LE.getScreen(LE.designerScreen);
    }

    function addWidget(type) {
      const d = LE.dims();
      const s = currentScreen();
      if (!s) return;
      const id = LE.genId("w");
      let w;
      if (type === "label")
        w = { id, type, x: 20, y: 20, w: 120, h: 24, text: "Label", align: "left", font: "body" };
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
      s.widgets.push(w);
      LE.selection = { widgetId: id };
      LE.markDirty();
      LE.refreshDock();
    }

    function render() {
      const s = currentScreen();
      if (!s) return;
      const d = LE.dims();
      const scale = computeScale();
      zoomLbl.textContent = realistic ? "~" + ppi().toFixed(0) + " PPI" : scale + "x";
      nameInput.value = s.name || "";
      startBtn.textContent = LE.project.startScreen === s.id ? "Start screen" : "Set as start";
      startBtn.classList.toggle("primary", LE.project.startScreen === s.id);
      deselectBtn.hidden = !(LE.selection && LE.selection.widgetId);

      canvas.width = d.w;
      canvas.height = d.h;
      canvas.style.width = d.w * scale + "px";
      canvas.style.height = d.h * scale + "px";
      canvas.style.imageRendering = scale >= 1 ? "pixelated" : "auto";

      const disp = new R.Display(d.w, d.h);
      R.drawScreen(disp, s, LE.renderTheme(), LE.env(s));
      disp.blitTo(canvas.getContext("2d"));

      overlay.style.width = d.w * scale + "px";
      overlay.style.height = d.h * scale + "px";
      if (grid && scale >= 3) {
        const line = "rgba(0,0,0,0.18)";
        overlay.style.backgroundImage =
          "repeating-linear-gradient(0deg, " + line + " 0 1px, transparent 1px " + scale + "px)," +
          "repeating-linear-gradient(90deg, " + line + " 0 1px, transparent 1px " + scale + "px)";
      } else {
        overlay.style.backgroundImage = "none";
      }
      buildHandles(s, scale);
      buildLayers(s);
    }

    function buildHandles(s, scale) {
      overlay.innerHTML = "";
      s.widgets.forEach((w) => {
        const bw = w.w && w.w > 0 ? w.w : measureW(w);
        const bh = w.h && w.h > 0 ? w.h : measureH(w);
        const h = el("div", "handle", overlay);
        h.style.left = w.x * scale + "px";
        h.style.top = w.y * scale + "px";
        h.style.width = bw * scale + "px";
        h.style.height = bh * scale + "px";
        const selected = LE.selection && LE.selection.widgetId === w.id;
        if (!selected) {
          h.style.borderColor = "transparent";
          h.style.background = "transparent";
        }
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
      });
    }

    function widgetSize(w) {
      const bw = w.w && w.w > 0 ? w.w : measureW(w);
      const bh = w.h && w.h > 0 ? w.h : measureH(w);
      return { bw, bh };
    }

    function clampPos(w) {
      const d = LE.dims();
      const { bw, bh } = widgetSize(w);
      if (w.x < 0) w.x = 0;
      if (w.y < 0) w.y = 0;
      if (w.x + bw > d.w) w.x = d.w - bw;
      if (w.y + bh > d.h) w.y = d.h - bh;
    }

    function clampSize(w) {
      const d = LE.dims();
      if (w.w < 4) w.w = 4;
      if (w.h < 4) w.h = 4;
      if (w.x + w.w > d.w) w.w = d.w - w.x;
      if (w.y + w.h > d.h) w.h = d.h - w.y;
    }

    function deselect() {
      LE.selection = {};
      deselectBtn.hidden = true;
      LE.refreshDock();
      render();
    }

    function measureW(w) {
      const t = LE.renderTheme();
      if (w.type === "label") {
        const atlas = w.font === "title" ? t.fontTitle : t.fontBody;
        if (atlas) return R.getAATextBounds(atlas, w.text || "").w;
        return (w.text || "").length * 6 * (w.size || 1);
      }
      return 40;
    }
    function measureH(w) {
      const t = LE.renderTheme();
      if (w.type === "label") {
        const atlas = w.font === "title" ? t.fontTitle : t.fontBody;
        if (atlas) return R.getAATextBounds(atlas, w.text || "").h;
        return 8 * (w.size || 1);
      }
      return 16;
    }

    function startMove(ev, w, scale) {
      ev.preventDefault();
      ev.stopPropagation();
      LE.selection = { widgetId: w.id };
      LE.refreshDock();
      render();
      const sx = ev.clientX;
      const sy = ev.clientY;
      const ox = w.x;
      const oy = w.y;
      function move(e) {
        w.x = Math.round(ox + (e.clientX - sx) / scale);
        w.y = Math.round(oy + (e.clientY - sy) / scale);
        clampPos(w);
        render();
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        LE.markDirty();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    }

    function startResize(ev, w, scale) {
      ev.preventDefault();
      ev.stopPropagation();
      const sx = ev.clientX;
      const sy = ev.clientY;
      const ow = w.w && w.w > 0 ? w.w : measureW(w);
      const oh = w.h && w.h > 0 ? w.h : measureH(w);
      function move(e) {
        w.w = Math.max(4, Math.round(ow + (e.clientX - sx) / scale));
        w.h = Math.max(4, Math.round(oh + (e.clientY - sy) / scale));
        clampSize(w);
        render();
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        LE.markDirty();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    }

    function buildLayers(s) {
      layers.innerHTML = "";
      for (let i = s.widgets.length - 1; i >= 0; i--) {
        const w = s.widgets[i];
        const row = el("div", "layer", layers);
        if (LE.selection && LE.selection.widgetId === w.id) row.classList.add("sel");
        const name = el("span", "", row);
        name.textContent = w.type + (w.text ? " · " + w.text : w.label ? " · " + w.label : "");
        const x = el("span", "x", row);
        x.textContent = "x";
        x.addEventListener("click", (ev) => {
          ev.stopPropagation();
          s.widgets.splice(i, 1);
          if (LE.selection && LE.selection.widgetId === w.id) LE.selection = {};
          LE.markDirty();
          LE.refreshDock();
        });
        row.addEventListener("click", () => {
          LE.selection = { widgetId: w.id };
          LE.refreshDock();
          render();
        });
      }
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
        LE.markDirty();
        render();
      }
    });
    realInput.addEventListener("change", () => {
      realistic = realInput.checked;
      zoomInput.disabled = realistic;
      render();
    });
    gridInput.addEventListener("change", () => {
      grid = gridInput.checked;
      render();
    });
    zoomInput.addEventListener("input", render);

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
      if (ev.key === "Escape" && LE.designerScreen) deselect();
    });

    function open(screenId) {
      LE.designerScreen = screenId;
      LE.selection = {};
      render();
    }

    return { render, open };
  }

  window.LucarneDesigner = { init };
})();
