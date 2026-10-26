(function () {
  "use strict";

  const R = window.LucarneRender;
  const S = window.LucarneState;
  const H = window.LucarneHistory;
  const DLG = window.LucarneDialog;

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
    tabHardware: $("tab-hardware"),
    tabAssets: $("tab-assets"),
    tabData: $("tab-data"),
    memoryBar: $("memoryBar"),
    historyBar: $("historyBar"),
    btnUndo: $("btnUndo"),
    btnRedo: $("btnRedo"),
    modal: $("modal"),
    settingsModal: $("settingsModal"),
    modalText: $("modalText"),
    modalFiles: $("modalFiles"),
    modalExportTabs: $("modalExportTabs"),
    modalExportSummary: $("modalExportSummary"),
    modalDownloadAllSd: $("modalDownloadZip"),
    liveSpeed: $("liveSpeed"),
    toast: $("toast"),
    fileLoad: $("fileLoad"),
  };

  let project = S.defaultProject();
  let mode = "blueprint";
  let memoryAlertShown = "";

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
    autosave: () => flushAutosave(),
    serializeProjectClone: () => serializeProjectClone(LE.project),
    applyProject: (obj) => applyProject(obj),
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
    renderTheme: (screenId) => {
      const screen = screenId ? LE.getScreen(screenId) : null;
      const t = S.mergedTheme(LE.project, screen);
      const key =
        (screenId || "global") +
        "|" +
        t.background +
        "|" +
        t.surface +
        "|" +
        t.surfaceEdge +
        "|" +
        t.text +
        "|" +
        t.textDim +
        "|" +
        t.primary +
        "|" +
        t.success +
        "|" +
        t.warning +
        "|" +
        t.danger +
        "|" +
        t.radius +
        "|" +
        t.padding +
        "|" +
        t.rowHeight +
        "|" +
        t.textSize +
        "|" +
        t.fontBodyId +
        "|" +
        t.fontTitleId;
      if (key !== themeCacheKey) {
        themeCacheKey = key;
        themeCache = R.themeTo565(t, LE.fontAtlas(t.fontBodyId), LE.fontAtlas(t.fontTitleId));
      }
      return themeCache;
    },
    env: (screen, selMap, extra) => ({
      LE,
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
      focusFieldId: extra && extra.focusFieldId,
      focusShapeId: extra && extra.focusShapeId,
      focusNavId: extra && extra.focusNavId,
      editDraft: extra && extra.editDraft,
      kbFocusIndex: extra && extra.kbFocusIndex,
      screenOffsetY: extra && extra.screenOffsetY ? extra.screenOffsetY : 0,
      graphSamples: (id) => (extra && extra.graphSamples ? extra.graphSamples(id) : null),
      overlayKeyboard: extra && extra.overlayKeyboard,
    }),
    pushLiveScreen: pushLive,
    requestRender,
    markDirty,
    refreshDock,
    refreshInspector,
    switchDockTab,
    refreshMemoryBar,
    invalidateThemeCache,
    getSharedDisplay,
    openDesigner,
    exitDesigner,
    setMode,
    addScreen,
    duplicateScreen,
    undo,
    redo,
    createProject: (obj) => applyProject(obj),
    revealInspector: () => revealInspector(),
    hideInspector: () => drawerClose(),
    getMode: () => mode,
    fitDock: () => dockFit(),
    projectHasWork: () => projectHasWork(),
    confirmReplaceProject: (label, proceed) => confirmReplaceProject(label, proceed),
    openFile: () => dom.fileLoad.click(),
    busy: (btnEl, work, label) => busy(btnEl, work, label),
  };

  let graph, designer, simulate;
  let history = null;

  let renderScheduled = false;
  let livePushScheduled = false;
  let autosaveTimer = null;
  let sharedDisplay = null;
  let sharedDisplayKey = "";
  let themeCache = null;
  let themeCacheKey = "";

  function invalidateThemeCache() {
    themeCacheKey = "";
    themeCache = null;
  }

  function getSharedDisplay(w, h) {
    const key = w + "x" + h;
    if (!sharedDisplay || sharedDisplayKey !== key) {
      sharedDisplay = new R.Display(w, h);
      sharedDisplayKey = key;
    }
    return sharedDisplay;
  }

  let saveFailed = false;

  function runSave() {
    saveFailed = false;
    S.save(LE.project);
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      runSave();
    }, 700);
  }

  function flushAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
    runSave();
  }

  const TOAST_MAX = 3;
  const TOAST_ICON = { info: "info", success: "success", warn: "warning", error: "error" };

  function toast(msg, opts) {
    if (!dom.toast) return { dismiss() {} };
    opts = typeof opts === "string" ? { type: opts } : opts || {};
    const type = TOAST_ICON[opts.type] ? opts.type : "info";
    const duration = opts.duration || (type === "error" ? 6000 : type === "warn" ? 4500 : opts.action ? 5000 : 2600);
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    if (window.LucarneUiIcons) {
      const ic = window.LucarneUiIcons.node(TOAST_ICON[type], { size: 16 });
      ic.classList.add("toast-icon");
      el.appendChild(ic);
    }
    const text = document.createElement("span");
    text.className = "toast-msg";
    text.textContent = msg;
    el.appendChild(text);
    let timer = null;
    const dismiss = () => {
      clearTimeout(timer);
      if (!el.parentNode || el.classList.contains("leaving")) return;
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 180);
    };
    if (opts.action && opts.action.label && typeof opts.action.run === "function") {
      const a = document.createElement("button");
      a.type = "button";
      a.className = "toast-action";
      a.textContent = opts.action.label;
      a.addEventListener("click", () => {
        dismiss();
        opts.action.run();
      });
      el.appendChild(a);
    }
    const x = document.createElement("button");
    x.type = "button";
    x.className = "toast-close";
    x.setAttribute("aria-label", "Dismiss notification");
    if (window.LucarneUiIcons) x.innerHTML = window.LucarneUiIcons.svg("close", { size: 14 });
    else x.textContent = "x";
    x.addEventListener("click", dismiss);
    el.appendChild(x);
    dom.toast.appendChild(el);
    while (dom.toast.children.length > TOAST_MAX) dom.toast.firstElementChild.remove();
    timer = setTimeout(dismiss, duration);
    el.addEventListener("pointerenter", () => clearTimeout(timer));
    el.addEventListener("pointerleave", () => {
      clearTimeout(timer);
      timer = setTimeout(dismiss, 1600);
    });
    el.addEventListener("focusin", () => clearTimeout(timer));
    return { dismiss };
  }

  function errorText(e, fallback) {
    if (!e) return fallback || "unknown error";
    if (typeof e === "string") return e;
    return e.message || String(e) || fallback || "unknown error";
  }

  function overlayAbove(modalEl) {
    if (document.querySelector(".tour-root")) return true;
    return Array.from(document.querySelectorAll(".modal:not([hidden])")).some((m) => m !== modalEl);
  }

  function hasWebSerial() {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  function toastUndo(msg) {
    return toast(msg, { type: "info", action: { label: "Undo", run: () => undo() } });
  }

  function busy(btnEl, work, label) {
    if (!btnEl) return Promise.resolve().then(work);
    if (btnEl.classList.contains("is-busy")) return Promise.resolve(null);
    const prev = btnEl.disabled;
    btnEl.disabled = true;
    btnEl.classList.add("is-busy");
    btnEl.setAttribute("aria-busy", "true");
    const spinner = document.createElement("span");
    spinner.className = "btn-spinner";
    spinner.setAttribute("aria-hidden", "true");
    btnEl.insertBefore(spinner, btnEl.firstChild);
    const prevTitle = btnEl.title;
    if (label) btnEl.title = label;
    return Promise.resolve()
      .then(work)
      .finally(() => {
        spinner.remove();
        btnEl.classList.remove("is-busy");
        btnEl.removeAttribute("aria-busy");
        btnEl.disabled = prev;
        if (label && btnEl.title === label) btnEl.title = prevTitle;
      });
  }

  function autosave() {
    flushAutosave();
  }

  function markDirty(label) {
    scheduleAutosave();
    scheduleRender();
    refreshMemoryBar();
    if (history) history.commit(label);
    if (fontNeedsRebake() && !fontBakePending) {
      fontBakePending = true;
      ensureFonts().finally(() => {
        fontBakePending = false;
      });
    }
    if (window.LucarneFluentEmoji && window.LucarneFluentEmoji.projectUsesAnimatedEmoji(LE.project)) {
      if (mode === "designer" && designer && designer.startAnimLoop) designer.startAnimLoop();
      else if (mode === "simulate" && simulate && simulate.startAnimLoop) simulate.startAnimLoop();
    }
  }

  function renderHistoryBar(entries) {
    if (!dom.historyBar) return;
    dom.historyBar.innerHTML = "";
    entries.past.forEach((label, i) => {
      const b = document.createElement("button");
      b.className = "history-item";
      b.textContent = label;
      b.title = "Jump to this step";
      b.addEventListener("click", () => history.jumpTo(i));
      dom.historyBar.appendChild(b);
    });
    const cur = document.createElement("button");
    cur.className = "history-item now";
    cur.textContent = entries.current || "Now";
    cur.disabled = true;
    dom.historyBar.appendChild(cur);
    entries.future.forEach((label, i) => {
      const b = document.createElement("button");
      b.className = "history-item future";
      b.textContent = label;
      b.title = "Redo to this step";
      b.addEventListener("click", () => history.jumpTo(entries.past.length + 1 + i));
      dom.historyBar.appendChild(b);
    });
    dom.historyBar.scrollLeft = dom.historyBar.scrollWidth;
    if (dom.btnUndo) dom.btnUndo.disabled = !entries.canUndo;
    if (dom.btnRedo) dom.btnRedo.disabled = !entries.canRedo;
  }

  function onHistoryRestore() {
    LE.selection = {};
    LE.graphSel = null;
    if (mode === "designer" && !LE.getScreen(LE.designerScreen)) {
      setMode("blueprint");
    } else {
      invalidateThemeCache();
      refreshDock();
      requestRender();
    }
    refreshMemoryBar();
    flushAutosave();
  }

  function undo() {
    if (history) history.undo();
  }

  function redo() {
    if (history) history.redo();
  }

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      doRender();
    });
  }

  function doRender() {
    if (mode === "blueprint") graph.render();
    else if (mode === "designer") designer.render();
    else if (mode === "simulate") simulate.render();
    scheduleLivePush();
  }

  function requestRender() {
    scheduleRender();
  }

  function scheduleLivePush() {
    if (mode === "simulate") return;
    if (!LE.live || !LE.live.isConnected()) return;
    if (livePushScheduled) return;
    livePushScheduled = true;
    requestAnimationFrame(() => {
      livePushScheduled = false;
      pushLive();
    });
  }

  function focusedScreenId() {
    if (mode === "simulate" && LE.simulate && LE.simulate.currentScreenId) {
      return LE.simulate.currentScreenId();
    }
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
    const disp = getSharedDisplay(d.w, d.h);
    R.drawScreen(disp, s, LE.renderTheme(focusedScreenId()), LE.env(s, {}));
    LE.live.sendDisplay(disp);
  }

  async function sendLiveSetup() {
    if (!LE.live || !LE.live.isConnected()) return;
    await liveHwConfigOnly;
    if (LE.live.syncDeviceInfo) await LE.live.syncDeviceInfo();
    const LR = window.LucarneLiveReceivers;
    if (LR && LE.live.getDeviceDriverId) {
      const want = LR.deviceDriverId(LE.project);
      const got = LE.live.getDeviceDriverId();
      if (want && got && want !== got) {
        toast("Live: receiver driver differs from project — use Flash receiver and pick the matching display driver", "warn");
      }
    }
    if (LE.live.setStreamReady) LE.live.setStreamReady(true);
    if (LE.live.resetFrame) LE.live.resetFrame();
    const dev = LE.live.deviceDims();
    const ed = LE.dims();
    if (dev && (dev.w !== ed.w || dev.h !== ed.h)) {
      toast("Live: size mismatch editor " + ed.w + "×" + ed.h + " vs device " + dev.w + "×" + dev.h + " — check panel preset / rotation", "warn");
    }
    pushLive();
  }

  // Sends the Hardware tab's pin/SPI assignment to the LucarnePreview /
  // LucarnePreviewST7796 receiver right after connecting, so a single
  // precompiled binary re-runs Display::begin() with the exact GPIOs chosen
  // for this project — any board, any wiring, no recompile needed.
  let liveHwConfigOnly = Promise.resolve();
  let liveHwConfigChain = Promise.resolve();

  async function sendLiveHwConfig() {
    if (!LE.live || !LE.live.isConnected()) return;
    const H = window.LucarneHardware;
    if (!H) return;
    const family = H.displayFamily(LE.project);
    const hw = H.get(LE.project);
    const dev = LE.device();
    const n = LE.nativeDims();
    const ed = LE.dims();
    let sendPromise = Promise.resolve();
    if (family === "spi_rgb" || (family === "oled_mono" && dev.bus === "spi")) {
      if (!LE.live.sendHwConfig) return;
      const d = hw.display;
      const spi = hw.spi;
      sendPromise = LE.live.sendHwConfig({
        cs: d.cs | 0,
        dc: d.dc | 0,
        rst: d.rst | 0,
        mosi: spi.mosi | 0,
        miso: spi.miso | 0,
        sclk: spi.sclk | 0,
        bl: d.bl | 0,
        spiHz: d.spiHz | 0,
        spiMode: d.spiMode | 0,
        colorOrder: d.colorOrder || "RGB",
        invert: family === "oled_mono" ? !!hw.oled.invert : !!d.invert,
        panelWidth: n.w,
        panelHeight: n.h,
        rotation: LE.project.rotation || 0,
        blActiveLow: !!d.blActiveLow,
      });
    } else if (family === "oled_mono") {
      if (!LE.live.sendHwConfigOled) return;
      const i2c = hw.i2c;
      const oled = hw.oled;
      sendPromise = LE.live.sendHwConfigOled({
        sda: i2c.sda | 0,
        scl: i2c.scl | 0,
        rst: oled.rst | 0,
        addr: oled.addr || 0x3c,
        panelWidth: n.w,
        panelHeight: n.h,
        rotation: LE.project.rotation || 0,
        invert: !!oled.invert,
      });
    } else if (family === "matrix_lcd") {
      if (!LE.live.sendHwConfigMatrix) return;
      const m = hw.matrix;
      sendPromise = LE.live.sendHwConfigMatrix({
        rs: m.rs | 0,
        en: m.en | 0,
        d4: m.d4 | 0,
        d5: m.d5 | 0,
        d6: m.d6 | 0,
        d7: m.d7 | 0,
        rw: m.rw | 0,
        bl: m.bl | 0,
        cols: m.cols | 0,
        rows: m.rows | 0,
        panelWidth: ed.w,
        panelHeight: ed.h,
        rotation: LE.project.rotation || 0,
        blActiveLow: !!m.blActiveLow,
      });
    } else if (family === "mipi_dsi") {
      toast("Live: MIPI receiver must be compiled for ESP32-P4 (examples/LucarnePreview) — use SPI preview boards or export firmware", "warn");
      return;
    } else {
      return;
    }
    liveHwConfigOnly = liveHwConfigOnly.then(async () => {
      try {
        await sendPromise;
      } catch (e) {
        const baud = S.getLiveBaud();
        const ver = LE.live.getProtoVersion ? LE.live.getProtoVersion() : 0;
        let hint = "";
        if (baud === 3000000) hint = " Check Live speed: ST7789 receiver uses 2M (Turbo), ST7796 uses 3M (Realtime).";
        else if (ver > 0 && ver < 3) hint = " Receiver protocol v" + ver + " has no HWCONFIG — use Flash receiver or LucarnePreview.ino from this repo.";
        else hint = " Reflash the receiver (Flash receiver) or match Live speed to Serial.begin() in the sketch.";
        toast(
          "Live: GPIO config not applied — " + (e && e.message ? e.message : "device did not ACK") + hint,
          "warn"
        );
      }
    });
    liveHwConfigChain = liveHwConfigOnly.then(() => sendLiveSetup());
    return liveHwConfigChain;
  }

  function setMode(m) {
    if (m === "designer" && !LE.designerScreen) {
      // The Designer tab needs a screen to edit — fall back to the first
      // screen in the project rather than showing a blank canvas.
      LE.designerScreen = (LE.project.screens[0] && LE.project.screens[0].id) || null;
      if (!LE.designerScreen) m = "blueprint";
    }
    mode = m;
    if (LE.live && LE.live.requestFullRefresh) LE.live.requestFullRefresh();
    dom.graphHost.hidden = m !== "blueprint";
    dom.designerHost.hidden = m !== "designer";
    dom.simHost.hidden = m !== "simulate";
    document.querySelectorAll(".modeTab").forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    dockFit();
    if (m === "blueprint") graph.render();
    else if (m === "designer") {
      LE.selection = {};
      designer.open(LE.designerScreen);
    } else if (m === "simulate") simulate.open();
    if (m !== "simulate" && simulate.stopAnimLoop) simulate.stopAnimLoop();
    if (m !== "designer" && designer && designer.stopAnimLoop) designer.stopAnimLoop();
    refreshDock();
    pushLive();
  }

  function openDesigner(id) {
    LE.designerScreen = id;
    setMode("designer");
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
    markDirty("Add screen");
    refreshDock();
  }

  function duplicateScreen(sourceId) {
    const id = sourceId || (LE.graphSel && LE.graphSel.type === "node" ? LE.graphSel.id : null);
    if (!id) return;
    const copy = S.duplicateScreen(LE.project, id);
    if (!copy) return;
    LE.graphSel = { type: "node", id: copy.id };
    if (LE.designerScreen === id) LE.designerScreen = copy.id;
    markDirty("Duplicate screen");
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
      entry._atlas = window.LucarneFonts.bake(
        entry.family,
        entry.sizePx,
        entry.weight,
        32,
        window.LucarneUtf8 ? window.LucarneUtf8.fontExportLast(window.LucarneUtf8.collectProjectCodepoints(LE.project)) : 255
      );
    } catch (e) {
      console.warn("Font bake failed for " + (entry.family || entry.id), e);
      entry._atlas = null;
    }
  }

  const warnedFonts = new Set();

  async function ensureFonts() {
    try {
      await window.LucarneFonts.ensureDefault();
    } catch (e) {
      console.warn("Default font load failed", e);
      toast("Default font could not be loaded \u2014 previews use a fallback font", "warn");
    }
    const ids = Object.keys(LE.project.fonts);
    for (const id of ids) await bakeFont(LE.project.fonts[id]);
    const failed = ids
      .map((id) => LE.project.fonts[id])
      .filter((f) => f && !f._atlas && !warnedFonts.has(f.id + "|" + f.family));
    if (failed.length) {
      failed.forEach((f) => warnedFonts.add(f.id + "|" + f.family));
      toast(
        "Font" + (failed.length > 1 ? "s" : "") + " not available: " + failed.map((f) => f.label || f.family || f.id).join(", ") + ". Check your connection or re-upload the file.",
        "warn"
      );
    }
    if (window.LucarneTextStyle) await window.LucarneTextStyle.bakeAllWidgetStyles(LE);
    requestRender();
    refreshMemoryBar();
  }

  function fontNeedsRebake() {
    if (!window.LucarneUtf8) return false;
    const needed = window.LucarneUtf8.fontExportLast(window.LucarneUtf8.collectProjectCodepoints(LE.project));
    return Object.values(LE.project.fonts).some((f) => !f._atlas || f._atlas.last < needed);
  }

  let fontBakePending = false;

  /* ---------------- Dock ---------------- */
  let fieldIdSeq = 0;

  function bindRowLabel(r, l) {
    queueMicrotask(() => {
      const ctl = r.querySelector("input:not([type=hidden]), select, textarea");
      if (!ctl) {
        if (!l.htmlFor) {
          const sp = document.createElement("span");
          sp.className = l.className || "row-label";
          sp.textContent = l.textContent;
          if (l.parentNode === r) r.replaceChild(sp, l);
        }
        return;
      }
      if (!ctl.id) ctl.id = "lc-f-" + ++fieldIdSeq;
      l.htmlFor = ctl.id;
    });
  }

  function row(parent, labelText) {
    const r = document.createElement("div");
    r.className = "row";
    if (labelText !== null && labelText !== undefined) {
      const l = document.createElement("label");
      l.textContent = labelText;
      r.appendChild(l);
      if (labelText !== "") bindRowLabel(r, l);
    }
    parent.appendChild(r);
    return r;
  }

  function toggleRow(parent, label, value, onchange) {
    const r = document.createElement("div");
    r.className = "row row-toggle";
    const l = document.createElement("span");
    l.className = "row-label";
    l.textContent = label;
    const wrap = document.createElement("label");
    wrap.className = "toggle";
    const i = document.createElement("input");
    i.type = "checkbox";
    i.checked = !!value;
    i.setAttribute("role", "switch");
    i.id = "lc-f-" + ++fieldIdSeq;
    l.id = i.id + "-label";
    i.setAttribute("aria-labelledby", l.id);
    l.addEventListener("click", () => i.click());
    const track = document.createElement("span");
    track.className = "toggle-track";
    track.setAttribute("aria-hidden", "true");
    wrap.appendChild(i);
    wrap.appendChild(track);
    i.addEventListener("change", () => onchange(i.checked));
    r.appendChild(l);
    r.appendChild(wrap);
    parent.appendChild(r);
    return i;
  }

  function input(type, value, oninput) {
    const i = document.createElement("input");
    i.type = type;
    if (type === "checkbox") {
      i.checked = !!value;
      i.addEventListener("change", () => oninput(i.checked));
      return i;
    }
    i.className = "field";
    i.value = value === undefined || value === null ? "" : value;
    i.addEventListener("input", () => oninput(i.value));
    return i;
  }

  function select(options, value, onchange) {
    const s = document.createElement("select");
    s.className = "field";
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.disabled) opt.disabled = true;
      if (o.title) opt.title = o.title;
      if (o.value === value) opt.selected = true;
      s.appendChild(opt);
    });
    s.addEventListener("change", () => onchange(s.value));
    return s;
  }

  function fieldRow(parent, label, type, value, oninput) {
    if (type === "checkbox") return toggleRow(parent, label, value, oninput);
    const r = row(parent, label);
    const i = input(type, value, oninput);
    r.appendChild(i);
    return i;
  }

  function inSettingsTree(node) {
    for (let n = node; n; n = n.parentElement) {
      if (n.id === "settingsModal") return true;
      if (n.classList && n.classList.contains("settings-pane")) return true;
    }
    return false;
  }

  function selectRow(parent, label, options, value, onchange) {
    if (inSettingsTree(parent)) return enumRow(parent, label, options, value, onchange);
    const r = row(parent, label);
    r.appendChild(select(options, value, onchange));
  }

  function choiceUsesSegment(options) {
    if (!options || !options.length || options.length > 6) return false;
    return options.every((o) => String(o.label || "").length <= 20);
  }

  function choiceGrid(options, value, onchange) {
    const wrap = document.createElement("div");
    wrap.className = "wizard-board-grid settings-choice-grid";
    wrap.setAttribute("role", "listbox");
    let cur = value === undefined || value === null ? "" : String(value);
    const paint = () => {
      wrap.querySelectorAll(".wizard-board-cell").forEach((cell) => {
        const on = cell.dataset.value === cur;
        cell.classList.toggle("sel", on);
        cell.setAttribute("aria-selected", String(on));
      });
    };
    options.forEach((o) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "wizard-board-cell";
      cell.dataset.value = String(o.value);
      cell.setAttribute("role", "option");
      if (o.disabled) cell.disabled = true;
      if (o.title) cell.title = o.title;
      const title = document.createElement("span");
      title.className = "wizard-board-title";
      title.textContent = o.label;
      cell.appendChild(title);
      cell.addEventListener("click", () => {
        if (cell.disabled) return;
        const next = String(o.value);
        if (next === cur) return;
        cur = next;
        paint();
        onchange(o.value);
      });
      wrap.appendChild(cell);
    });
    paint();
    return wrap;
  }

  function choice(options, value, onchange, opts) {
    opts = opts || {};
    if (opts.settings && (options.length > 4 || !choiceUsesSegment(options))) {
      return choiceGrid(options, value, onchange);
    }
    const wrap = document.createElement("div");
    const seg = choiceUsesSegment(options);
    wrap.className = seg ? "choice-seg" : "choice-list";
    wrap.setAttribute("role", "listbox");
    let cur = value === undefined || value === null ? "" : String(value);
    const paint = () => {
      wrap.querySelectorAll(".choice-item").forEach((x) => {
        const on = x.dataset.value === cur;
        x.classList.toggle("active", on);
        x.setAttribute("aria-selected", String(on));
      });
    };
    options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice-item";
      b.dataset.value = String(o.value);
      b.textContent = o.label;
      if (o.disabled) b.disabled = true;
      if (o.title) b.title = o.title;
      b.setAttribute("role", "option");
      b.addEventListener("click", () => {
        if (b.disabled) return;
        const next = String(o.value);
        if (next === cur) return;
        cur = next;
        paint();
        onchange(o.value);
      });
      wrap.appendChild(b);
    });
    paint();
    return wrap;
  }

  function enumRow(parent, label, options, value, onchange) {
    const settings = inSettingsTree(parent);
    const useGrid = settings && (options.length > 4 || !choiceUsesSegment(options));
    const r = row(parent, label);
    r.classList.add("row-choice");
    if (useGrid) r.classList.add("row-choice-grid");
    r.appendChild(choice(options, value, onchange, { settings }));
  }

  function backlightPolarityRow(parent, hw, afterChange) {
    if (hw.display.blActiveLow === undefined) hw.display.blActiveLow = false;
    enumRow(
      parent,
      "BCK / BLK",
      [
        { value: "low", label: "LOW = 100%" },
        { value: "high", label: "HIGH = 100%" },
      ],
      hw.display.blActiveLow ? "low" : "high",
      (v) => {
        hw.display.blActiveLow = v === "low";
        if (afterChange) afterChange();
        else autosave();
      }
    );
  }

  function iconMonoOnly(ref) {
    if (!ref || ref === "none") return true;
    if ((window.LUCARNE_ICONS || {})[ref]) return true;
    if (ref.indexOf("tabler:") === 0 && window.LucarneTabler) {
      const ic = window.LucarneTabler.getIcon(ref.slice(7));
      if (ic && ic.rows) return true;
    }
    return false;
  }

  function iconStorageFieldOptions() {
    if (!LE.project.iconExportStorage) LE.project.iconExportStorage = "flash";
    const hw = window.LucarneHardware ? window.LucarneHardware.get(LE.project) : null;
    const sdEnabled = hw && hw.sd && hw.sd.enabled;
    const volEnabled = hw && hw.volume && hw.volume.enabled;
    const def = LE.project.iconExportStorage || "flash";
    const opts = [{ value: "", label: "Default (" + def + ")" }];
    opts.push({ value: "flash", label: "Project header (flash)" });
    if (sdEnabled) opts.push({ value: "sd", label: "SD card" });
    else opts.push({ value: "sd", label: "SD card — enable in Hardware" });
    if (volEnabled) opts.push({ value: "volume", label: "Internal partition (FFat)" });
    else opts.push({ value: "volume", label: "Internal partition — enable in Hardware" });
    return { opts, sdEnabled, volEnabled };
  }

  function appendIconStorageRow(parent, target, storageKey, ref) {
    if (!ref || ref === "none") return;
    if (iconMonoOnly(ref)) {
      const h = document.createElement("div");
      h.className = "hint";
      h.textContent = "Mono built-in icons always export to flash.";
      parent.appendChild(h);
      return;
    }
    const { opts, sdEnabled, volEnabled } = iconStorageFieldOptions();
    selectRow(parent, "Storage", opts, target[storageKey] || "", (v) => {
      if (v) target[storageKey] = v;
      else delete target[storageKey];
      markDirty();
      refreshDock();
    });
    const st = target[storageKey] || LE.project.iconExportStorage || "flash";
    if (st === "sd" && !sdEnabled) {
      const warn = document.createElement("div");
      warn.className = "hint hint-bad";
      warn.textContent = "SD disabled in Hardware — export falls back to flash.";
      parent.appendChild(warn);
    } else if (st === "volume" && !volEnabled) {
      const warn = document.createElement("div");
      warn.className = "hint hint-bad";
      warn.textContent = "Volume disabled in Hardware — export falls back to flash.";
      parent.appendChild(warn);
    }
  }

  function imageStorageFieldOptions() {
    const hw = window.LucarneHardware ? window.LucarneHardware.get(LE.project) : null;
    const volEnabled = hw && hw.volume && hw.volume.enabled;
    const opts = (window.LucarneAssets.IMAGE_STORAGE || []).slice();
    if (volEnabled) opts.push({ value: "volume", label: "Internal partition (FFat)" });
    else opts.push({ value: "volume", label: "Internal partition — enable in Hardware" });
    return { opts, volEnabled };
  }

  function appendImageStorageInspector(parent, imageId) {
    if (!imageId || !LE.project.images || !LE.project.images[imageId]) return;
    const img = LE.project.images[imageId];
    const { opts, volEnabled } = imageStorageFieldOptions();
    selectRow(parent, "Storage", opts, img.storage || "flash", (v) => {
      img.storage = v;
      if (v === "sd" && window.LucarneHardware) {
        img.source = window.LucarneHardware.sdDevicePath(LE.project, imageId, img.source);
      } else if (v === "volume" && window.LucarneHardware) {
        img.source = window.LucarneHardware.volumeDevicePath(LE.project, imageId, img.source);
      }
      markDirty();
      refreshDock();
    });
    if (img.storage === "sd") {
      fieldRow(parent, "SD path", "text", img.source || "", (v) => {
        img.source = v;
        markDirty();
      });
      const pathHint = document.createElement("div");
      pathHint.className = "hint";
      pathHint.textContent = "Device path on SD card.";
      parent.appendChild(pathHint);
    } else if (img.storage === "volume") {
      fieldRow(parent, "Volume path", "text", img.source || "", (v) => {
        img.source = v;
        markDirty();
      });
      const pathHint = document.createElement("div");
      if (!volEnabled) {
        pathHint.className = "hint hint-bad";
        pathHint.textContent = "Volume disabled in Hardware — binaries will not export.";
      } else {
        pathHint.className = "hint";
        pathHint.textContent = "Path on internal partition. Upload via Arduino FFat tool.";
      }
      parent.appendChild(pathHint);
    } else if (img.storage === "web") {
      fieldRow(parent, "URL", "text", img.source || "", (v) => {
        img.source = v;
        markDirty();
      });
    }
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
    if (ref.indexOf("emoji:") === 0 && window.LucarneFluentEmoji) {
      await window.LucarneFluentEmoji.ensureIcon(ref.slice(6));
      return;
    }
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
      toast("Icon load failed", "error");
      return;
    }
    if (opts.applyToScreen !== false && applyIconToDesigner(value)) {
      markDirty();
      refreshDock();
      switchDockTab("inspector");
      toast("Icon placed on screen", "success");
      return;
    }
    if (opts.applyToScreen !== false && mode !== "designer") {
      toast("Open designer to place icons on screen", "warn");
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
            ensureIconRefLoaded(ref).then(done).catch(() => toast("Icon load failed", "error"));
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
      if (window.LucarneFluentEmoji) await window.LucarneFluentEmoji.preloadProject(LE.project);
      requestRender();
      refreshMemoryBar();
    } catch (e) {
      console.warn("Icon preload failed", e);
      toast("Some icons could not be loaded: " + errorText(e) + ". They will show as placeholders.", "warn");
    }
  }

  const SECTION_COLLAPSE_KEY = "lucarne_section_collapsed";
  function loadCollapsedSections() {
    try {
      return JSON.parse(localStorage.getItem(SECTION_COLLAPSE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveCollapsedSections(map) {
    try {
      localStorage.setItem(SECTION_COLLAPSE_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function section(parent, title, action, opts) {
    opts = opts || {};
    if (inSettingsTree(parent)) {
      opts = Object.assign({}, opts, { collapsible: false, defaultOpen: true });
    }
    const sec = document.createElement("div");
    if (inSettingsTree(parent)) sec.classList.add("settings-section");
    sec.className = "section";
    const t = document.createElement("div");
    t.className = "section-title";
    const collapsible = opts.collapsible !== false;
    const chevron = document.createElement("span");
    chevron.className = "chevron";
    chevron.setAttribute("aria-hidden", "true");
    if (window.LucarneUiIcons) chevron.innerHTML = window.LucarneUiIcons.svg("chevronDown", { size: 12, stroke: 2.4 });
    if (collapsible) t.appendChild(chevron);
    const span = document.createElement("span");
    span.className = "section-label";
    span.textContent = title;
    t.appendChild(span);
    if (opts.doc && window.LucarneHelp && window.LucarneHelp.docUrl) {
      const a = document.createElement("a");
      a.className = "section-doc";
      a.href = window.LucarneHelp.docUrl(opts.doc);
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Open the " + title + " documentation";
      a.setAttribute("aria-label", "Documentation: " + title + " (opens in a new tab)");
      if (window.LucarneUiIcons) a.innerHTML = window.LucarneUiIcons.svg("book", { size: 13 });
      else a.textContent = "Doc";
      a.addEventListener("click", (ev) => ev.stopPropagation());
      a.addEventListener("keydown", (ev) => ev.stopPropagation());
      t.appendChild(a);
    }
    if (action) {
      action.addEventListener("click", (ev) => ev.stopPropagation());
      action.addEventListener("keydown", (ev) => ev.stopPropagation());
      t.appendChild(action);
    }
    sec.appendChild(t);
    const body = document.createElement("div");
    body.className = "section-body";
    body.id = "lc-sec-" + ++fieldIdSeq;
    sec.appendChild(body);
    if (collapsible) {
      const map = loadCollapsedSections();
      const defaultCollapsed = !opts.defaultOpen;
      const collapsed = Object.prototype.hasOwnProperty.call(map, title) ? map[title] : defaultCollapsed;
      if (collapsed) sec.classList.add("collapsed");
      t.setAttribute("role", "button");
      t.tabIndex = 0;
      t.setAttribute("aria-controls", body.id);
      t.setAttribute("aria-expanded", String(!collapsed));
      const toggle = () => {
        sec.classList.toggle("collapsed");
        const isCollapsed = sec.classList.contains("collapsed");
        t.setAttribute("aria-expanded", String(!isCollapsed));
        const m = loadCollapsedSections();
        m[title] = isCollapsed;
        saveCollapsedSections(m);
      };
      t.addEventListener("click", toggle);
      t.addEventListener("keydown", (ev) => {
        if (ev.target !== t) return;
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggle();
        }
      });
    } else {
      sec.classList.add("static");
    }
    parent.appendChild(sec);
    return body;
  }

  function btn(text, cls, onclick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn " + (cls || "");
    b.textContent = text;
    b.addEventListener("click", onclick);
    return b;
  }

  // Renders a compact "N items — Edit…" summary in the Inspector instead of
  // an inline card list, so screens with many menu/list/chart items don't
  // turn the dock into an endless scroll. The actual editable list lives in
  // a LucarneDialog, opened on demand.
  function itemsDialogSection(host, title, count, onOpen) {
    const sec = section(host, title, null, { defaultOpen: true, collapsible: false });
    const summary = document.createElement("div");
    summary.className = "hint";
    summary.textContent = count + (count === 1 ? " item" : " items");
    sec.appendChild(summary);
    const r = row(sec, "");
    r.appendChild(btn("Edit " + title.toLowerCase() + "\u2026", "primary tiny", onOpen));
    return sec;
  }

  function setupDockPanel() {
    const dock = $("dock");
    const stage = $("stage");
    if (!dock || !stage || !dock.parentElement) return;
    const resizer = document.createElement("div");
    resizer.className = "resizer";
    dock.parentElement.insertBefore(resizer, dock);
    const collapseBtn = document.createElement("button");
    collapseBtn.className = "btn panel-collapse";
    collapseBtn.title = "Toggle inspector panel";
    collapseBtn.setAttribute("aria-label", "Collapse inspector panel");
    collapseBtn.type = "button";
    collapseBtn.classList.add("dock-collapse");
    if (window.LucarneUiIcons) collapseBtn.innerHTML = window.LucarneUiIcons.svg("chevronRight", { size: 14 });
    const headerRow = dock.querySelector(".dockHeader");
    if (headerRow && headerRow.parentElement === dock) {
      dock.insertBefore(collapseBtn, headerRow);
    }
    const STORAGE_KEY = "lucarne_panel_dock";
    let pref = { width: 392, collapsed: false };
    try {
      pref = Object.assign(pref, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch (e) {}
    const min = 300;
    const max = 640;
    let basePref = Math.max(min, Math.min(max, pref.width));
    let width = basePref;
    function stageReserve() {
      const side = mode === "designer" && designer && designer.sidePanelsWidth ? designer.sidePanelsWidth() : 100;
      return 360 + side;
    }
    function viewportMax() {
      return Math.max(min, Math.min(max, window.innerWidth - stageReserve()));
    }
    function apply() {
      dock.style.setProperty("--dock-w", width + "px");
    }
    apply();
    if (pref.collapsed) dock.classList.add("collapsed");
    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, collapsed: dock.classList.contains("collapsed") }));
      } catch (e) {}
    }
    resizer.addEventListener("pointerdown", (ev) => {
      if (dock.classList.contains("collapsed")) return;
      ev.preventDefault();
      resizer.classList.add("active");
      const sx = ev.clientX;
      const startW = width;
      function move(e) {
        width = Math.max(min, Math.min(max, startW - (e.clientX - sx)));
        apply();
      }
      function up() {
        resizer.classList.remove("active");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        basePref = width;
        persist();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
    function syncCollapseBtn() {
      const collapsed = dock.classList.contains("collapsed");
      collapseBtn.setAttribute("aria-expanded", String(!collapsed));
      collapseBtn.setAttribute("aria-label", collapsed ? "Expand inspector panel" : "Collapse inspector panel");
      collapseBtn.title = collapsed ? "Expand inspector panel" : "Collapse inspector panel";
      if (window.LucarneUiIcons) {
        collapseBtn.innerHTML = window.LucarneUiIcons.svg(collapsed ? "chevronLeft" : "chevronRight", { size: 14 });
      }
    }
    syncCollapseBtn();
    collapseBtn.addEventListener("click", () => {
      dock.classList.toggle("collapsed");
      syncCollapseBtn();
      persist();
      requestRender();
    });
    function fitWidth() {
      width = Math.min(basePref, viewportMax());
      apply();
    }
    window.addEventListener("resize", fitWidth);
    dockFit = fitWidth;
    fitWidth();

    const drawerMq = window.matchMedia("(max-width: 1024px)");
    const toggleBtn = $("btnDockToggle");
    const closeBtn = $("btnDockClose");
    const workspace = dock.parentElement;
    function setDrawer(open) {
      const drawer = drawerMq.matches;
      const isOpen = drawer && open;
      dock.classList.toggle("drawer-open", isOpen);
      workspace.classList.toggle("drawer-open", isOpen);
      dock.inert = drawer && !isOpen;
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", String(isOpen));
      if (isOpen && open === "focus") {
        const first = dock.querySelector("#dockBody input, #dockBody select, #dockBody button, #dockBody textarea");
        if (first) first.focus({ preventScroll: true });
      }
    }
    drawerOpen = (focus) => setDrawer(focus ? "focus" : true);
    drawerClose = () => {
      if (dock.classList.contains("drawer-open")) {
        setDrawer(false);
        if (toggleBtn && dock.contains(document.activeElement)) toggleBtn.focus();
      }
    };
    if (toggleBtn) toggleBtn.addEventListener("click", () => drawerOpen(true));
    if (closeBtn) closeBtn.addEventListener("click", drawerClose);
    stage.addEventListener(
      "pointerdown",
      (ev) => {
        if (!drawerMq.matches || !dock.classList.contains("drawer-open")) return;
        if (ev.target.closest && ev.target.closest("#btnDockToggle")) return;
        setDrawer(false);
      },
      true
    );
    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape" || !drawerMq.matches || !dock.classList.contains("drawer-open")) return;
      if (document.querySelector(".modal:not([hidden])") || document.querySelector(".tour-root")) return;
      drawerClose();
    });
    drawerMq.addEventListener("change", () => {
      setDrawer(false);
      fitWidth();
      requestRender();
    });
    setDrawer(false);
  }

  let dockFit = () => {};
  let drawerOpen = () => {};
  let drawerClose = () => {};

  function revealInspector() {
    drawerOpen(false);
  }

  let settingsTab = "theme";

  function switchDockTab(tab) {
    // The dock now only ever shows the Inspector; every other former dock
    // tab lives in the Project settings dialog instead.
    if (!tab || tab === "inspector") {
      closeProjectSettings();
      return;
    }
    openProjectSettings(tab);
  }

  function openProjectSettings(tab) {
    if (!dom.settingsModal) return;
    if (tab) settingsTab = tab;
    document.querySelectorAll(".settingsTab").forEach((b) => {
      const on = b.dataset.tab === settingsTab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    ["theme", "fonts", "hardware", "assets", "data"].forEach((t) => {
      const pane = $("tab-" + t);
      if (pane) pane.hidden = t !== settingsTab;
    });
    if (dom.settingsModal.hidden) {
      dom.settingsModal.hidden = false;
      const card = dom.settingsModal.querySelector(".modal-card");
      const activeTab = dom.settingsModal.querySelector(".settingsTab.active");
      if (card && DLG && DLG.trapFocus) settingsRelease = DLG.trapFocus(card, { initialFocus: activeTab || undefined });
    }
  }

  let settingsRelease = null;

  function closeProjectSettings() {
    if (!dom.settingsModal || dom.settingsModal.hidden) return;
    dom.settingsModal.hidden = true;
    const release = settingsRelease;
    settingsRelease = null;
    if (release) release();
  }

  function refreshMemoryBar() {
    if (!dom.memoryBar || !window.LucarneMemory) return;
    const est = window.LucarneMemory.estimate(LE);
    const fmt = window.LucarneMemory.formatBytes;
    const flashCls = est.flash.pct >= 95 ? " mem-over" : est.flash.pct >= 80 ? " mem-warn" : "";
    const intCls = est.internal.pct >= 95 ? " mem-over" : est.internal.pct >= 80 ? " mem-warn" : "";
    const psCls = est.psram.pct >= 95 ? " mem-over" : est.psram.pct >= 80 ? " mem-warn" : "";
    const scheme = est.board.schemeLabel || est.board.schemeId || "";
    const intLabel = est.internal.label ? est.internal.label.split("/")[0] : "data";
    const intLimit = est.internal.limit ? fmt(est.internal.limit) : "n/a";
    const intPct = est.internal.pct !== null ? est.internal.pct + "%" : "—";
    dom.memoryBar.innerHTML =
      '<span class="mem-ver">Lucarne ' +
      est.version +
      "</span>" +
      '<span class="mem-item' +
      flashCls +
      '">App <strong>' +
      fmt(est.flash.used) +
      "</strong> / " +
      fmt(est.flash.limit) +
      " (" +
      (est.flash.pct !== null ? est.flash.pct + "%" : "—") +
      ")</span>" +
      '<span class="mem-item' +
      intCls +
      '">' +
      intLabel +
      " <strong>" +
      fmt(est.internal.used) +
      "</strong> / " +
      intLimit +
      " (" +
      intPct +
      ")</span>" +
      '<span class="mem-item' +
      psCls +
      '">PSRAM ~<strong>' +
      fmt(est.psram.used) +
      "</strong>" +
      (est.psram.limit ? " / " + fmt(est.psram.limit) : "") +
      "</span>" +
      (est.sd && est.sd.used
        ? '<span class="mem-item">SD ~<strong>' + fmt(est.sd.used) + "</strong></span>"
        : "") +
      (est.display
        ? '<span class="mem-item' +
          (est.display.overBudget ? " mem-over" : "") +
          '" title="' +
          (est.display.overBudget ? "Full framebuffer exceeds the profile budget" : "Display buffer") +
          '">' +
          est.display.profile +
          " · " +
          est.display.mode +
          " <strong>" +
          fmt(est.display.bytes + est.display.richBytes) +
          "</strong></span>"
        : "") +
      '<span class="mem-item mem-scheme">' +
      (est.board.boardId || "esp32") +
      " · " +
      scheme +
      "</span>";
    if (est.alerts && est.alerts.length) {
      const key = est.alerts.join("|");
      if (key !== memoryAlertShown) {
        memoryAlertShown = key;
        toast(est.alerts[0], "warn");
      }
    } else {
      memoryAlertShown = "";
    }
  }

  function refreshInspector() {
    buildInspector();
  }

  function refreshDock() {
    buildInspector();
    buildTheme();
    buildFonts();
    buildHardware();
    buildAssets();
    buildData();
  }

  /* ---------- Inspector ---------- */
  function buildInspector() {
    const host = dom.tabInspector;
    host.innerHTML = "";
    if (mode === "designer") return buildDesignerInspector(host);
    if (mode === "simulate") {
      const sec = section(host, "Simulate", null, { defaultOpen: true, doc: "studio" });
      const touch = LE.project.input && LE.project.input.type === "touch";
      const vkb = !!(LE.project.input && LE.project.input.virtualKeyboard);
      const h = document.createElement("div");
      h.className = "hint";
      h.textContent = touch
        ? "Touch mode: tap menus, buttons, fields and sliders on the canvas."
        : "Buttons mode: use the pad to move focus, OK to activate. Fields open the virtual keyboard when enabled.";
      sec.appendChild(h);
      if (vkb) {
        const h2 = document.createElement("div");
        h2.className = "hint";
        h2.textContent = "Virtual keyboard: focus a text field and press OK, then use the pad on keys. Press OK on the keyboard to validate.";
        sec.appendChild(h2);
      }
      return;
    }
    if (LE.graphSel && LE.graphSel.type === "node") return buildNodeInspector(host);
    if (LE.graphSel && LE.graphSel.type === "link") return buildLinkInspector(host);
    return buildProjectInspector(host);
  }

  function buildProjectInspector(host) {
    const sec = section(host, "Project", btn("+ Screen", "tiny primary", addScreen), { defaultOpen: true, doc: "studio" });
    const opts = LE.project.screens.map((s) => ({ value: s.id, label: s.name || s.id }));
    selectRow(sec, "Start", opts, LE.project.startScreen, (v) => {
      LE.project.startScreen = v;
      markDirty();
    });
    selectRow(
      sec,
      "Transition",
      transitionOptions(false),
      LE.project.transition.default,
      (v) => {
        LE.project.transition.default = v;
        markDirty("Change transition");
        refreshInspector();
      }
    );
    transitionHint(sec, LE.project.transition.default);
    fieldRow(sec, "Duration", "number", LE.project.transition.durationMs, (v) => {
      LE.project.transition.durationMs = parseInt(v, 10) || 0;
      autosave();
    });

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Double-click a screen to design it. Drag an item pin onto a screen to link. Hardware pins: Hardware tab.";
    host.appendChild(hint);
  }

  function buildUiSourceSection(host) {
    if (!LE.project.uiSource) LE.project.uiSource = S.defaultUiSource();
    const src = LE.project.uiSource;
    const sec = section(host, "UI source", null, { doc: "live" });
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent =
      "Where the UI is loaded from at runtime or in Live Preview. Embedded uses this project; URL and SD fetch external JSON.";
    sec.appendChild(hint);

    enumRow(
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
        btn("Load from URL", "primary tiny", (ev) => {
          const b = ev.currentTarget;
          confirmReplaceProject("Load project from URL", () => busy(b, loadFromUrl, "Loading\u2026"));
        })
      );
    } else if (src.mode === "sd") {
      fieldRow(sec, "SD path", "text", src.sdPath || "/ui.lucarne.json", (v) => {
        src.sdPath = v.trim() || "/ui.lucarne.json";
        autosave();
      });
      const r = row(sec, "");
      r.appendChild(
        btn("Load from SD", "primary tiny", (ev) => {
          const b = ev.currentTarget;
          confirmReplaceProject("Load project from SD", () => busy(b, loadFromSd, "Loading\u2026"));
        })
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
    const sec = section(host, "Screen", null, { defaultOpen: true });
    fieldRow(sec, "Name", "text", s.name, (v) => {
      s.name = v;
      markDirty("Rename screen");
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
    br.appendChild(btn("Duplicate", "", () => duplicateScreen(s.id)));
    br.appendChild(
      btn("Delete", "danger", () => {
        if (LE.project.screens.length <= 1) return toast("Keep at least one screen", "warn");
        LE.project.screens = LE.project.screens.filter((x) => x.id !== s.id);
        LE.project.screens.forEach((sc) =>
          sc.widgets.forEach((w) => {
            if (w.type === "menu") (w.items || []).forEach((it) => {
              if (it.target === s.id) it.target = "";
            });
            if (w.type === "button" && w.target === s.id) w.target = "";
            if (w.type === "shape" && w.target === s.id) w.target = "";
          })
        );
        if (LE.project.startScreen === s.id) LE.project.startScreen = LE.project.screens[0].id;
        LE.graphSel = null;
        markDirty("Delete screen");
        refreshDock();
        toastUndo("Screen \u201c" + (s.name || s.id) + "\u201d deleted");
      })
    );

    const hasMenu = s.widgets.some((w) => w.type === "menu");
    if (hasMenu) {
      const navHint = document.createElement("div");
      navHint.className = "hint";
      navHint.textContent = "Navigation input pins are configured in the Hardware tab.";
      host.appendChild(navHint);
    }

    const splashSec = section(host, "Splash screen", null, { defaultOpen: true });
    if (!s.splash) s.splash = { enabled: false, durationMs: 2000, showProgress: true, nextScreen: "" };
    const sp = s.splash;
    fieldRow(splashSec, "Splash", "checkbox", sp.enabled, (v) => {
      sp.enabled = v;
      markDirty();
    });
    fieldRow(splashSec, "Duration ms", "number", sp.durationMs || 2000, (v) => {
      sp.durationMs = parseInt(v, 10) || 0;
      autosave();
    });
    fieldRow(splashSec, "Progress bar", "checkbox", sp.showProgress !== false, (v) => {
      sp.showProgress = v;
      autosave();
    });
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
    if (!inp.buttons) inp.buttons = S.defaultInput().buttons;
    if (inp.buttons.left === undefined) inp.buttons.left = -1;
    if (inp.buttons.right === undefined) inp.buttons.right = -1;
    const sec = section(host, "Controls", null, { doc: "hardware" });
    enumRow(
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
      const pinHint = document.createElement("div");
      pinHint.className = "hint";
      pinHint.textContent = "Use -1 when that button is not fitted. Confirm and Back are optional.";
      sec.appendChild(pinHint);
      fieldRow(sec, "Up", "number", b.up, (v) => ((b.up = +v), autosave()));
      fieldRow(sec, "Down", "number", b.down, (v) => ((b.down = +v), autosave()));
      fieldRow(sec, "Left", "number", b.left, (v) => ((b.left = +v), autosave()));
      fieldRow(sec, "Right", "number", b.right, (v) => ((b.right = +v), autosave()));
      fieldRow(sec, "Confirm", "number", b.ok, (v) => ((b.ok = +v), autosave()));
      fieldRow(sec, "Back", "number", b.back, (v) => ((b.back = +v), autosave()));
    } else if (inp.type === "encoder") {
      const e = inp.encoder;
      fieldRow(sec, "A pin", "number", e.a, (v) => ((e.a = +v), autosave()));
      fieldRow(sec, "B pin", "number", e.b, (v) => ((e.b = +v), autosave()));
      fieldRow(sec, "Btn pin", "number", e.btn, (v) => ((e.btn = +v), autosave()));
    } else {
      const h = document.createElement("div");
      h.className = "hint";
      h.textContent = "Touch: configure controller in Hardware. In Simulate mode, tap menus, buttons, fields and sliders directly on the canvas.";
      sec.appendChild(h);
    }
    if (inp.type === "touch" || (LE.project.hardware && LE.project.hardware.keyboard)) {
      fieldRow(sec, "Virtual keyboard", "checkbox", !!inp.virtualKeyboard, (v) => {
        inp.virtualKeyboard = v;
        if (LE.project.hardware && LE.project.hardware.keyboard) {
          LE.project.hardware.keyboard.enabled = v;
        }
        autosave();
        refreshDock();
      });
    }
    fieldRow(sec, "Active low", "checkbox", inp.activeLow, (v) => ((inp.activeLow = v), autosave()));
  }

  function formatKb(bytes) {
    if (window.LucarneMemory && window.LucarneMemory.formatBytes) return window.LucarneMemory.formatBytes(bytes);
    return Math.round(bytes / 1024) + " KB";
  }

  function buildHalSection(host, hw, family) {
    const H = window.LucarneHardware;
    if (!H || !H.resolveHalProfile) return;
    if (!hw.hal) hw.hal = H.defaultHardware().hal;
    const hal = hw.hal;
    const prof = H.resolveHalProfile(LE.project, family);
    const noColorBuffer = family === "oled_mono" || family === "matrix_lcd";
    const sec = section(host, "Performance", null, { doc: "hardware" });

    const apply = (label) => {
      markDirty(label);
      refreshDock();
    };

    enumRow(
      sec,
      "Backend",
      [
        { value: "auto", label: "Auto" },
        { value: "arduino", label: "Arduino" },
        { value: "espidf", label: "ESP-IDF" },
        { value: "stm32cube", label: "STM32Cube" },
        { value: "wch", label: "WCH" },
      ],
      hal.backend || "auto",
      (v) => {
        hal.backend = v;
        apply("Change HAL backend");
      }
    );

    enumRow(
      sec,
      "UI profile",
      [{ value: "auto", label: "Auto (" + prof.uiProfile + ")" }].concat(
        H.UI_PROFILES.map((p) => ({ value: p, label: p }))
      ),
      hal.uiProfile || "auto",
      (v) => {
        hal.uiProfile = v;
        apply("Change UI profile");
      }
    );

    if (!noColorBuffer) {
      enumRow(
        sec,
        "Buffer mode",
        [{ value: "auto", label: "Auto (" + prof.autoBufferMode + ")" }].concat(
          ["Full", "Partial", "None"].map((m) => ({ value: m, label: m }))
        ),
        hal.bufferMode || "auto",
        (v) => {
          hal.bufferMode = v;
          apply("Change buffer mode");
        }
      );
    }

    if (!noColorBuffer) {
      const stripeInput = fieldRow(sec, "Stripe lines (0 = auto)", "number", hal.stripeLines | 0, (v) => {
        hal.stripeLines = Math.max(0, Math.min(480, parseInt(v, 10) || 0));
        markDirty("Change stripe lines");
      });
      stripeInput.addEventListener("change", () => refreshDock());
    }

    const richCapable = prof.uiProfile === "Psram" || prof.uiProfile === "MipiHighRes";
    const richInput = fieldRow(sec, "Allow rich transitions", "checkbox", prof.allowRichTransitions, (v) => {
      hal.allowRichTransitions = v;
      if (!v) hal.preferRichTransitions = false;
      apply("Change rich transitions");
    });
    richInput.disabled = !richCapable;
    const preferInput = fieldRow(sec, "Prefer rich transitions", "checkbox", prof.preferRichTransitions, (v) => {
      hal.preferRichTransitions = v;
      apply("Change rich transitions");
    });
    preferInput.disabled = !prof.allowRichTransitions || prof.bufferMode !== "Full";
    fieldRow(sec, "Prefer HW rotation", "checkbox", prof.preferHwRotate, (v) => {
      hal.preferHwRotate = v;
      apply("Change HW rotation");
    });
    fieldRow(sec, "HW JPEG decode", "checkbox", prof.jpegDecodeHw, (v) => {
      hal.jpegDecodeHw = v;
      apply("Change JPEG decode");
    });

    const summary = document.createElement("div");
    summary.className = "hint";
    let ram = "";
    if (prof.bufferMode === "Full") ram = "framebuffer " + formatKb(prof.fullBytes);
    else if (prof.bufferMode === "Partial") ram = prof.stripeLines + " lines = " + formatKb(prof.stripeBytes);
    else ram = "no color buffer";
    summary.textContent =
      "Resolved: profile " +
      prof.uiProfile +
      ", mode " +
      prof.bufferMode +
      " (" +
      ram +
      "), budget " +
      formatKb(prof.budget) +
      ", SRAM " +
      prof.sramKb +
      " KB" +
      (prof.psramMb ? ", PSRAM " + prof.psramMb + " MB" : "") +
      ".";
    sec.appendChild(summary);

    if (prof.psramDowngraded) {
      const warn = document.createElement("div");
      warn.className = "hint hint-warn";
      warn.textContent =
        "Profile " +
        prof.requestedProfile +
        " needs PSRAM, but the board declares none: the firmware falls back to LowRam at boot.";
      sec.appendChild(warn);
    }

    if (prof.fullOverBudget) {
      const warn = document.createElement("div");
      warn.className = "hint hint-warn";
      warn.textContent =
        "Full framebuffer (" +
        formatKb(prof.fullBytes) +
        ") exceeds the profile budget (" +
        formatKb(prof.budget) +
        "): the firmware switches to Partial at boot.";
      sec.appendChild(warn);
    }

    const doc = document.createElement("div");
    doc.className = "hint";
    doc.textContent = H.PROFILE_DOC_FR[prof.uiProfile] || "";
    sec.appendChild(doc);
    const bufDoc = document.createElement("div");
    bufDoc.className = "hint";
    bufDoc.textContent = H.BUFFER_DOC_FR[prof.bufferMode] || "";
    sec.appendChild(bufDoc);
  }

  function transitionOptions(withInherit, inheritLabel) {
    const H = window.LucarneHardware;
    const opts = [];
    if (withInherit) opts.push({ value: "Inherit", label: inheritLabel || "Inherit" });
    S.TRANSITIONS.forEach((t) => {
      const sup = H && H.transitionSupport ? H.transitionSupport(LE.project, t) : { ok: true };
      const o = { value: t, label: t };
      if (!sup.ok) {
        o.disabled = true;
        o.label = t + " (\u2192 " + (sup.effective || "None") + ")";
        o.title = sup.reason;
      }
      opts.push(o);
    });
    return opts;
  }

  function transitionHint(parent, value) {
    const H = window.LucarneHardware;
    if (!H || !H.transitionSupport) return;
    const sup = H.transitionSupport(LE.project, value || "Inherit", { resolveInherit: true });
    if (sup.ok) return;
    const name = H.resolveTransitionName ? H.resolveTransitionName(LE.project, value) : value;
    const h = document.createElement("div");
    h.className = "hint hint-warn";
    h.textContent =
      (sup.inherited ? "Inherited transition " + name + " is not supported. " : "") +
      sup.reason +
      " Runs as: " +
      sup.effective +
      ".";
    parent.appendChild(h);
  }

  function buildModuleSection(parent) {
    const M = window.LucarneModules;
    const sec = section(parent, "Module", null, { doc: "hardware" });
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Start from a known board. The fields below stay editable. Reapply the module to restore its wiring.";
    sec.appendChild(hint);
    const current = LE.project.moduleId || "";
    const opts = [{ value: "", label: "Custom" }].concat(M ? M.list().map((m) => ({ value: m.id, label: m.label })) : []);
    enumRow(sec, "Board module", opts, current, (v) => {
      if (!v) {
        LE.project.moduleId = "";
        markDirty("Clear module");
        refreshDock();
        return;
      }
      if (M) M.apply(LE.project, v);
      markDirty("Apply module");
      syncToolbar();
      refreshMemoryBar();
      refreshDock();
      sendLiveHwConfig();
    });
    if (current && M && M.summary) {
      const box = document.createElement("div");
      box.className = "module-summary";
      M.summary(LE.project).forEach((line) => {
        const p = document.createElement("p");
        p.textContent = line;
        box.appendChild(p);
      });
      sec.appendChild(box);
    }
  }

  function buildHardware() {
    const host = dom.tabHardware;
    if (!host || !window.LucarneHardware) return;
    host.innerHTML = "";
    window.LucarneHardware.migrate(LE.project);
    const hw = window.LucarneHardware.get(LE.project);
    if (!hw.board) hw.board = window.LucarneHardware.defaultHardware().board;
    const H = window.LucarneHardware;
    const dev = S.device(LE.project);
    const family = H.displayFamily(LE.project);
    const caps = S.deviceCaps(LE.project);
    const B = window.LucarneBoards;
    const slotModule = document.createElement("div");
    const slotScreen = document.createElement("div");
    const slotControls = document.createElement("div");
    const slotBus = document.createElement("div");
    const slotPerformance = document.createElement("div");
    const slotBoard = document.createElement("div");
    const slotRest = document.createElement("div");
    [slotModule, slotScreen, slotControls, slotBus, slotPerformance, slotBoard, slotRest].forEach((slot) => {
      slot.className = "settings-slot";
    });
    buildModuleSection(slotModule);

    const boardSec = section(slotBoard, "Board", null, { doc: "hardware" });
    const boardHint = document.createElement("div");
    boardHint.className = "hint";
    boardHint.textContent =
      "Match your Arduino IDE board and flash layout / partition scheme. Import boards.txt + partition CSVs from your ESP32 package to refresh the list.";
    boardSec.appendChild(boardHint);
    if (window.LucarneGpioWizard) {
      const wizRow = row(boardSec, "");
      wizRow.appendChild(
        btn("GPIO configuration wizard", "tiny primary", () => window.LucarneGpioWizard.open(LE))
      );
    }
    if (window.LucarneDrc) {
      const drcRow = row(boardSec, "");
      drcRow.appendChild(
        btn("Run design rule check (DRC)", "tiny", () => window.LucarneDrc.openPanel(LE))
      );
    }
    if (B) {
      const isRp = B.isRpBoard ? B.isRpBoard(hw.board.target) : false;
      const feasCheck = window.LucarneMemory && window.LucarneMemory.boardFeasibility;
      const boardOpts = B.boardIds().map((id) => {
        const o = { value: id, label: B.boardLabel ? B.boardLabel(id) : id };
        if (feasCheck && id !== hw.board.target) {
          const fr = feasCheck(LE, id);
          if (!fr.ok) {
            o.disabled = true;
            o.label = o.label + " — infeasible";
            o.title = fr.reasons.join(" ");
          }
        }
        return o;
      });
      enumRow(boardSec, "Board", boardOpts, hw.board.target || "esp32s3", (v) => {
        if (feasCheck) {
          const fr = feasCheck(LE, v, hw.board.schemeId);
          if (!fr.ok) {
            DLG.confirm("Board may not fit this project", fr.reasons.map(escapeHtml).join("<br>") + "<br><br>Switch anyway?", {
              okLabel: "Switch board",
              onConfirm: () => {
                applyBoardTarget(v);
                refreshDock();
              },
            });
            refreshDock();
            return;
          }
        }
        applyBoardTarget(v);
        refreshDock();
      });
      function applyBoardTarget(v) {
        hw.board.target = v;
        const rp = B.isRpBoard ? B.isRpBoard(v) : false;
        const list = B.schemeList(v);
        if (list.length && !B.getScheme(v, hw.board.schemeId)) hw.board.schemeId = list[0].id;
        if (v === "esp32p4" && (!hw.board.psramMb || hw.board.psramMb < 8)) hw.board.psramMb = 32;
        if (rp) {
          hw.board.psramMb = 0;
          hw.board.sramKb = B.defaultSramKb(v);
        }
        markDirty("Change board");
      }
      const schemes = B.schemeList(hw.board.target || "esp32s3");
      enumRow(
        boardSec,
        isRp ? "Flash layout" : "Partition",
        schemes.map((s) => ({ value: s.id, label: s.label })),
        hw.board.schemeId || schemes[0].id,
        (v) => {
        hw.board.schemeId = v;
        if (B && window.LucarneHardware && window.LucarneHardware.syncVolumeFromScheme) {
          const scheme = B.getScheme(hw.board.target, v);
          if (scheme) window.LucarneHardware.syncVolumeFromScheme(hw, scheme);
        }
        markDirty("Change flash layout");
        refreshDock();
        refreshMemoryBar();
        }
      );
      if (isRp) {
        const psramHint = document.createElement("div");
        psramHint.className = "hint";
        psramHint.textContent = "RP2040/RP2350 boards have no PSRAM in this library — framebuffers stay in SRAM.";
        boardSec.appendChild(psramHint);
      } else {
        fieldRow(boardSec, "PSRAM (MB)", "number", hw.board.psramMb || 0, (v) => {
          hw.board.psramMb = Math.max(0, parseInt(v, 10) || 0);
          markDirty("Change PSRAM");
          refreshMemoryBar();
        });
      }
      const imp = row(boardSec, "");
      const impInput = document.createElement("input");
      impInput.type = "file";
      impInput.multiple = true;
      impInput.accept = ".txt,.csv";
      impInput.hidden = true;
      imp.appendChild(btn("Import Arduino partitions", "tiny", () => impInput.click()));
      boardSec.appendChild(impInput);
      impInput.addEventListener("change", async () => {
        if (!impInput.files || !impInput.files.length) return;
        try {
          await B.importArduinoFiles(impInput.files);
          toast("Partition catalog updated", "success");
          refreshDock();
        } catch (e) {
          toast("Import failed: include boards.txt and .csv files", "error");
        }
        impInput.value = "";
      });
    }

    const famSec = section(slotScreen, "Screen", null, { doc: "hardware" });
    const deviceOpts = Object.keys(S.DEVICES).map((id) => {
      const d = S.DEVICES[id];
      const supported = S.deviceFirmwareSupported(d);
      return {
        value: id,
        label: d.label,
        disabled: !supported,
        title: supported ? "" : "No firmware driver for this panel yet",
      };
    });
    enumRow(famSec, "Panel preset", deviceOpts, LE.project.deviceId, (v) => {
      if (v === LE.project.deviceId) return;
      LE.project.deviceId = v;
      const d = S.device(LE.project);
      LE.project.panelWidth = d.w;
      LE.project.panelHeight = d.h;
      H.applyDeviceDefaults(LE.project, d);
      markDirty("Change display preset");
      syncToolbar();
      refreshMemoryBar();
      refreshDock();
    });
    const logical = S.dims(LE.project);
    enumRow(
      famSec,
      "Rotation",
      [
        { value: "0", label: "0°" },
        { value: "1", label: "90°" },
        { value: "2", label: "180°" },
        { value: "3", label: "270°" },
      ],
      String(LE.project.rotation | 0),
      (v) => {
        applyRotation(parseInt(v, 10) || 0);
        refreshDock();
      }
    );
    const rotHint = document.createElement("div");
    rotHint.className = "hint";
    rotHint.textContent =
      "Logical canvas " +
      logical.w +
      "x" +
      logical.h +
      ". Native panel " +
      (LE.project.panelWidth || dev.w) +
      "x" +
      (LE.project.panelHeight || dev.h) +
      ".";
    famSec.appendChild(rotHint);
    const famHint = document.createElement("div");
    famHint.className = "hint";
    const famLabels = {
      spi_rgb: "SPI RGB565 color TFT (ST77xx). Shared SPI bus with optional SD.",
      oled_mono:
        "Monochrome OLED (SSD1306/SSD1315/SH1106). I2C or SPI — firmware is 1-bit; Studio preview can tint dual-color panels by fixed Y bands.",
      matrix_lcd: "HD44780 character LCD (parallel 4-bit). Designer uses a pixel canvas for layout only.",
      mipi_dsi: "MIPI DSI panel (ESP32-P4). Native DSI touch supported. Video/MPEG-4 is a separate firmware path.",
    };
    famHint.textContent = (dev.label || dev.driver || family) + " — " + (famLabels[family] || famLabels.spi_rgb);
    famSec.appendChild(famHint);
    if (!caps.images) {
      const capHint = document.createElement("div");
      capHint.className = "hint";
      capHint.textContent =
        family === "oled_mono"
          ? "Monochrome panel: no RGB565 image widgets. USB Live sends a 1-bit stream (flash LucarnePreviewOled receiver, Safe or Standard speed)."
          : "This display profile does not support RGB565 image widgets.";
      famSec.appendChild(capHint);
    }
    if (dev.p4Rev === "v3.x") {
      const revHint = document.createElement("div");
      revHint.className = "hint hint-warn";
      revHint.textContent = "Requires ESP32-P4 chip revision v3.0 or later (CONFIG_ESP_REV_MIN_FULL=300).";
      famSec.appendChild(revHint);
    }
    if (dev.panelId) {
      const pidHint = document.createElement("div");
      pidHint.className = "hint";
      pidHint.textContent =
        "Waveshare " +
        dev.panelId +
        (dev.lcdIc ? " · LCD " + dev.lcdIc : "") +
        (dev.touchIc ? " · touch " + dev.touchIc : "") +
        (dev.idfDriver ? " · IDF waveshare/" + dev.idfDriver : "") +
        (dev.orientation ? " · " + dev.orientation : "");
      famSec.appendChild(pidHint);
    }

    buildHalSection(slotPerformance, hw, family);

    if (H.needsSpiBus(LE.project)) {
    const spiSec = section(slotBus, "Bus and SD");
    const spiHint = document.createElement("div");
    spiHint.className = "hint";
    spiHint.textContent =
      family === "spi_rgb" || (family === "oled_mono" && dev.bus === "spi")
        ? "Display and SD share MOSI, MISO and SCLK. Each device keeps its own CS and its own clock."
        : "SD card SPI bus (display uses another interface).";
    spiSec.appendChild(spiHint);
    fieldRow(spiSec, "MOSI", "number", hw.spi.mosi, (v) => {
      hw.spi.mosi = +v;
      autosave();
      sendLiveHwConfig();
    });
    fieldRow(spiSec, "MISO", "number", hw.spi.miso, (v) => {
      hw.spi.miso = +v;
      autosave();
      sendLiveHwConfig();
    });
    fieldRow(spiSec, "SCLK", "number", hw.spi.sclk, (v) => {
      hw.spi.sclk = +v;
      autosave();
      sendLiveHwConfig();
    });
    if (family === "spi_rgb" || (family === "oled_mono" && dev.bus === "spi")) {
      fieldRow(spiSec, "Display CS", "number", hw.display.cs, (v) => {
        hw.display.cs = +v;
        autosave();
        sendLiveHwConfig();
      });
      fieldRow(spiSec, "Display SPI Hz", "number", hw.display.spiHz, (v) => {
        hw.display.spiHz = parseInt(v, 10) || 0;
        autosave();
        sendLiveHwConfig();
      });
    }
    if (family === "spi_rgb") {
      enumRow(
        spiSec,
        "SPI mode",
        [
          { value: "0", label: "0" },
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
        ],
        String(hw.display.spiMode),
        (v) => {
          hw.display.spiMode = parseInt(v, 10) || 0;
          autosave();
          sendLiveHwConfig();
        }
      );
    }
    }

    const oledI2c = family === "oled_mono" && dev.bus !== "spi";
    const touchI2c = hw.touch.enabled && hw.touch.kind && hw.touch.kind.indexOf("i2c_") === 0;
    if (oledI2c || touchI2c) {
      const i2cLabel = oledI2c && touchI2c ? "I2C bus (OLED + touch, shared)" : oledI2c ? "I2C bus (OLED)" : "I2C bus (touch)";
      const i2cSec = section(slotBus, i2cLabel);
      fieldRow(i2cSec, "SDA", "number", hw.i2c.sda, (v) => {
        hw.i2c.sda = +v;
        autosave();
      });
      fieldRow(i2cSec, "SCL", "number", hw.i2c.scl, (v) => {
        hw.i2c.scl = +v;
        autosave();
      });
      fieldRow(i2cSec, "Clock Hz", "number", hw.i2c.hz, (v) => {
        hw.i2c.hz = parseInt(v, 10) || 400000;
        autosave();
      });
    }
    if (oledI2c) {
      const oledSec = section(slotScreen, "OLED");
      fieldRow(oledSec, "I2C address", "text", "0x" + (hw.oled.addr || 0x3c).toString(16), (v) => {
        const n = parseInt(String(v).replace(/^0x/i, ""), 16);
        hw.oled.addr = Number.isFinite(n) ? n : 0x3c;
        autosave();
      });
      fieldRow(oledSec, "RST pin", "number", hw.oled.rst, (v) => {
        hw.oled.rst = +v;
        autosave();
      });
      fieldRow(oledSec, "Invert", "checkbox", !!hw.oled.invert, (v) => {
        hw.oled.invert = v;
        autosave();
        requestRender();
      });
      const variantIds = S.oledPanelVariantIdsForDevice(dev);
      if (variantIds.length > 1) {
        const variantOpts = variantIds.map((id) => ({
          value: id,
          label: (S.oledPanelVariantDef(id) && S.oledPanelVariantDef(id).label) || id,
        }));
        selectRow(oledSec, "Panel tint (preview)", variantOpts, S.resolveOledPanelVariantId(LE.project), (v) => {
          hw.oled.panelVariant = v;
          autosave();
          requestRender();
        });
      }
    } else if (family === "matrix_lcd") {
      const matSec = section(slotScreen, "HD44780 parallel (4-bit)");
      fieldRow(matSec, "RS", "number", hw.matrix.rs, (v) => {
        hw.matrix.rs = +v;
        autosave();
      });
      fieldRow(matSec, "EN", "number", hw.matrix.en, (v) => {
        hw.matrix.en = +v;
        autosave();
      });
      fieldRow(matSec, "D4", "number", hw.matrix.d4, (v) => {
        hw.matrix.d4 = +v;
        autosave();
      });
      fieldRow(matSec, "D5", "number", hw.matrix.d5, (v) => {
        hw.matrix.d5 = +v;
        autosave();
      });
      fieldRow(matSec, "D6", "number", hw.matrix.d6, (v) => {
        hw.matrix.d6 = +v;
        autosave();
      });
      fieldRow(matSec, "D7", "number", hw.matrix.d7, (v) => {
        hw.matrix.d7 = +v;
        autosave();
      });
      fieldRow(matSec, "RW", "number", hw.matrix.rw, (v) => {
        hw.matrix.rw = +v;
        autosave();
      });
      fieldRow(matSec, "Backlight pin", "number", hw.matrix.bl, (v) => {
        hw.matrix.bl = +v;
        autosave();
      });
      backlightPolarityRow(matSec, hw);
      fieldRow(matSec, "Columns", "number", hw.matrix.cols, (v) => {
        hw.matrix.cols = parseInt(v, 10) || 16;
        autosave();
      });
      fieldRow(matSec, "Rows", "number", hw.matrix.rows, (v) => {
        hw.matrix.rows = parseInt(v, 10) || 2;
        autosave();
      });
    } else if (family === "mipi_dsi") {
      const mipiSec = section(slotScreen, "MIPI DSI");
      fieldRow(mipiSec, "Data lanes", "number", hw.mipi.laneCount, (v) => {
        hw.mipi.laneCount = parseInt(v, 10) || 2;
        autosave();
      });
      fieldRow(mipiSec, "Lane Mbps", "number", hw.mipi.laneMbps, (v) => {
        hw.mipi.laneMbps = parseInt(v, 10) || 1000;
        autosave();
      });
      fieldRow(mipiSec, "H sync", "number", hw.mipi.hsync, (v) => {
        hw.mipi.hsync = parseInt(v, 10) || 0;
        autosave();
      });
      fieldRow(mipiSec, "V sync", "number", hw.mipi.vsync, (v) => {
        hw.mipi.vsync = parseInt(v, 10) || 0;
        autosave();
      });
      fieldRow(mipiSec, "H back porch", "number", hw.mipi.hbp, (v) => {
        hw.mipi.hbp = parseInt(v, 10) || 0;
        autosave();
      });
      fieldRow(mipiSec, "H front porch", "number", hw.mipi.hfp, (v) => {
        hw.mipi.hfp = parseInt(v, 10) || 0;
        autosave();
      });
      fieldRow(mipiSec, "V back porch", "number", hw.mipi.vbp, (v) => {
        hw.mipi.vbp = parseInt(v, 10) || 0;
        autosave();
      });
      fieldRow(mipiSec, "V front porch", "number", hw.mipi.vfp, (v) => {
        hw.mipi.vfp = parseInt(v, 10) || 0;
        autosave();
      });
    } else if (family === "spi_rgb") {
    const dispSec = section(slotScreen, "Display (SPI TFT)");
    fieldRow(dispSec, "DC", "number", hw.display.dc, (v) => {
      hw.display.dc = +v;
      autosave();
      sendLiveHwConfig();
    });
    fieldRow(dispSec, "RST", "number", hw.display.rst, (v) => {
      hw.display.rst = +v;
      autosave();
      sendLiveHwConfig();
    });
    fieldRow(dispSec, "Backlight pin", "number", hw.display.bl, (v) => {
      hw.display.bl = +v;
      autosave();
      sendLiveHwConfig();
    });
    backlightPolarityRow(dispSec, hw, () => {
      autosave();
      sendLiveHwConfig();
    });
    enumRow(
      dispSec,
      "Color order",
      [
        { value: "RGB", label: "RGB" },
        { value: "BGR", label: "BGR" },
      ],
      hw.display.colorOrder || "RGB",
      (v) => {
        hw.display.colorOrder = v;
        autosave();
        sendLiveHwConfig();
      }
    );
    fieldRow(dispSec, "Invert colors", "checkbox", hw.display.invert !== false, (v) => {
      hw.display.invert = v;
      autosave();
      sendLiveHwConfig();
    });
    }

    if (family === "oled_mono" && dev.bus === "spi") {
      const oledSpiSec = section(slotScreen, "OLED (SPI)");
      fieldRow(oledSpiSec, "DC", "number", hw.display.dc, (v) => {
        hw.display.dc = +v;
        autosave();
      });
      fieldRow(oledSpiSec, "RST", "number", hw.display.rst, (v) => {
        hw.display.rst = +v;
        autosave();
      });
      fieldRow(oledSpiSec, "Invert", "checkbox", !!hw.oled.invert, (v) => {
        hw.oled.invert = v;
        autosave();
        requestRender();
      });
      const spiVariantIds = S.oledPanelVariantIdsForDevice(dev);
      if (spiVariantIds.length > 1) {
        const spiVariantOpts = spiVariantIds.map((id) => ({
          value: id,
          label: (S.oledPanelVariantDef(id) && S.oledPanelVariantDef(id).label) || id,
        }));
        selectRow(oledSpiSec, "Panel tint (preview)", spiVariantOpts, S.resolveOledPanelVariantId(LE.project), (v) => {
          hw.oled.panelVariant = v;
          autosave();
          requestRender();
        });
      }
    }

    buildInputSection(slotControls);

    const touchSec = section(slotControls, "Touch controller", null, { doc: "hardware" });
    fieldRow(touchSec, "Enable touch", "checkbox", !!(hw.touch.enabled && hw.touch.kind !== "none"), (v) => {
      hw.touch.enabled = v;
      if (!v) hw.touch.kind = "none";
      else if (hw.touch.kind === "none") hw.touch.kind = family === "mipi_dsi" ? "dsi" : "i2c_ft6336";
      autosave();
      refreshDock();
    });
    if (hw.touch.enabled && hw.touch.kind !== "none") {
      enumRow(
        touchSec,
        "Interface",
        [
          { value: "i2c_ft6336", label: "I2C FT6336" },
          { value: "i2c_gt911", label: "I2C GT911" },
          { value: "i2c_gt9271", label: "I2C GT9271" },
          { value: "i2c_gt928", label: "I2C GT928" },
          { value: "dsi", label: "MIPI DSI (P4 native)" },
        ],
        hw.touch.kind === "none" ? (family === "mipi_dsi" ? "dsi" : "i2c_ft6336") : hw.touch.kind,
        (v) => {
          hw.touch.kind = v;
          hw.touch.enabled = v !== "none";
          autosave();
        }
      );
      if (hw.touch.kind !== "dsi") {
        fieldRow(touchSec, "I2C address", "text", "0x" + (hw.touch.i2cAddr || 0x38).toString(16), (v) => {
          const n = parseInt(String(v).replace(/^0x/i, ""), 16);
          hw.touch.i2cAddr = Number.isFinite(n) ? n : 0x38;
          autosave();
        });
        fieldRow(touchSec, "INT pin", "number", hw.touch.intPin, (v) => {
          hw.touch.intPin = +v;
          autosave();
        });
        fieldRow(touchSec, "RST pin", "number", hw.touch.rstPin, (v) => {
          hw.touch.rstPin = +v;
          autosave();
        });
      }
      fieldRow(touchSec, "Swap X/Y", "checkbox", !!hw.touch.swapXY, (v) => {
        hw.touch.swapXY = v;
        autosave();
      });
      fieldRow(touchSec, "Invert X", "checkbox", !!hw.touch.invertX, (v) => {
        hw.touch.invertX = v;
        autosave();
      });
      fieldRow(touchSec, "Invert Y", "checkbox", !!hw.touch.invertY, (v) => {
        hw.touch.invertY = v;
        autosave();
      });
    }

    const kbSec = section(slotControls, "Virtual keyboard");
    const kbHint = document.createElement("div");
    kbHint.className = "hint";
    kbHint.textContent = "Overlay keyboard for text fields. Layouts include QWERTY and AZERTY (full / compact / minimal). Requires touch input in Simulate.";
    kbSec.appendChild(kbHint);
    fieldRow(kbSec, "Show keyboard", "checkbox", !!(hw.keyboard && hw.keyboard.enabled), (v) => {
      hw.keyboard.enabled = v;
      LE.project.input.virtualKeyboard = v;
      autosave();
    });
    enumRow(
      kbSec,
      "Layout",
      window.LucarneKeyboard ? window.LucarneKeyboard.layoutOptions() : [
        { value: "compact", label: "Compact QWERTY" },
        { value: "full", label: "Full QWERTY" },
        { value: "minimal", label: "Minimal" },
        { value: "numeric", label: "Numeric" },
        { value: "hex", label: "Hex" },
      ],
      (hw.keyboard && hw.keyboard.layout) || "compact",
      (v) => {
        hw.keyboard.layout = window.LucarneKeyboard ? window.LucarneKeyboard.normalizeLayout(v) : v;
        autosave();
      }
    );
    enumRow(
      kbSec,
      "Dock",
      [
        { value: "bottom", label: "Bottom" },
        { value: "top", label: "Top" },
      ],
      (hw.keyboard && hw.keyboard.dock) || "bottom",
      (v) => {
        hw.keyboard.dock = v;
        autosave();
      }
    );

    const sdSec = section(slotBus, "SD card", null, { doc: "export" });
    const sdHint = document.createElement("div");
    sdHint.className = "hint";
    sdHint.textContent = "RGB565 image files exported to Files (SD). The card uses its own CS and clock on the shared SPI bus.";
    sdSec.appendChild(sdHint);
    fieldRow(sdSec, "Use SD", "checkbox", hw.sd.enabled !== false, (v) => {
      hw.sd.enabled = v;
      autosave();
    });
    fieldRow(sdSec, "SD CS", "number", hw.sd.cs, (v) => {
      hw.sd.cs = +v;
      autosave();
    });
    fieldRow(sdSec, "SD SPI Hz", "number", hw.sd.spiHz, (v) => {
      hw.sd.spiHz = parseInt(v, 10) || 0;
      autosave();
    });
    fieldRow(sdSec, "Assets folder", "text", hw.sd.assetsDir || "/assets", (v) => {
      hw.sd.assetsDir = v.trim() || "/assets";
      autosave();
    });

    const volSec = section(slotBoard, "Internal partition (FFat / SPIFFS)", null, { doc: "export" });
    const volHint = document.createElement("div");
    volHint.className = "hint";
    volHint.textContent = "RGB565 icon/image files for volume export. Match partition scheme in Arduino IDE.";
    volSec.appendChild(volHint);
    if (B && window.LucarneHardware) {
      const scheme = B.getScheme(hw.board.target, hw.board.schemeId);
      const uploadWarn = window.LucarneHardware.volumeUploadWarning(hw, scheme);
      if (uploadWarn) {
        const w = document.createElement("div");
        w.className = "hint hint-bad";
        w.textContent = uploadWarn;
        volSec.appendChild(w);
      }
    }
    fieldRow(volSec, "Use internal partition", "checkbox", hw.volume && hw.volume.enabled !== false, (v) => {
      hw.volume.enabled = v;
      markDirty();
      refreshDock();
    });
    fieldRow(volSec, "Partition label", "text", (hw.volume && hw.volume.partition) || "ffat", (v) => {
      hw.volume.partition = v.trim() || "ffat";
      markDirty();
    });
    enumRow(
      volSec,
      "Filesystem",
      [
        { value: "fat", label: "FAT (FFat)" },
        { value: "littlefs", label: "LittleFS" },
        { value: "spiffs", label: "SPIFFS" },
      ],
      (hw.volume && hw.volume.fs) || "fat",
      (v) => {
        hw.volume.fs = v;
        markDirty();
        refreshDock();
      }
    );
    fieldRow(volSec, "Assets folder", "text", (hw.volume && hw.volume.assetsDir) || "/assets", (v) => {
      hw.volume.assetsDir = v.trim() || "/assets";
      markDirty();
    });

    buildUiSourceSection(slotRest);
    host.appendChild(slotModule);
    host.appendChild(slotScreen);
    host.appendChild(slotControls);
    host.appendChild(slotBus);
    host.appendChild(slotPerformance);
    host.appendChild(slotBoard);
    host.appendChild(slotRest);
  }

  function syncIconWidgetBounds(w, screen) {
    if (!w || w.type !== "icon") return;
    w.scale = R.parseIconScale(w.scale, 1);
    if (w.lockSize && w.w > 0 && w.h > 0) return;
    const sz = R.iconWidgetDisplaySize(w, LE.project.icons);
    w.w = sz.w;
    w.h = sz.h;
  }

  function allowsOverflowWidget(w) {
    return w && (w.type === "image" || w.type === "icon" || w.type === "dynamicimage");
  }

  function parseMenuItemScale(v) {
    if (v === "" || v === null || v === undefined) return 0;
    const n = parseFloat(v);
    if (!(n > 0)) return 0;
    return Math.round(Math.max(0.1, Math.min(4, n)) * 10) / 10;
  }

  function bindIconScaleInput(input) {
    input.min = "0.1";
    input.max = "4";
    input.step = "0.1";
  }

  function rightIconMode(it) {
    const ri = it.rightIcon || "auto";
    if (ri === "none") return "none";
    if (ri === "auto" || ri === "") return "auto";
    return "custom";
  }

  function appendMenuItemFields(parent, it, menu, onChange) {
    onChange = onChange || refreshInspector;
    iconPickerRow(parent, "Left icon", it.icon || "none", (v) => {
      it.icon = v;
      markDirty();
      onChange();
    });
    appendIconStorageRow(parent, it, "iconStorage", it.icon);
    const leftScaleInput = fieldRow(parent, "Left icon scale", "number", it.iconScale > 0 ? it.iconScale : "", (v) => {
      it.iconScale = parseMenuItemScale(v);
      markDirty();
    });
    bindIconScaleInput(leftScaleInput);
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
        onChange();
      }
    );
    if (rightIconMode(it) === "custom") {
      iconPickerRow(parent, "Right icon pick", it.rightIcon || "arrow_right", (v) => {
        it.rightIcon = v;
        markDirty();
        onChange();
      });
      appendIconStorageRow(parent, it, "rightIconStorage", it.rightIcon);
    }
    const rightScaleInput = fieldRow(parent, "Right icon scale", "number", it.rightIconScale > 0 ? it.rightIconScale : "", (v) => {
      it.rightIconScale = parseMenuItemScale(v);
      markDirty();
    });
    bindIconScaleInput(rightScaleInput);
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
        onChange();
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
    const sec = section(host, "Link", null, { defaultOpen: true, doc: "studio" });
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
        transitionOptions(true, "Inherit (" + LE.project.transition.default + ")"),
        it.transition || "Inherit",
        (v) => {
          it.transition = v;
          markDirty("Change transition");
          refreshInspector();
        }
      );
      transitionHint(sec, it.transition);
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
    const TTS = window.LucarneTextStyle;
    const styleOpts = { refreshDock: refreshInspector };
    const s = LE.getScreen(LE.designerScreen);
    if (!s) return;
    const w = LE.selection.widgetId ? s.widgets.find((x) => x.id === LE.selection.widgetId) : null;
    if (!w) {
      const sec = section(host, "Screen", null, { defaultOpen: true });
      fieldRow(sec, "Name", "text", s.name, (v) => {
        s.name = v;
        autosave();
      });
      const sr = row(sec, "");
      sr.appendChild(btn("Duplicate screen", "", () => duplicateScreen(s.id)));
      const h = document.createElement("div");
      h.className = "hint";
      h.textContent = "Select a widget to edit it, or add one from the palette.";
      host.appendChild(h);
      return;
    }

    const sec = section(host, w.type.charAt(0).toUpperCase() + w.type.slice(1), null, { defaultOpen: true, doc: "widgets" });
    const geoLabel = document.createElement("div");
    geoLabel.className = "row-label geo-label";
    geoLabel.textContent = "Position / Size";
    sec.appendChild(geoLabel);
    const geoGrid = document.createElement("div");
    geoGrid.className = "geo-grid";
    [
      ["x", "X"],
      ["y", "Y"],
      ["w", "W"],
      ["h", "H"],
    ].forEach(([k, label]) => {
      const cell = document.createElement("div");
      cell.className = "geo-cell";
      const l = document.createElement("label");
      l.textContent = label;
      cell.appendChild(l);
      const i = input("number", w[k] || 0, (v) => {
        w[k] = parseInt(v, 10) || 0;
        if (k === "w" || k === "h") {
          if (allowsOverflowWidget(w)) {
            w.lockSize = true;
            markDirty("Resize widget");
            return;
          }
        }
        const d = LE.dims();
        const bw = w.w && w.w > 0 ? w.w : 40;
        const bh = w.h && w.h > 0 ? w.h : 16;
        if (w.x < 0) w.x = 0;
        if (w.y < 0) w.y = 0;
        if (w.x + bw > d.w) w.x = d.w - bw;
        if (w.y + bh > d.h) w.y = d.h - bh;
        if (w.w > 0 && w.x + w.w > d.w) w.w = d.w - w.x;
        if (w.h > 0 && w.y + w.h > d.h) w.h = d.h - w.y;
        markDirty(k === "x" || k === "y" ? "Move widget" : "Resize widget");
      });
      i.id = "lc-f-" + ++fieldIdSeq;
      l.htmlFor = i.id;
      i.setAttribute("aria-label", { x: "X position", y: "Y position", w: "Width", h: "Height" }[k]);
      cell.appendChild(i);
      geoGrid.appendChild(cell);
    });
    sec.appendChild(geoGrid);

    if (w.type === "label") {
      if (TTS) TTS.migrateLabelLegacy(w);
      fieldRow(sec, "Text", "text", w.text, (v) => ((w.text = v), markDirty()));
      keyRow(sec, "Bind key", w.bindKey || "", (v) => {
        if (v) w.bindKey = v;
        else delete w.bindKey;
        markDirty();
        refreshInspector();
      });
      if (w.bindKey) {
        fieldRow(sec, "Bind decimals", "number", w.bindDecimals === undefined ? 1 : w.bindDecimals, (v) => {
          w.bindDecimals = Math.max(0, Math.min(6, parseInt(v, 10) || 0));
          markDirty();
        });
        fieldRow(sec, "Bind unit", "text", w.bindUnit || "", (v) => {
          if (v) w.bindUnit = v;
          else delete w.bindUnit;
          markDirty();
        });
        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = "The label text follows this key on device (ui.bindValue), refreshed at most every 50 ms.";
        sec.appendChild(hint);
      }
      if (TTS) TTS.appendUI(sec, "Typography", w, "textStyle", markDirty, LE, Object.assign({ flat: true }, styleOpts));
    } else if (w.type === "metric") {
      fieldRow(sec, "Label", "text", w.label, (v) => ((w.label = v), markDirty()));
      keyRow(sec, "Key", w.key, (v) => ((w.key = v), markDirty()));
      fieldRow(sec, "Unit", "text", w.unit, (v) => ((w.unit = v), markDirty()));
      fieldRow(sec, "Decimals", "number", w.decimals === undefined ? 1 : w.decimals, (v) => ((w.decimals = parseInt(v, 10) || 0), markDirty()));
      colorRow(sec, "Accent", w.accent, true, (v) => ((w.accent = v), markDirty()));
      if (TTS) {
        TTS.appendUI(sec, "Label style", w, "labelStyle", markDirty, LE, Object.assign({ align: false }, styleOpts));
        TTS.appendUI(sec, "Value style", w, "valueStyle", markDirty, LE, Object.assign({ align: false }, styleOpts));
      }
    } else if (w.type === "bar") {
      keyRow(sec, "Key", w.key, (v) => ((w.key = v), markDirty()));
      fieldRow(sec, "Min", "number", w.min === undefined ? 0 : w.min, (v) => ((w.min = parseFloat(v) || 0), markDirty()));
      fieldRow(sec, "Max", "number", w.max === undefined ? 1 : w.max, (v) => ((w.max = parseFloat(v) || 0), markDirty()));
      fieldRow(sec, "Show value", "checkbox", w.showValue, (v) => ((w.showValue = v), markDirty()));
      colorRow(sec, "Color", w.color, true, (v) => ((w.color = v), markDirty()));
      if (TTS) TTS.appendUI(sec, "Value style", w, "valueStyle", markDirty, LE, Object.assign({ align: false }, styleOpts));
    } else if (w.type === "icon") {
      iconPickerRow(sec, "Icon", w.icon || "chart", (v) => {
        w.icon = v;
        delete w.lockSize;
        ensureIconRefLoaded(v)
          .then(() => {
            syncIconWidgetBounds(w, s);
            markDirty();
            refreshInspector();
          })
          .catch(() => toast("Icon load failed", "error"));
      });
      const scaleInput = fieldRow(sec, "Scale", "number", w.scale || 1, (v) => {
        w.scale = R.parseIconScale(v, 1);
        delete w.lockSize;
        syncIconWidgetBounds(w, s);
        markDirty();
      });
      bindIconScaleInput(scaleInput);
      selectRow(
        sec,
        "Scale mode",
        [
          { value: "fit", label: "Fit (scale to bounds)" },
          { value: "native", label: "Native (1:1, clip overflow)" },
        ],
        w.scaleMode || "fit",
        (v) => {
          w.scaleMode = v;
          delete w.lockSize;
          syncIconWidgetBounds(w, s);
          markDirty();
          refreshInspector();
        }
      );
      colorRow(sec, "Color", w.color, true, (v) => ((w.color = v), markDirty()));
      const FE = window.LucarneFluentEmoji;
      if (w.icon && w.icon.indexOf("emoji:") === 0 && FE && FE.refMayAnimate && FE.refMayAnimate(w.icon)) {
        fieldRow(sec, "Opaque bake", "checkbox", !!w.opaqueBake, (v) => {
          w.opaqueBake = v;
          markDirty();
          refreshMemoryBar();
        });
        fieldRow(sec, "Max frames (0 = project)", "number", w.animMaxFrames || 0, (v) => {
          w.animMaxFrames = Math.max(0, parseInt(v, 10) || 0);
          markDirty();
          refreshMemoryBar();
          refreshInspector();
        });
        fieldRow(sec, "Frame step (0 = project)", "number", w.animFrameStep || 0, (v) => {
          w.animFrameStep = Math.max(0, parseInt(v, 10) || 0);
          markDirty();
          refreshMemoryBar();
          refreshInspector();
        });
        const animEst = document.createElement("div");
        animEst.className = "hint";
        const px = R.iconWidgetDisplaySize(w, LE.project.icons).w;
        const src = FE.sourceFrameCount ? FE.sourceFrameCount(w.icon) : 1;
        const opts = FE.resolveAnimExportOpts ? FE.resolveAnimExportOpts(LE.project, w) : {};
        const eff = FE.effectiveExportFrameCount ? FE.effectiveExportFrameCount(src, opts) : src;
        const st = w.iconStorage || LE.project.iconExportStorage || "flash";
        const bytes = FE.estimateAnimFlashBytes ? FE.estimateAnimFlashBytes(px, eff, st) : 0;
        const fmt = window.LucarneMemory ? window.LucarneMemory.formatBytes : String;
        animEst.textContent =
          "Export ~" + eff + "/" + src + " frames at " + px + "px · ~" + fmt(bytes) + " (" + st + ")";
        sec.appendChild(animEst);
        if (!FE.getIconByRef(w.icon)) {
          ensureIconRefLoaded(w.icon)
            .then(() => refreshInspector())
            .catch((e) => {
              console.warn("Emoji load failed for " + w.icon, e);
              toast("Emoji " + w.icon.replace(/^emoji:/, "") + " could not be loaded", "warn");
            });
        }
      }
      appendIconStorageRow(sec, w, "iconStorage", w.icon);
    } else if (w.type === "image") {
      if (!LE.project.images) LE.project.images = {};
      const imgOpts = [{ value: "", label: "(none)" }].concat(
        Object.keys(LE.project.images)
          .filter((id) => LE.project.images[id])
          .map((id) => ({
            value: id,
            label: (LE.project.images[id].label || id) + " (" + (LE.project.images[id].storage || "flash") + ")",
          }))
      );
      selectRow(sec, "Image", imgOpts, w.imageId || "", (v) => {
        w.imageId = v;
        markDirty();
        refreshInspector();
      });
      if (w.imageId) appendImageStorageInspector(sec, w.imageId);
      selectRow(
        sec,
        "Scale mode",
        [
          { value: "fit", label: "Fit (scale to widget)" },
          { value: "native", label: "Native (1:1, clip overflow)" },
        ],
        w.scaleMode || "fit",
        (v) => {
          w.scaleMode = v;
          markDirty();
          designer.render();
        }
      );
      const hintImgW = document.createElement("div");
      hintImgW.className = "hint";
      hintImgW.textContent =
        "Native: asset pixels map 1:1; off-screen area is clipped. Flash export crops to visible region.";
      sec.appendChild(hintImgW);
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "Import new images in the Assets tab.";
      sec.appendChild(hint);
    } else if (w.type === "menu") {
      const menuLeftScale = fieldRow(sec, "Default left icon scale", "number", w.iconScale || 1, (v) => {
        w.iconScale = R.parseIconScale(v, 1);
        markDirty();
      });
      bindIconScaleInput(menuLeftScale);
      const menuRightScale = fieldRow(sec, "Default right icon scale", "number", w.badgeScale || 1, (v) => {
        w.badgeScale = R.parseIconScale(v, 1);
        markDirty();
      });
      bindIconScaleInput(menuRightScale);
      colorRow(sec, "Active fill", w.activeFill, true, (v) => {
        w.activeFill = v;
        markDirty();
      });
      colorRow(sec, "Active text", w.activeText, true, (v) => {
        w.activeText = v;
        markDirty();
      });
      colorRow(sec, "Inactive fill", w.inactiveFill, true, (v) => {
        w.inactiveFill = v;
        markDirty();
      });
      colorRow(sec, "Inactive text", w.inactiveText, true, (v) => {
        w.inactiveText = v;
        markDirty();
      });
      colorRow(sec, "Inactive edge", w.inactiveEdge, true, (v) => {
        w.inactiveEdge = v;
        markDirty();
      });
      if (TTS) TTS.appendUI(sec, "Default text style", w, "textStyle", markDirty, LE, styleOpts);
      buildMenuItems(host, s, w);
    } else if (w.type === "button") {
      fieldRow(sec, "Label", "text", w.label || "Button", (v) => ((w.label = v), markDirty()));
      iconPickerRow(sec, "Icon", w.icon || "none", (v) => {
        w.icon = v;
        ensureIconRefLoaded(v)
          .then(() => {
            markDirty();
            refreshInspector();
          })
          .catch(() => toast("Icon load failed", "error"));
      });
      if (w.icon && w.icon !== "none") appendIconStorageRow(sec, w, "iconStorage", w.icon);
      colorRow(sec, "Fill", w.fill, true, (v) => ((w.fill = v), markDirty()));
      colorRow(sec, "Text", w.textColor, true, (v) => ((w.textColor = v), markDirty()));
      if (TTS) TTS.appendUI(sec, "Text style", w, "textStyle", markDirty, LE, styleOpts);
      if (!w.action) w.action = w.callbackId ? "callback" : "navigate";
      selectRow(
        sec,
        "Action",
        [
          { value: "navigate", label: "Navigate" },
          { value: "callback", label: "Callback" },
        ],
        w.action,
        (v) => {
          w.action = v;
          if (v === "callback") w.target = "";
          else w.callbackId = "";
          markDirty();
          refreshInspector();
        }
      );
      if (w.action === "navigate") {
        selectRow(
          sec,
          "Target",
          [{ value: "", label: "(none)" }].concat(
            LE.project.screens.filter((x) => x.id !== s.id).map((x) => ({ value: x.id, label: x.name || x.id }))
          ),
          w.target || "",
          (v) => ((w.target = v), markDirty())
        );
        selectRow(
          sec,
          "Transition",
          transitionOptions(true, "Inherit (" + LE.project.transition.default + ")"),
          w.transition || "Inherit",
          (v) => ((w.transition = v), markDirty(), refreshInspector())
        );
        transitionHint(sec, w.transition);
      } else {
        fieldRow(sec, "Callback ID", "text", w.callbackId || "", (v) => {
          w.callbackId = v.replace(/[^a-zA-Z0-9_]/g, "_");
          markDirty();
        });
        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = "loop(): case projet::ACTION_" + (w.callbackId || "id").replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase() + ":";
        sec.appendChild(hint);
      }
    } else if (w.type === "shape") {
      selectRow(
        sec,
        "Shape",
        [
          { value: "rect", label: "Rectangle" },
          { value: "circle", label: "Circle" },
          { value: "triangle", label: "Triangle" },
        ],
        w.shape || "rect",
        (v) => {
          w.shape = v;
          markDirty();
        }
      );
      fieldRow(sec, "Label", "text", w.label || "", (v) => ((w.label = v), markDirty()));
      fieldRow(sec, "Menu group", "text", w.group || "menu", (v) => ((w.group = v.trim() || "menu"), markDirty()));
      colorRow(sec, "Inactive fill", w.fill, true, (v) => ((w.fill = v), markDirty()));
      colorRow(sec, "Inactive stroke", w.stroke, true, (v) => ((w.stroke = v), markDirty()));
      fieldRow(sec, "Stroke width", "number", w.strokeWidth === undefined ? 2 : w.strokeWidth, (v) =>
        ((w.strokeWidth = parseInt(v, 10) || 1), markDirty())
      );
      colorRow(sec, "Active fill", w.activeFill, true, (v) => ((w.activeFill = v), markDirty()));
      colorRow(sec, "Active stroke", w.activeStroke, true, (v) => ((w.activeStroke = v), markDirty()));
      colorRow(sec, "Active text", w.activeText, true, (v) => ((w.activeText = v), markDirty()));
      if (TTS) TTS.appendUI(sec, "Text style", w, "textStyle", markDirty, LE, styleOpts);
      if (!w.action) w.action = w.callbackId ? "callback" : "navigate";
      selectRow(
        sec,
        "Action",
        [
          { value: "navigate", label: "Navigate" },
          { value: "callback", label: "Callback" },
        ],
        w.action,
        (v) => {
          w.action = v;
          if (v === "callback") w.target = "";
          else w.callbackId = "";
          markDirty();
          refreshInspector();
        }
      );
      if (w.action === "navigate") {
        selectRow(
          sec,
          "Target",
          [{ value: "", label: "(none)" }].concat(
            LE.project.screens.filter((x) => x.id !== s.id).map((x) => ({ value: x.id, label: x.name || x.id }))
          ),
          w.target || "",
          (v) => ((w.target = v), markDirty())
        );
        selectRow(
          sec,
          "Transition",
          transitionOptions(true, "Inherit (" + LE.project.transition.default + ")"),
          w.transition || "Inherit",
          (v) => ((w.transition = v), markDirty(), refreshInspector())
        );
        transitionHint(sec, w.transition);
      } else {
        fieldRow(sec, "Callback ID", "text", w.callbackId || "", (v) => {
          w.callbackId = v.replace(/[^a-zA-Z0-9_]/g, "_");
          markDirty();
        });
        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = "loop(): case projet::ACTION_" + (w.callbackId || "id").replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase() + ":";
        sec.appendChild(hint);
      }
      const hint2 = document.createElement("div");
      hint2.className = "hint";
      hint2.textContent =
        "Same menu group: arrows or d-pad to select (active colors), OK to confirm. Touch selects only.";
      sec.appendChild(hint2);
    } else if (w.type === "switch") {
      fieldRow(sec, "Label", "text", w.label || "", (v) => ((w.label = v), markDirty()));
      keyRow(sec, "Key", w.key, (v) => ((w.key = v), markDirty()));
      if (TTS) TTS.appendUI(sec, "Text style", w, "textStyle", markDirty, LE, styleOpts);
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "Bind a bool key. Toggled on touch in firmware.";
      sec.appendChild(hint);
    } else if (w.type === "slider") {
      keyRow(sec, "Key", w.key, (v) => ((w.key = v), markDirty()));
      fieldRow(sec, "Min", "number", w.min === undefined ? 0 : w.min, (v) => ((w.min = parseFloat(v) || 0), markDirty()));
      fieldRow(sec, "Max", "number", w.max === undefined ? 100 : w.max, (v) => ((w.max = parseFloat(v) || 0), markDirty()));
      colorRow(sec, "Color", w.color, true, (v) => ((w.color = v), markDirty()));
    } else if (w.type === "chart") {
      buildChartKeys(host, w);
      fieldRow(sec, "Min", "number", w.min === undefined ? 0 : w.min, (v) => ((w.min = parseFloat(v) || 0), markDirty()));
      fieldRow(sec, "Max", "number", w.max === undefined ? 100 : w.max, (v) => ((w.max = parseFloat(v) || 0), markDirty()));
      colorRow(sec, "Color", w.color, true, (v) => ((w.color = v), markDirty()));
    } else if (w.type === "graph") {
      selectRow(
        sec,
        "Type",
        [
          { value: "line", label: "Line" },
          { value: "bar", label: "Bar" },
          { value: "area", label: "Area" },
          { value: "sparkline", label: "Sparkline" },
        ],
        w.graphType || "line",
        (v) => {
          w.graphType = v;
          if (v === "sparkline") w.grid = false;
          markDirty();
        }
      );
      selectRow(
        sec,
        "Mode",
        [
          { value: "stream", label: "Stream (real-time)" },
          { value: "keys", label: "Multi-key" },
        ],
        w.mode || "stream",
        (v) => {
          w.mode = v;
          markDirty();
          refreshInspector();
        }
      );
      if ((w.mode || "stream") === "stream") {
        keyRow(sec, "Value key", w.key, (v) => ((w.key = v), markDirty()));
        fieldRow(sec, "Capacity", "number", w.capacity === undefined ? 32 : w.capacity, (v) =>
          ((w.capacity = Math.max(2, Math.min(64, parseInt(v, 10) || 32))), markDirty())
        );
      } else {
        buildChartKeys(host, w);
      }
      fieldRow(sec, "Min", "number", w.min === undefined ? 0 : w.min, (v) => ((w.min = parseFloat(v) || 0), markDirty()));
      fieldRow(sec, "Max", "number", w.max === undefined ? 100 : w.max, (v) => ((w.max = parseFloat(v) || 0), markDirty()));
      colorRow(sec, "Color", w.color, true, (v) => ((w.color = v), markDirty()));
      fieldRow(sec, "Grid", "checkbox", w.grid !== false, (v) => ((w.grid = !!v), markDirty()));
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent =
        (w.mode || "stream") === "stream"
          ? "Firmware: call graph.push(value) each loop. Export shows the exact line."
          : "Bind one store key per point on the X axis.";
      sec.appendChild(hint);
    } else if (w.type === "gauge") {
      fieldRow(sec, "Label", "text", w.label || "", (v) => ((w.label = v), markDirty()));
      keyRow(sec, "Key", w.key, (v) => ((w.key = v), markDirty()));
      fieldRow(sec, "Min", "number", w.min === undefined ? 0 : w.min, (v) => ((w.min = parseFloat(v) || 0), markDirty()));
      fieldRow(sec, "Max", "number", w.max === undefined ? 100 : w.max, (v) => ((w.max = parseFloat(v) || 0), markDirty()));
      fieldRow(sec, "Decimals", "number", w.decimals === undefined ? 1 : w.decimals, (v) => ((w.decimals = parseInt(v, 10) || 0), markDirty()));
      colorRow(sec, "Accent", w.accent, true, (v) => ((w.accent = v), markDirty()));
      if (TTS) {
        TTS.appendUI(sec, "Label style", w, "labelStyle", markDirty, LE, Object.assign({ align: false }, styleOpts));
        TTS.appendUI(sec, "Value style", w, "valueStyle", markDirty, LE, Object.assign({ align: false }, styleOpts));
      }
    } else if (w.type === "battery") {
      keyRow(sec, "Level key", w.key, (v) => ((w.key = v), markDirty()));
      keyRow(sec, "Charging key", w.chargingKey, (v) => {
        w.chargingKey = v || undefined;
        markDirty();
      });
      fieldRow(sec, "Show percent", "checkbox", w.showPercent !== false, (v) => ((w.showPercent = !!v), markDirty()));
      fieldRow(sec, "Low threshold %", "number", w.lowThreshold === undefined ? 20 : w.lowThreshold, (v) =>
        ((w.lowThreshold = parseInt(v, 10) || 0), markDirty())
      );
      if (TTS) TTS.appendUI(sec, "Value style", w, "valueStyle", markDirty, LE, styleOpts);
    } else if (w.type === "clock") {
      selectRow(
        sec,
        "Format",
        [
          { value: "hm", label: "HH:MM" },
          { value: "hms", label: "HH:MM:SS" },
          { value: "hm12", label: "12h AM/PM" },
        ],
        w.format || "hm",
        (v) => ((w.format = v), markDirty())
      );
      fieldRow(sec, "Time string key", "text", w.timeKey || "", (v) => {
        w.timeKey = v.trim() || undefined;
        markDirty();
      });
      keyRow(sec, "Hour key", w.hourKey, (v) => ((w.hourKey = v || "hour"), markDirty()));
      keyRow(sec, "Minute key", w.minuteKey, (v) => ((w.minuteKey = v || "minute"), markDirty()));
      if (w.format === "hms" || w.secondKey) {
        keyRow(sec, "Second key", w.secondKey, (v) => {
          w.secondKey = v || undefined;
          markDirty();
        });
      }
      if (TTS) TTS.appendUI(sec, "Text style", w, "textStyle", markDirty, LE, styleOpts);
      const hintClock = document.createElement("div");
      hintClock.className = "hint";
      hintClock.textContent = "Bind int keys in Data, or a preformatted time string key.";
      sec.appendChild(hintClock);
    } else if (w.type === "date") {
      selectRow(
        sec,
        "Format",
        [
          { value: "dmy", label: "DD/MM/YYYY" },
          { value: "ymd", label: "YYYY-MM-DD" },
          { value: "mdy", label: "MM/DD/YYYY" },
          { value: "dmy_dot", label: "DD.MM.YYYY" },
        ],
        w.format || "dmy",
        (v) => ((w.format = v), markDirty())
      );
      fieldRow(sec, "Date string key", "text", w.dateKey || "", (v) => {
        w.dateKey = v.trim() || undefined;
        markDirty();
      });
      keyRow(sec, "Day key", w.dayKey, (v) => ((w.dayKey = v || "day"), markDirty()));
      keyRow(sec, "Month key", w.monthKey, (v) => ((w.monthKey = v || "month"), markDirty()));
      keyRow(sec, "Year key", w.yearKey, (v) => ((w.yearKey = v || "year"), markDirty()));
      if (TTS) TTS.appendUI(sec, "Text style", w, "textStyle", markDirty, LE, styleOpts);
    } else if (w.type === "status") {
      keyRow(sec, "Wi-Fi key", w.wifiKey, (v) => ((w.wifiKey = v || "wifi"), markDirty()));
      keyRow(sec, "RSSI key", w.rssiKey, (v) => ((w.rssiKey = v || "rssi"), markDirty()));
      keyRow(sec, "Bluetooth key", w.bluetoothKey, (v) => ((w.bluetoothKey = v || "bt"), markDirty()));
      const hintStatus = document.createElement("div");
      hintStatus.className = "hint";
      hintStatus.textContent = "wifi / bluetooth: bool. rssi: int dBm (e.g. -58).";
      sec.appendChild(hintStatus);
    } else if (w.type === "dynamicimage") {
      keyRow(sec, "Path key", w.pathKey, (v) => ((w.pathKey = v || "img_path"), markDirty()));
      selectRow(
        sec,
        "Storage",
        [
          { value: "sd", label: "SD card" },
          { value: "volume", label: "Lucarne volume" },
          { value: "flash", label: "Flash path" },
          { value: "web", label: "Web URL" },
        ],
        w.storage || "sd",
        (v) => ((w.storage = v), markDirty())
      );
      fieldRow(sec, "Source width", "number", w.imgW || 0, (v) => ((w.imgW = parseInt(v, 10) || 0), markDirty()));
      fieldRow(sec, "Source height", "number", w.imgH || 0, (v) => ((w.imgH = parseInt(v, 10) || 0), markDirty()));
      selectRow(
        sec,
        "Scale mode",
        [
          { value: "fit", label: "Fit (scale to widget)" },
          { value: "native", label: "Native (1:1, clip overflow)" },
        ],
        w.scaleMode || "fit",
        (v) => {
          w.scaleMode = v;
          markDirty();
        }
      );
      const hintImg = document.createElement("div");
      hintImg.className = "hint";
      hintImg.textContent = "Firmware: ui.setString(pathKey, \"/assets/cover.rgb565\"). Match storage to file location.";
      sec.appendChild(hintImg);
    } else if (w.type === "list") {
      buildListItems(host, w);
    } else if (w.type === "textfield") {
      const KB = window.LucarneKeyboard;
      if (KB) {
        selectRow(sec, "Input type", KB.inputKindOptions(), KB.normalizeInputKind(w.inputKind || "text"), (v) => {
          w.inputKind = KB.normalizeInputKind(v);
          markDirty();
        });
      }
      fieldRow(sec, "Label", "text", w.label || "", (v) => ((w.label = v), markDirty()));
      fieldRow(sec, "Placeholder", "text", w.placeholder || "", (v) => ((w.placeholder = v), markDirty()));
      keyRow(sec, "Key", w.key, (v) => ((w.key = v), markDirty()));
      fieldRow(sec, "Max length", "number", w.maxLen === undefined ? 32 : w.maxLen, (v) => ((w.maxLen = parseInt(v, 10) || 0), markDirty()));
      if (TTS) TTS.appendUI(sec, "Text style", w, "textStyle", markDirty, LE, styleOpts);
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "Bind a key in the Data tab (string for text/password/hex, float/int for numeric). Simulate: tap field, type with on-screen keyboard.";
      sec.appendChild(hint);
    } else if (w.type === "keyboard") {
      const KB = window.LucarneKeyboard;
      const layoutOpts = KB ? KB.layoutOptions() : [{ value: "compact", label: "Compact" }];
      selectRow(sec, "Layout", layoutOpts, (w.layout && KB ? KB.normalizeLayout(w.layout) : w.layout) || "compact", (v) => {
        w.layout = KB ? KB.normalizeLayout(v) : v;
        if (KB) KB.fitWidget(w, LE.dims());
        markDirty();
        designer.render();
      });
      selectRow(
        sec,
        "Dock",
        [
          { value: "bottom", label: "Bottom" },
          { value: "top", label: "Top" },
        ],
        w.dock || "bottom",
        (v) => {
          w.dock = v;
          if (KB) KB.fitWidget(w, LE.dims());
          markDirty();
          designer.render();
        }
      );
      const fitRow = row(sec, "");
      fitRow.appendChild(
        btn("Fit to screen", "tiny", () => {
          if (KB) KB.fitWidget(w, LE.dims());
          markDirty();
          designer.render();
        })
      );
      const hintKb = document.createElement("div");
      hintKb.className = "hint";
      hintKb.textContent = "Embedded keyboard widget for layout preview. Global overlay keyboard is configured in Hardware / Input.";
      sec.appendChild(hintKb);
    }

    const del = row(sec, "");
    del.appendChild(
      btn("Delete widget", "danger", () => {
        s.widgets = s.widgets.filter((x) => x.id !== w.id);
        LE.selection = {};
        markDirty();
        refreshInspector();
      })
    );
  }

  function buildChartKeys(host, chart) {
    if (!chart.keys) chart.keys = ["", ""];
    itemsDialogSection(host, "Series keys", chart.keys.length, () => openChartKeysDialog(chart));
  }

  function renderChartKeysDialogBody(body, chart) {
    body.innerHTML = "";
    const addRow = document.createElement("div");
    addRow.className = "modal-foot items-dialog-add";
    addRow.appendChild(
      btn("+ Key", "tiny primary", () => {
        if (chart.keys.length >= 8) return toast("Max 8 series", "warn");
        chart.keys.push("");
        markDirty();
        renderChartKeysDialogBody(body, chart);
        refreshInspector();
      })
    );
    body.appendChild(addRow);
    chart.keys.forEach((key, idx) => {
      const card = document.createElement("div");
      card.className = "section subcard";
      const title = document.createElement("div");
      title.className = "muted";
      title.textContent = "Series " + (idx + 1);
      card.appendChild(title);
      keyRow(card, "Key", key, (v) => {
        chart.keys[idx] = v;
        markDirty();
      });
      const r = row(card, "");
      r.appendChild(
        btn("Remove", "danger tiny", () => {
          chart.keys.splice(idx, 1);
          if (chart.keys.length < 2) chart.keys.push("");
          markDirty("Remove chart series");
          renderChartKeysDialogBody(body, chart);
          refreshInspector();
        })
      );
      body.appendChild(card);
    });
  }

  function openChartKeysDialog(chart) {
    const DLG = window.LucarneDialog;
    if (!DLG) return;
    DLG.open({
      title: "Series keys",
      size: "sm",
      render: (body) => renderChartKeysDialogBody(body, chart),
    });
  }

  function buildListItems(host, list) {
    const TTS = window.LucarneTextStyle;
    const styleOpts = { refreshDock: refreshInspector };
    list.items = list.items || [];
    const sec = itemsDialogSection(host, "List items", list.items.length, () => openListItemsDialog(list));
    if (TTS) TTS.appendUI(sec, "Default text style", list, "textStyle", markDirty, LE, styleOpts);
  }

  function renderListItemsDialogBody(body, list) {
    body.innerHTML = "";
    const TTS = window.LucarneTextStyle;
    const styleOpts = { refreshDock: () => renderListItemsDialogBody(body, list) };
    const addRow = document.createElement("div");
    addRow.className = "modal-foot items-dialog-add";
    addRow.appendChild(
      btn("+ Item", "tiny primary", () => {
        if (list.items.length >= 12) return toast("Max 12 items", "warn");
        list.items.push({ id: S.genId("it"), label: "Item" });
        markDirty();
        renderListItemsDialogBody(body, list);
        refreshInspector();
      })
    );
    body.appendChild(addRow);
    (list.items || []).forEach((it, idx) => {
      const card = document.createElement("div");
      card.className = "section subcard";
      fieldRow(card, "Label", "text", it.label || "", (v) => {
        it.label = v;
        markDirty();
      });
      if (TTS) TTS.appendUI(card, "Text style", it, "textStyle", markDirty, LE, styleOpts);
      const r = row(card, "");
      r.appendChild(
        btn("Remove", "danger tiny", () => {
          list.items.splice(idx, 1);
          markDirty("Remove list item");
          renderListItemsDialogBody(body, list);
          refreshInspector();
        })
      );
      body.appendChild(card);
    });
  }

  function openListItemsDialog(list) {
    const DLG = window.LucarneDialog;
    if (!DLG) return;
    DLG.open({
      title: "List items",
      size: "sm",
      render: (body) => renderListItemsDialogBody(body, list),
    });
  }

  function buildMenuItems(host, screen, menu) {
    menu.items = menu.items || [];
    itemsDialogSection(host, "Menu items", menu.items.length, () => openMenuItemsDialog(screen, menu));
  }

  function renderMenuItemsDialogBody(body, screen, menu) {
    body.innerHTML = "";
    const TTS = window.LucarneTextStyle;
    const onChange = () => renderMenuItemsDialogBody(body, screen, menu);
    const styleOpts = { refreshDock: onChange };
    const addRow = document.createElement("div");
    addRow.className = "modal-foot items-dialog-add";
    addRow.appendChild(
      btn("+ Item", "tiny primary", () => {
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
        onChange();
        refreshInspector();
      })
    );
    body.appendChild(addRow);
    (menu.items || []).forEach((it, idx) => {
      const card = document.createElement("div");
      card.className = "section subcard";
      fieldRow(card, "Label", "text", it.label, (v) => ((it.label = v), markDirty()));
      appendMenuItemFields(card, it, menu, onChange);
      if (TTS) TTS.appendUI(card, "Text style", it, "textStyle", markDirty, LE, styleOpts);
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
          transitionOptions(true, "Inherit"),
          it.transition || "Inherit",
          (v) => {
            it.transition = v;
            markDirty("Change transition");
            onChange();
          }
        );
        transitionHint(card, it.transition);
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
          markDirty("Remove menu item");
          onChange();
          refreshInspector();
        })
      );
      body.appendChild(card);
    });
  }

  function openMenuItemsDialog(screen, menu) {
    const DLG = window.LucarneDialog;
    if (!DLG) return;
    DLG.open({
      title: "Menu items",
      render: (body) => renderMenuItemsDialogBody(body, screen, menu),
    });
  }

  function colorRow(parent, label, value, clearable, onchange) {
    const TS = window.LucarneTextStyle;
    const isTrans = TS && TS.isTransparentColor(value);
    const r = row(parent, label);
    r.classList.add("color");
    const fieldWrap = document.createElement("div");
    fieldWrap.className = "color-field";
    const c = document.createElement("input");
    c.type = "color";
    c.disabled = !!isTrans;
    c.value = isTrans ? LE.project.theme.text : value || "#5e96ff";
    c.addEventListener("input", () => onchange(c.value));
    fieldWrap.appendChild(c);
    const code = document.createElement("span");
    code.className = "color-code";
    code.textContent = isTrans ? "transparent" : value ? String(value).toUpperCase() : "auto";
    c.addEventListener("input", () => (code.textContent = c.value.toUpperCase()));
    fieldWrap.appendChild(code);
    r.appendChild(fieldWrap);
    if (clearable) {
      const actions = document.createElement("div");
      actions.className = "color-actions";
      const autoBtn = btn("Auto", "tiny", () => {
        onchange(undefined);
        refreshInspector();
      });
      autoBtn.title = "Inherit the color from the theme";
      autoBtn.classList.toggle("on", !value);
      const transBtn = btn("Transparent", "tiny", () => {
        onchange(TS ? TS.TRANSPARENT : "transparent");
        refreshInspector();
      });
      transBtn.title = "No fill: let the background show through";
      transBtn.classList.toggle("on", !!isTrans);
      actions.appendChild(autoBtn);
      actions.appendChild(transBtn);
      fieldWrap.appendChild(actions);
    }
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
    const designerScreen = mode === "designer" && LE.designerScreen ? LE.getScreen(LE.designerScreen) : null;
    if (designerScreen) {
      const sec0 = section(host, "Screen: " + (designerScreen.name || designerScreen.id));
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "Override the project theme for this screen only. Other screens keep the global theme.";
      sec0.appendChild(hint);
      const custom = S.screenHasTheme(designerScreen);
      fieldRow(sec0, "Custom theme", "checkbox", custom, (v) => {
        if (v) {
          designerScreen.theme = JSON.parse(JSON.stringify(LE.project.theme));
        } else {
          delete designerScreen.theme;
        }
        invalidateThemeCache();
        markDirty();
        refreshDock();
      });
      if (!custom) {
        const h2 = document.createElement("div");
        h2.className = "hint";
        h2.textContent = "Using project theme. Enable custom theme to edit colors for this screen.";
        host.appendChild(h2);
        return buildProjectTheme(host, LE.project.theme, true);
      }
      return buildProjectTheme(host, designerScreen.theme, false, designerScreen);
    }
    buildProjectTheme(host, LE.project.theme, false);
  }

  function buildProjectTheme(host, t, readOnly, screen) {
    const sec = section(host, readOnly ? "Project theme (read-only)" : screen ? "Screen theme" : "Colors");
    if (readOnly) {
      S.THEME_KEYS.forEach(([k, label]) => {
        const r = row(sec, label);
        const sw = document.createElement("span");
        sw.className = "field";
        sw.textContent = t[k];
        r.appendChild(sw);
      });
      return;
    }
    S.THEME_KEYS.forEach(([k, label]) => {
      colorRow(sec, label, t[k], false, (v) => {
        t[k] = v;
        invalidateThemeCache();
        markDirty();
      });
    });
    const sec2 = section(host, "Metrics");
    fieldRow(sec2, "Radius", "number", t.radius, (v) => {
      t.radius = +v;
      invalidateThemeCache();
      markDirty();
    });
    fieldRow(sec2, "Padding", "number", t.padding, (v) => {
      t.padding = +v;
      invalidateThemeCache();
      markDirty();
    });
    fieldRow(sec2, "Row height", "number", t.rowHeight, (v) => {
      t.rowHeight = +v;
      invalidateThemeCache();
      markDirty();
    });

    const fontOpts = Object.values(LE.project.fonts).map((f) => ({ value: f.id, label: f.label }));
    const sec3 = section(host, "Fonts");
    enumRow(sec3, "Body", fontOpts, t.fontBodyId, (v) => {
      t.fontBodyId = v;
      invalidateThemeCache();
      markDirty();
    });
    enumRow(sec3, "Title", fontOpts, t.fontTitleId, (v) => {
      t.fontTitleId = v;
      invalidateThemeCache();
      markDirty();
    });
    fieldRow(sec3, "Fallback size", "number", t.textSize, (v) => {
      t.textSize = +v || 1;
      invalidateThemeCache();
      markDirty();
    });
    if (screen) {
      const r = row(sec3, "");
      r.appendChild(
        btn("Copy from project theme", "tiny", () => {
          Object.assign(screen.theme, JSON.parse(JSON.stringify(LE.project.theme)));
          invalidateThemeCache();
          markDirty();
          refreshDock();
        })
      );
    }
  }

  /* ---------- Fonts pane ---------- */
  function buildFonts() {
    const host = dom.tabFonts;
    host.innerHTML = "";
    const list = section(host, "Defined fonts");
    Object.values(LE.project.fonts).forEach((f) => {
      const card = document.createElement("div");
      card.className = "section subcard";
      const title = document.createElement("div");
      title.className = "subsection-title";
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
            markDirty("Delete font");
            refreshDock();
            toastUndo("Font \u201c" + (f.label || f.family || f.id) + "\u201d deleted");
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
    const gAddBtn = btn("Add", "primary", () =>
      busy(gAddBtn, async () => {
        const familyName = String(gName.value || "").trim();
        if (!familyName) {
          toast("Enter a Google Fonts family name", "warn");
          gName.focus();
          return;
        }
        const id = S.genId("f");
        const entry = {
          id,
          label: familyName,
          builtin: false,
          kind: "google",
          googleName: familyName,
          family: familyName,
          weight: parseInt(gWeight.value, 10) || 400,
          sizePx: parseInt(gSize.value, 10) || 16,
          cName: "Font_" + id,
        };
        await bakeFont(entry);
        if (!entry._atlas) {
          toast("Could not load \u201c" + familyName + "\u201d from Google Fonts. Check the family name and your connection.", "error");
          return;
        }
        LE.project.fonts[id] = entry;
        markDirty("Add font");
        refreshDock();
        toast("Font \u201c" + familyName + "\u201d added", "success");
      }, "Loading font\u2026")
    );
    gr.appendChild(gAddBtn);

    const up = section(host, "Upload TTF/OTF");
    const upSize = fieldRow(up, "Size", "number", 16, () => {});
    const ur = row(up, "");
    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".ttf,.otf";
    file.className = "field";
    file.setAttribute("aria-label", "Font file (TTF or OTF)");
    file.addEventListener("change", async () => {
      if (!file.files || !file.files[0]) return;
      const picked = file.files[0];
      file.disabled = true;
      try {
        const res = await window.LucarneFonts.loadUpload(picked);
        const id = S.genId("f");
        const entry = {
          id,
          label: picked.name.replace(/\.[^.]+$/, ""),
          builtin: false,
          kind: "upload",
          family: res.family,
          base64: res.base64,
          _loaded: true,
          weight: 400,
          sizePx: parseInt(upSize.value, 10) || 16,
          cName: "Font_" + id,
        };
        await bakeFont(entry);
        if (!entry._atlas) throw new Error("the font could not be rasterized");
        LE.project.fonts[id] = entry;
        markDirty("Upload font");
        refreshDock();
        toast("Font \u201c" + entry.label + "\u201d uploaded", "success");
      } catch (e) {
        console.warn("Font upload failed", e);
        toast("Font upload failed: " + errorText(e, "unsupported file"), "error");
      } finally {
        file.disabled = false;
        file.value = "";
      }
    });
    ur.appendChild(file);
  }

  /* ---------- Assets pane ---------- */
  function buildAssets() {
    const host = dom.tabAssets;
    if (!host) return;
    host.innerHTML = "";
    if (!LE.project.images) LE.project.images = {};
    if (!LE.project.icons) LE.project.icons = {};

    const imgSec = section(host, "Image library", null, { doc: "export" });
    const imgHint = document.createElement("div");
    imgHint.className = "hint";
    imgHint.textContent = "Images are shared across all screens. Choose where they live on the device at export time.";
    imgSec.appendChild(imgHint);

    const imgFile = document.createElement("input");
    imgFile.type = "file";
    imgFile.accept = "image/png,image/jpeg,image/webp,image/bmp,.bmp";
    imgFile.hidden = true;
    const imgAdd = row(imgSec, "");
    const imgImportBtn = btn("Import image", "primary tiny", () => imgFile.click());
    imgAdd.appendChild(imgImportBtn);
    imgSec.appendChild(imgFile);

    imgFile.addEventListener("change", () => {
      const file = imgFile.files && imgFile.files[0];
      if (!file) return;
      busy(imgImportBtn, async () => {
        try {
          const data = await window.LucarneAssets.importFile(file);
          const id = S.genId("img");
          LE.project.images[id] = data;
          flushAutosave();
          markDirty("Import image");
          refreshDock();
          toast("Image \u201c" + file.name + "\u201d added to library", "success");
        } catch (e) {
          console.warn("Image import failed", e);
          toast("Image import failed (" + file.name + "): " + errorText(e, "unsupported or corrupted file"), "error");
        } finally {
          imgFile.value = "";
        }
      }, "Importing\u2026");
    });

    Object.keys(LE.project.images).forEach((id) => {
      const img = LE.project.images[id];
      if (!img) {
        delete LE.project.images[id];
        return;
      }
      const A = window.LucarneAssets;
      const usage = A && A.collectImageUsage ? A.collectImageUsage(LE.project) : {};
      const u = usage[id];
      const card = document.createElement("div");
      card.className = "section subcard";
      const title = document.createElement("div");
      title.className = "subsection-title";
      title.textContent = img.label || id;
      card.appendChild(title);
      const info = document.createElement("div");
      info.className = "hint";
      const srcBytes = A && A.flashBytesImage ? A.flashBytesImage(img) : 0;
      const srcSize = A && A.formatExportSize ? A.formatExportSize(srcBytes) : srcBytes + " B";
      info.textContent = "Source " + img.w + "×" + img.h + " px · " + srcSize + " in library";
      card.appendChild(info);
      const usageHint = document.createElement("div");
      usageHint.className = "hint";
      if (!u) {
        usageHint.textContent = "Not used on any screen — excluded from flash export";
      } else {
        const expImg = A && A.resizeRaster ? A.resizeRaster(img, u.maxW, u.maxH) : img;
        const flashBytes = A && A.flashBytesImage ? A.flashBytesImage(expImg) : 0;
        const flashSize = A && A.formatExportSize ? A.formatExportSize(flashBytes) : flashBytes + " B";
        const headerBytes = A && A.estimateHeaderBytes ? A.estimateHeaderBytes(flashBytes) : flashBytes;
        const headerSize = A && A.formatExportSize ? A.formatExportSize(headerBytes) : headerBytes + " B";
        let line = "On screen up to " + u.maxW + "×" + u.maxH + " px";
        if (u.hasNative && u.cropW > 0) {
          line = "Native visible " + u.cropW + "×" + u.cropH + " px from source";
          if (u.cropOx || u.cropOy) line += " (crop " + u.cropOx + "," + u.cropOy + ")";
        } else if (expImg.w !== img.w || expImg.h !== img.h) {
          line += " · export " + expImg.w + "×" + expImg.h;
        }
        line += " · flash " + flashSize + " · .h ~" + headerSize;
        if (u.count > 1) line += " · " + u.count + " widgets";
        usageHint.textContent = line;
      }
      card.appendChild(usageHint);
      fieldRow(card, "Label", "text", img.label || "", (v) => {
        img.label = v;
        markDirty();
      });
      const hwImg = window.LucarneHardware ? window.LucarneHardware.get(LE.project) : null;
      const volEnabledImg = hwImg && hwImg.volume && hwImg.volume.enabled;
      const imgStorageOpts = (window.LucarneAssets.IMAGE_STORAGE || []).slice();
      if (volEnabledImg) imgStorageOpts.push({ value: "volume", label: "Internal partition (FFat)" });
      else imgStorageOpts.push({ value: "volume", label: "Internal partition — enable Volume in Hardware" });
      enumRow(
        card,
        "Storage",
        imgStorageOpts,
        img.storage || "flash",
        (v) => {
          img.storage = v;
          if (v === "sd" && window.LucarneHardware) {
            img.source = window.LucarneHardware.sdDevicePath(LE.project, id, img.source);
          } else if (v === "volume" && window.LucarneHardware) {
            img.source = window.LucarneHardware.volumeDevicePath(LE.project, id, img.source);
          }
          markDirty();
          refreshDock();
        }
      );
      if (img.storage === "sd") {
        fieldRow(card, "SD path", "text", img.source || "", (v) => {
          img.source = v;
          markDirty();
        });
        const pathHint = document.createElement("div");
        pathHint.className = "hint";
        pathHint.textContent = "Device path on SD card. Default follows Hardware assets folder.";
        card.appendChild(pathHint);
      } else if (img.storage === "volume") {
        fieldRow(card, "Volume path", "text", img.source || "", (v) => {
          img.source = v;
          markDirty();
        });
        const pathHint = document.createElement("div");
        if (!volEnabledImg) {
          pathHint.className = "hint hint-bad";
          pathHint.textContent = "Volume is disabled in Hardware — export will not include binary files.";
        } else {
          pathHint.className = "hint";
          pathHint.textContent = "Path on internal partition (FFat/LittleFS). Upload via Arduino FFat tool.";
        }
        card.appendChild(pathHint);
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
          markDirty("Delete image");
          refreshDock();
          toastUndo("Image \u201c" + (img.label || id) + "\u201d deleted");
        })
      );
      imgSec.appendChild(card);
    });

    const icSec = section(host, "Icon export default");
    const icExportHint = document.createElement("div");
    icExportHint.className = "hint";
    icExportHint.textContent =
      "Default storage for new icons. Override per widget in Inspector. Mono built-ins always stay in flash.";
    icSec.appendChild(icExportHint);
    const hw = window.LucarneHardware ? window.LucarneHardware.get(LE.project) : null;
    const sdEnabled = hw && hw.sd && hw.sd.enabled;
    const volEnabled = hw && hw.volume && hw.volume.enabled;
    const iconStorageOpts = [{ value: "flash", label: "Project header (flash)" }];
    if (sdEnabled) iconStorageOpts.push({ value: "sd", label: "SD card" });
    else iconStorageOpts.push({ value: "sd", label: "SD card — enable SD in Hardware" });
    if (volEnabled) iconStorageOpts.push({ value: "volume", label: "Internal partition (FFat)" });
    else iconStorageOpts.push({ value: "volume", label: "Internal partition — enable Volume in Hardware" });
    if (!LE.project.iconExportStorage) LE.project.iconExportStorage = "flash";
    if (!LE.project.iconAnim) LE.project.iconAnim = { maxFrames: 0, frameStep: 1 };
    enumRow(icSec, "Default", iconStorageOpts, LE.project.iconExportStorage, (v) => {
      LE.project.iconExportStorage = v;
      markDirty();
      refreshDock();
      refreshMemoryBar();
    });
    const animHint = document.createElement("div");
    animHint.className = "hint";
    animHint.textContent = "Animated emoji: limit exported frames to reduce flash/SD size.";
    icSec.appendChild(animHint);
    fieldRow(icSec, "Max frames (0 = all)", "number", LE.project.iconAnim.maxFrames || 0, (v) => {
      LE.project.iconAnim.maxFrames = Math.max(0, parseInt(v, 10) || 0);
      markDirty();
      refreshMemoryBar();
    });
    fieldRow(icSec, "Frame step (1 = all)", "number", LE.project.iconAnim.frameStep || 1, (v) => {
      let n = parseInt(v, 10) || 1;
      if (n < 1) n = 1;
      LE.project.iconAnim.frameStep = n;
      markDirty();
      refreshMemoryBar();
    });
    if (LE.project.iconExportStorage === "sd" && !sdEnabled) {
      const warn = document.createElement("div");
      warn.className = "hint hint-bad";
      warn.textContent = "SD is disabled in Hardware — export will fall back to flash.";
      icSec.appendChild(warn);
    } else if (LE.project.iconExportStorage === "volume" && !volEnabled) {
      const warn = document.createElement("div");
      warn.className = "hint hint-bad";
      warn.textContent = "Volume is disabled in Hardware — export will fall back to flash.";
      icSec.appendChild(warn);
    } else if (LE.project.iconExportStorage === "sd") {
      const sdHint = document.createElement("div");
      sdHint.className = "hint";
      sdHint.textContent =
        "Frames export as raw .rgb565 + .alpha under " +
        (window.LucarneHardware ? window.LucarneHardware.normalizeDir(hw.sd.assetsDir) : "/assets") +
        "/icons/. No compression.";
      icSec.appendChild(sdHint);
    } else if (LE.project.iconExportStorage === "volume" && volEnabled) {
      const volHint = document.createElement("div");
      volHint.className = "hint";
      volHint.textContent =
        "Frames export as .rgb565 + .alpha under " +
        (window.LucarneHardware ? window.LucarneHardware.normalizeDir(hw.volume.assetsDir) : "/assets") +
        "/icons/. Use Upload FFAT in Arduino (not SPIFFS).";
      icSec.appendChild(volHint);
    }

    const icLibSec = section(host, "Icon library");
    const icHint = document.createElement("div");
    icHint.className = "hint";
    icHint.textContent =
      "Pick an icon to place it on the screen (designer). Saves to library only from blueprint/simulate.";
    icLibSec.appendChild(icHint);

    const icBrowse = row(icLibSec, "");
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
    icFile.accept = "image/png,image/jpeg,image/webp,image/bmp,.bmp,image/svg+xml";
    icFile.hidden = true;
    const icAdd = row(icLibSec, "");
    const icImportBtn = btn("Import icon", "primary tiny", () => icFile.click());
    icAdd.appendChild(icImportBtn);
    icLibSec.appendChild(icFile);

    icFile.addEventListener("change", () => {
      const file = icFile.files && icFile.files[0];
      if (!file) return;
      busy(icImportBtn, async () => {
        try {
          const data = await window.LucarneAssets.importIcon(file);
          const id = S.genId("ico");
          LE.project.icons[id] = data;
          markDirty("Import icon");
          refreshDock();
          toast("Icon \u201c" + file.name + "\u201d added to library", "success");
        } catch (e) {
          console.warn("Icon import failed", e);
          toast("Icon import failed (" + file.name + "): " + errorText(e, "unsupported or corrupted file"), "error");
        } finally {
          icFile.value = "";
        }
      }, "Importing\u2026");
    });

    Object.keys(LE.project.icons).forEach((id) => {
      const ic = LE.project.icons[id];
      const card = document.createElement("div");
      card.className = "section subcard";
      const cv = document.createElement("canvas");
      cv.width = 32;
      cv.height = 32;
      cv.className = "icon-field-preview icon-lib-preview";
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
              if (w.type === "button" && w.icon === prefix) w.icon = "none";
              if (w.type === "menu") {
                (w.items || []).forEach((it) => {
                  if (it.icon === prefix) it.icon = "none";
                });
              }
            });
          });
          markDirty("Delete icon");
          refreshDock();
          toastUndo("Icon \u201c" + (ic && ic.label ? ic.label : id) + "\u201d deleted");
        })
      );
      icLibSec.appendChild(card);
    });
  }

  /* ---------- Data pane ---------- */
  function buildData() {
    const host = dom.tabData;
    host.innerHTML = "";
    const CK = window.LucarneCalcKeys;
    const sec = section(
      host,
      "Data keys",
      btn("+ Key", "tiny primary", () => {
        LE.project.keys.push({ name: "key" + LE.project.keys.length, type: "float", value: 0 });
        markDirty();
        refreshDock();
      })
    );
    const validation = CK ? CK.validateProject(LE.project) : { errors: [] };
    const errorsByKey = new Map();
    validation.errors.forEach((e) => {
      if (!errorsByKey.has(e.name)) errorsByKey.set(e.name, []);
      errorsByKey.get(e.name).push(e.message);
    });
    LE.project.keys.forEach((k, idx) => {
      const card = document.createElement("div");
      card.className = "section subcard";
      fieldRow(card, "Name", "text", k.name, (v) => ((k.name = v), markDirty()));
      enumRow(card, "Type", [
        { value: "float", label: "float" },
        { value: "int", label: "int" },
        { value: "bool", label: "bool" },
        { value: "string", label: "string" },
        { value: "calc", label: "calc (formula)" },
      ], k.type, (v) => {
        k.type = v;
        if (v === "bool") k.value = !!k.value;
        else if (v === "string") k.value = String(k.value || "");
        else if (v === "calc") {
          if (!k.formula) k.formula = "0";
          k.value = 0;
        } else k.value = Number(k.value) || 0;
        markDirty();
        refreshDock();
      });
      if (k.type === "calc") {
        fieldRow(card, "Formula", "text", k.formula || "", (v) => {
          k.formula = v;
          markDirty();
          refreshDock();
        });
        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = "Reference other key names directly, e.g. CH1_Voltage * CH1_Current. Supports + - * / ( ).";
        card.appendChild(hint);
        const keyErrors = errorsByKey.get(k.name);
        if (keyErrors && keyErrors.length) {
          const err = document.createElement("div");
          err.className = "hint hint-bad";
          err.textContent = keyErrors.join(" ");
          card.appendChild(err);
        } else if (CK) {
          const r = CK.tryParse(k.formula || "0");
          if (r.ok) {
            const values = CK.resolveAll(LE.project);
            const preview = document.createElement("div");
            preview.className = "hint";
            preview.textContent = "= " + values.get(k.name);
            card.appendChild(preview);
          }
        }
      } else if (k.type === "bool") {
        fieldRow(card, "Value", "checkbox", k.value, (v) => ((k.value = v), markDirty()));
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
          markDirty("Delete key");
          refreshDock();
          toastUndo("Key \u201c" + (k.name || "unnamed") + "\u201d deleted");
        })
      );
      sec.appendChild(card);
    });
  }

  /* ---------------- Toolbar ---------------- */
  function buildDeviceSelect() {
    dom.deviceSel.innerHTML = "";
    Object.keys(S.DEVICES).forEach((id) => {
      const dev = S.DEVICES[id];
      const supported = S.deviceFirmwareSupported(dev);
      const o = document.createElement("option");
      o.value = id;
      o.textContent = dev.label + (supported ? "" : " (firmware not implemented yet)");
      if (!supported) {
        o.disabled = true;
        o.title = "Lucarne has no display driver for this panel yet — pick a spi_rgb panel or a MIPI panel driven by HX8394, ILI9881C, JD9365 or EK79007.";
      }
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
    else if (mode === "designer") {
      if (designer && designer.fitZoom) designer.fitZoom();
      designer.render();
    } else if (mode === "simulate") simulate.render();
  }

  function applyPanelDims(w, h) {
    const pw = parseInt(w, 10);
    const ph = parseInt(h, 10);
    if (pw > 0) LE.project.panelWidth = pw;
    if (ph > 0) LE.project.panelHeight = ph;
    rerenderViews();
    sendLiveHwConfig();
  }

  function applyRotation(rot) {
    LE.project.rotation = rot;
    rerenderViews();
    sendLiveHwConfig();
  }

  function wireTablistKeys(tabs, activate, vertical) {
    tabs.forEach((b, i) => {
      b.addEventListener("keydown", (ev) => {
        const prevKeys = vertical ? ["ArrowUp", "ArrowLeft"] : ["ArrowLeft", "ArrowUp"];
        const nextKeys = vertical ? ["ArrowDown", "ArrowRight"] : ["ArrowRight", "ArrowDown"];
        let j = -1;
        if (prevKeys.indexOf(ev.key) >= 0) j = (i - 1 + tabs.length) % tabs.length;
        else if (nextKeys.indexOf(ev.key) >= 0) j = (i + 1) % tabs.length;
        else if (ev.key === "Home") j = 0;
        else if (ev.key === "End") j = tabs.length - 1;
        if (j < 0) return;
        ev.preventDefault();
        activate(tabs[j]);
      });
    });
  }

  const openMenus = [];

  function placeMenuPanel(btnEl, panel) {
    const gap = 8;
    const pad = 8;
    panel.hidden = false;
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const r = btnEl.getBoundingClientRect();
    let top = r.bottom + gap;
    let left = r.right - pw;
    if (left < pad) left = pad;
    if (left + pw > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - pad - pw);
    if (top + ph > window.innerHeight - pad) top = Math.max(pad, r.top - gap - ph);
    panel.style.top = Math.round(top) + "px";
    panel.style.left = Math.round(left) + "px";
  }

  function wireMenu(btnEl, panel) {
    if (!btnEl || !panel) return;
    const items = () =>
      Array.from(panel.querySelectorAll("button, a[href], select, input:not([type=hidden]):not([hidden])")).filter(
        (el) => el.offsetParent !== null && !el.disabled
      );
    const close = (restore) => {
      if (panel.hidden) return;
      panel.hidden = true;
      btnEl.setAttribute("aria-expanded", "false");
      btnEl.closest(".tb-menu")?.classList.remove("open");
      if (restore) btnEl.focus();
    };
    const open = (focusFirst) => {
      openMenus.forEach((m) => m !== close && m(false));
      btnEl.closest(".tb-menu")?.classList.add("open");
      placeMenuPanel(btnEl, panel);
      btnEl.setAttribute("aria-expanded", "true");
      if (focusFirst) {
        const list = items();
        if (list[0]) list[0].focus();
      }
    };
    const reposition = () => {
      if (!panel.hidden) placeMenuPanel(btnEl, panel);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    openMenus.push(close);
    btnEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (panel.hidden) open(ev.detail === 0);
      else close(false);
    });
    btnEl.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowDown" && panel.hidden) {
        ev.preventDefault();
        open(true);
      }
    });
    panel.addEventListener("click", (ev) => {
      if (ev.target.closest("button, a[href]")) close(false);
    });
    panel.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        close(true);
        return;
      }
      if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
      if (ev.target.tagName === "SELECT") return;
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (!list.length) return;
      ev.preventDefault();
      const j = ev.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
      list[j].focus();
    });
    document.addEventListener("click", (ev) => {
      if (!panel.hidden && !panel.contains(ev.target) && ev.target !== btnEl && !btnEl.contains(ev.target)) close(false);
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !panel.hidden) close(true);
    });
  }

  const RESPONSIVE_SLOTS = [
    { slot: "slotNav", query: "(max-width: 1280px)" },
    { slot: "slotFlash", query: "(max-width: 1150px)" },
    { slot: "slotPanel", query: "(max-width: 1024px)" },
    { slot: "slotRotation", query: "(max-width: 1024px)" },
    { slot: "slotLiveSpeed", query: "(max-width: 1024px)" },
    { slot: "slotHelp", query: "(max-width: 900px)" },
  ];

  function setupResponsiveToolbar() {
    const panel = $("moreMenuPanel");
    const moreBtn = $("btnMoreMenu");
    if (!panel || !moreBtn) return;
    const moreWrap = moreBtn.closest(".tb-more");
    const serialHint = $("moreSerialHint");
    const hasSerial = hasWebSerial();
    const entries = RESPONSIVE_SLOTS.map((m) => {
      const slot = $(m.slot);
      const row = panel.querySelector('.tb-more-row[data-more="' + m.slot + '"]');
      const target = row ? row.querySelector(".tb-more-slot") : null;
      return { slot, row, target, mq: window.matchMedia(m.query), children: slot ? Array.from(slot.children) : [] };
    }).filter((e) => e.slot && e.row && e.target);
    function sync() {
      let any = !hasSerial;
      entries.forEach((e) => {
        const compact = e.mq.matches;
        const dest = compact ? e.target : e.slot;
        e.children.forEach((c) => {
          if (c.parentNode !== dest) dest.appendChild(c);
        });
        e.row.hidden = !compact;
        if (compact) any = true;
      });
      if (serialHint) serialHint.hidden = hasSerial;
      if (moreWrap) moreWrap.hidden = !any;
      if (!any) panel.hidden = true;
    }
    entries.forEach((e) => e.mq.addEventListener("change", sync));
    sync();
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
      if (window.LucarneHardware && window.LucarneHardware.applyDeviceDefaults) {
        window.LucarneHardware.applyDeviceDefaults(LE.project, d);
      } else {
        const hw = window.LucarneHardware ? window.LucarneHardware.get(LE.project) : null;
        if (hw && hw.display) {
          if (d.colorOrder) hw.display.colorOrder = d.colorOrder;
          if (d.invert !== undefined) hw.display.invert = d.invert;
        }
      }
      syncToolbar();
      rerenderViews();
      void sendLiveHwConfig();
      refreshDock();
    });
    dom.panelW.addEventListener("change", () => applyPanelDims(dom.panelW.value, dom.panelH.value));
    dom.panelH.addEventListener("change", () => applyPanelDims(dom.panelW.value, dom.panelH.value));
    dom.rotationSel.addEventListener("change", () => {
      applyRotation(parseInt(dom.rotationSel.value, 10) || 0);
    });
    document.querySelectorAll(".modeTab").forEach((b) =>
      b.addEventListener("click", () => setMode(b.dataset.mode))
    );
    document.querySelectorAll(".settingsTab").forEach((b) =>
      b.addEventListener("click", () => openProjectSettings(b.dataset.tab))
    );
    const btnProjectSettings = $("btnProjectSettings");
    if (btnProjectSettings) btnProjectSettings.addEventListener("click", () => openProjectSettings());
    const settingsClose = $("settingsClose");
    if (settingsClose) settingsClose.addEventListener("click", closeProjectSettings);
    if (dom.settingsModal) {
      dom.settingsModal.addEventListener("click", (ev) => {
        if (ev.target === dom.settingsModal) closeProjectSettings();
      });
    }
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && dom.settingsModal && !dom.settingsModal.hidden && !overlayAbove(dom.settingsModal)) closeProjectSettings();
    });

    if (dom.btnUndo) dom.btnUndo.addEventListener("click", undo);
    if (dom.btnRedo) dom.btnRedo.addEventListener("click", redo);
    document.addEventListener("keydown", (ev) => {
      const tag = (ev.target && ev.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const cmd = ev.ctrlKey || ev.metaKey;
      if (!cmd) return;
      const key = ev.key.toLowerCase();
      if (key === "z" && ev.shiftKey) {
        ev.preventDefault();
        redo();
      } else if (key === "z") {
        ev.preventDefault();
        undo();
      } else if (key === "y") {
        ev.preventDefault();
        redo();
      }
    });
    document.addEventListener("keydown", (ev) => {
      const tag = (ev.target && ev.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (ev.target && ev.target.isContentEditable) return;
      if (document.querySelector(".modal:not([hidden])") || document.querySelector(".tour-root")) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === "?" || (ev.key === "/" && ev.shiftKey)) {
        ev.preventDefault();
        if (window.LucarneHelp) window.LucarneHelp.openShortcuts(LE);
        return;
      }
      if (ev.key === "1") {
        ev.preventDefault();
        setMode("blueprint");
      } else if (ev.key === "2") {
        ev.preventDefault();
        setMode("designer");
      } else if (ev.key === "3") {
        ev.preventDefault();
        setMode("simulate");
      }
    });
    const btnLive = $("btnLive");
    btnLive.addEventListener("click", () => busy(btnLive, toggleLive, "Connecting\u2026"));
    const btnFlash = $("btnFlash");
    if (btnFlash) {
      btnFlash.addEventListener("click", () => {
        if (window.LucarneFlash) window.LucarneFlash.open(LE);
      });
    }
    if (!hasWebSerial()) {
      [btnLive, btnFlash].forEach((b) => {
        if (!b) return;
        b.disabled = true;
        b.title = "Requires Chrome or Edge (Web Serial)";
        b.setAttribute("aria-label", b.textContent.trim() + " \u2014 requires Chrome or Edge (Web Serial)");
      });
    }
    if (dom.liveSpeed) {
      dom.liveSpeed.addEventListener("change", () => {
        S.setLiveSpeedId(dom.liveSpeed.value);
        if (LE.live && LE.live.setBaudRate) LE.live.setBaudRate(S.getLiveBaud());
        toast("Speed: " + (S.liveSpeedById(dom.liveSpeed.value) || {}).label + " — reconnect Live", "info");
      });
    }
    const btnExport = $("btnExport");
    btnExport.addEventListener("click", () => busy(btnExport, openExport, "Building export\u2026"));
    $("btnSave").addEventListener("click", saveProject);
    $("btnLoad").addEventListener("click", () => dom.fileLoad.click());
    dom.fileLoad.addEventListener("change", loadProject);
    $("btnNew").addEventListener("click", newProject);
    const btnProjects = $("btnProjects");
    if (btnProjects) {
      btnProjects.addEventListener("click", () => {
        if (window.LucarneProjects) window.LucarneProjects.openPanel(LE);
      });
    }

    wireMenu($("btnFileMenu"), $("fileMenuPanel"));
    wireMenu($("btnMoreMenu"), $("moreMenuPanel"));
    setupResponsiveToolbar();

    const btnWelcome = $("btnWelcome");
    if (btnWelcome) btnWelcome.addEventListener("click", () => window.LucarneWelcome && window.LucarneWelcome.open(LE));
    const btnTour = $("btnTour");
    if (btnTour) btnTour.addEventListener("click", () => window.LucarneTour && window.LucarneTour.start(LE));
    const btnShortcuts = $("btnShortcuts");
    if (btnShortcuts) btnShortcuts.addEventListener("click", () => window.LucarneHelp && window.LucarneHelp.openShortcuts(LE));
    const btnHelp = $("btnHelp");
    if (btnHelp) btnHelp.addEventListener("click", () => window.LucarneHelp && window.LucarneHelp.openShortcuts(LE));

    const modeTabs = Array.from(document.querySelectorAll(".modeTab"));
    wireTablistKeys(modeTabs, (b) => {
      setMode(b.dataset.mode);
      b.focus();
    });
    const settingsTabs = Array.from(document.querySelectorAll(".settingsTab"));
    wireTablistKeys(settingsTabs, (b) => {
      openProjectSettings(b.dataset.tab);
      b.focus();
    }, true);
    if (dom.modalExportTabs) {
      const exportTabs = Array.from(dom.modalExportTabs.querySelectorAll(".export-tab"));
      wireTablistKeys(exportTabs, (b) => {
        setExportTab(b.dataset.exportTab);
        b.focus();
      });
    }

    $("modalClose").addEventListener("click", closeExport);
    $("modalCopy").addEventListener("click", copyExport);
    $("modalDownload").addEventListener("click", downloadExport);
    if (dom.modalDownloadAllSd) dom.modalDownloadAllSd.addEventListener("click", downloadExportZip);
    if (dom.modalExportTabs) {
      dom.modalExportTabs.querySelectorAll(".export-tab").forEach((b) => {
        b.addEventListener("click", () => setExportTab(b.dataset.exportTab));
      });
    }
    dom.modal.addEventListener("click", (ev) => {
      if (ev.target === dom.modal) closeExport();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !dom.modal.hidden && !overlayAbove(dom.modal)) closeExport();
    });
  }

  /* ---------------- Export modal ---------------- */
  let exportFiles = [];
  let exportViewFiles = [];
  let exportIndex = 0;
  let exportTab = "headers";

  function exportFileKind(f) {
    if (f.kind) return f.kind;
    if (f.binary) return "sd";
    return "header";
  }

  function isExternalExportFile(f) {
    const k = exportFileKind(f);
    return k === "sd" || k === "volume";
  }

  function isUploadBinary(f) {
    return !!f.binary && f.kind !== "manifest";
  }

  function refreshExportView() {
    exportViewFiles = exportFiles.filter((f) =>
      exportTab === "sd" ? isExternalExportFile(f) : exportFileKind(f) === "header"
    );
    dom.modalFiles.innerHTML = "";
    if (dom.modalDownloadAllSd) {
      const sdBins = exportFiles.filter((f) => isUploadBinary(f));
      const allCount = exportFiles.length;
      dom.modalDownloadAllSd.hidden = exportTab === "sd" ? sdBins.length < 1 : allCount < 2;
      dom.modalDownloadAllSd.textContent =
        exportTab === "sd" ? "Download SD .zip" : "Download all .zip";
    }
    if (!exportViewFiles.length) {
      const empty = document.createElement("div");
      empty.className = "hint modal-empty";
      empty.textContent =
        exportTab === "sd"
          ? "No external files. Set icon/image storage to SD or Internal partition in Assets, then export again."
          : "No header files.";
      dom.modalFiles.appendChild(empty);
      dom.modalText.value = "";
      if (dom.modalCopy) dom.modalCopy.disabled = true;
      return;
    }
    exportViewFiles.forEach((f, i) => {
      const b = document.createElement("button");
      b.className = "modal-file" + (i === 0 ? " active" : "");
      b.textContent = f.name;
      b.addEventListener("click", () => showExportFile(i));
      dom.modalFiles.appendChild(b);
    });
    showExportFile(0);
  }

  function showExportFile(i) {
    exportIndex = i;
    const f = exportViewFiles[i];
    if (!f) return;
    if (f.binary) {
      dom.modalText.value =
        "Binary file: " + f.name + "\nSize: " + f.content.length + " bytes\nUse Download SD .zip for all SD assets.";
    } else {
      dom.modalText.value = f.content;
    }
    if (dom.modalCopy) dom.modalCopy.disabled = !!f.binary;
    dom.modalFiles.querySelectorAll(".modal-file").forEach((x, j) => x.classList.toggle("active", j === i));
  }

  function setExportTab(tab) {
    exportTab = tab;
    if (dom.modalExportTabs) {
      dom.modalExportTabs.querySelectorAll(".export-tab").forEach((b) => {
        const on = b.dataset.exportTab === tab;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      });
    }
    refreshExportView();
  }

  function downloadExportFile(f) {
    const blob = f.binary
      ? new Blob([Uint8Array.from(f.content, (c) => c.charCodeAt(0) & 0xff)], { type: "application/octet-stream" })
      : new Blob([f.content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = f.name.split("/").pop();
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  }

  function buildExportSummaryHtml(built, totalLabel, fileCount) {
    const f = built.flash || {};
    const parts = [];
    parts.push("<b>Export total: " + totalLabel + " (" + fileCount + " files)</b>");
    if (f.inoGenerated) {
      parts.push(
        "Put every generated file in a sketch folder, then rename <code>" +
          escapeHtml(f.inoName || "Sketch.ino") +
          "</code> (and that folder) to your sketch's name - it already wires the display/UI for you, no extra code needed to see your UI."
      );
    } else {
      parts.push(
        "This display family has no auto-generated sketch yet - open <code>Projet.h</code> and copy the commented recipe at the bottom into your own .ino."
      );
    }
    if (f.sdFileCount) {
      parts.push(
        "This project also needs " +
          f.sdFileCount +
          " external asset file(s) - copy the <code>assets/</code> folder per SD_MANIFEST.txt / VOLUME_MANIFEST.txt (see the \u201cFiles (SD / Volume)\u201d tab)."
      );
    }
    if (built.flash) {
      const fmtMb = (n) => (n / 1048576 >= 1 ? (n / 1048576).toFixed(2) + " MB" : Math.round(n / 1024) + " KB");
      const pct = f.appPartition ? Math.round((f.totalEstimate / f.appPartition) * 100) : 0;
      parts.push(
        "Flash budget: header " +
          fmtMb(f.projetBytes || 0) +
          " + library ~" +
          Math.round((f.libEstimate || 0) / 1024) +
          " KB \u2248 " +
          fmtMb(f.totalEstimate || 0) +
          (pct ? " (" + pct + "% of the app slot)" : "") +
          ". " +
          (f.animCount ? f.animCount + " animated icon(s)." : "Static icons only.")
      );
      if (f.volFatBytes && f.dataMax && f.volFatBytes > 0) {
        const fmt = window.LucarneMemory ? window.LucarneMemory.formatBytes : String;
        parts.push("Volume FAT estimate: ~" + escapeHtml(fmt(f.volFatBytes)) + " / " + escapeHtml(fmt(f.dataMax)) + " (" + f.sdFileCount + " files).");
      }
      if (f.bakeWarnings && f.bakeWarnings.length) {
        parts.push(
          '<span class="hint-warn">' + f.bakeWarnings.map(escapeHtml).join("<br>") + "</span>"
        );
      }
    }
    return parts.map((t) => "<div>" + t + "</div>").join("");
  }

  let exportRelease = null;

  async function openExport() {
    const opener = document.activeElement;
    let failed = null;
    let built = null;
    try {
      if (window.LucarneIconPacks) await window.LucarneIconPacks.preloadProject(LE.project);
      if (window.LucarneTabler) await window.LucarneTabler.preloadProject(LE.project);
      if (window.LucarneFluentEmoji) await window.LucarneFluentEmoji.preloadProject(LE.project);
      if (window.LucarneTextStyle) await window.LucarneTextStyle.bakeAllWidgetStyles(LE);
      built = await window.LucarneExport.buildAll(LE);
      exportFiles = built.files || built;
      const A = window.LucarneAssets;
      const totalBytes = A && A.exportTotalBytes ? A.exportTotalBytes(exportFiles) : 0;
      const totalLabel = A && A.formatExportSize ? A.formatExportSize(totalBytes) : totalBytes + " B";
      if (dom.modalExportSummary) {
        dom.modalExportSummary.innerHTML = buildExportSummaryHtml(built, totalLabel, exportFiles.length);
      }
      const f = built.flash;
      const pct = f && f.appPartition ? Math.round((f.totalEstimate / f.appPartition) * 100) : 0;
      toast(
        "Export ready: " + exportFiles.length + " files, " + totalLabel + (pct ? " \u2014 " + pct + "% of the app slot" : ""),
        pct > 100 ? "warn" : "success"
      );
      const warnings = (f && f.bakeWarnings) || [];
      if (warnings.length === 1) toast(warnings[0], "warn");
      else if (warnings.length > 1) toast(warnings.length + " asset warnings \u2014 see the export summary", "warn");
    } catch (e) {
      failed = e;
      console.error("Export failed", e);
      exportFiles = [{ name: "Error", content: "Export error:\n" + (e && e.stack ? e.stack : e), kind: "header" }];
      if (dom.modalExportSummary) {
        dom.modalExportSummary.innerHTML = '<div class="hint-bad">Export failed: ' + escapeHtml(errorText(e)) + "</div>";
      }
      toast("Export failed: " + errorText(e), "error");
    }
    exportTab = "headers";
    setExportTab("headers");
    const wasHidden = dom.modal.hidden;
    dom.modal.hidden = false;
    const focusTarget = failed ? $("modalClose") : dom.modal.querySelector(".export-tab.active");
    const card = dom.modal.querySelector(".modal-card");
    if (wasHidden && card && DLG && DLG.trapFocus) {
      exportRelease = DLG.trapFocus(card, { opener, initialFocus: focusTarget || undefined });
    } else if (focusTarget) {
      focusTarget.focus();
    }
    return built;
  }

  function closeExport() {
    if (dom.modal.hidden) return;
    dom.modal.hidden = true;
    const release = exportRelease;
    exportRelease = null;
    if (release) release();
  }

  function copyExport() {
    const f = exportViewFiles[exportIndex];
    if (!f || f.binary) {
      toast("Copy not available for binary files", "warn");
      return;
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      dom.modalText.focus();
      dom.modalText.select();
      toast("Clipboard not available here \u2014 the text is selected, press Ctrl+C", "warn");
      return;
    }
    navigator.clipboard
      .writeText(f.content)
      .then(() => toast("Copied " + f.name.split("/").pop() + " to the clipboard", "success"))
      .catch((e) => {
        console.warn("Clipboard write failed", e);
        dom.modalText.focus();
        dom.modalText.select();
        toast("Copy blocked by the browser \u2014 the text is selected, press Ctrl+C", "warn");
      });
  }

  function exportZipName(suffix) {
    const base = String(LE.project.name || "project").replace(/[^a-zA-Z0-9_-]+/g, "_");
    return base + suffix + ".zip";
  }

  function downloadExportZip() {
    const Z = window.LucarneZipExport;
    if (!Z) {
      toast("Zip export unavailable", "error");
      return;
    }
    let files = exportFiles;
    let suffix = "_export";
    if (exportTab === "sd") {
      files = exportFiles.filter((f) => isUploadBinary(f));
      suffix = "_ffat";
    }
    if (!files.length) {
      toast("Nothing to zip", "warn");
      return;
    }
    Z.downloadZip(files, exportZipName(suffix));
    toast("Downloading " + files.length + " files as " + exportZipName(suffix), "info");
  }

  function downloadExport() {
    const f = exportViewFiles[exportIndex];
    if (!f) return;
    downloadExportFile(f);
  }

  /* ---------------- Save / Load / New ---------------- */
  // Full, self-contained (no IndexedDB dependency) clone of a project: images
  // and icons are inlined as base64, matching what a downloaded .lucarne.json
  // contains. Shared by the file-download Save and the in-browser Project
  // manager, so both produce byte-identical, portable snapshots.
  function serializeProjectClone(project) {
    const clone = JSON.parse(JSON.stringify(project));
    if (project.images) {
      clone.images = {};
      Object.keys(project.images).forEach((id) => {
        const img = project.images[id];
        if (!img) return;
        if (img.pixels) clone.images[id] = window.LucarneAssets.serialize(img);
        else clone.images[id] = img;
      });
    }
    if (project.icons) {
      clone.icons = {};
      Object.keys(project.icons).forEach((id) => {
        clone.icons[id] = window.LucarneAssets.serializeIcon(project.icons[id]);
      });
    }
    Object.values(clone.fonts || {}).forEach((f) => {
      delete f._atlas;
      delete f._loaded;
    });
    delete clone._pmId;
    return clone;
  }

  function saveProject() {
    const clone = serializeProjectClone(LE.project);
    const blob = new Blob([JSON.stringify(clone, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (LE.project.name || "project") + ".lucarne.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Project saved", "success");
  }

  function projectHasWork() {
    const p = LE.project;
    if (!p) return false;
    if (history && history.canUndo()) return true;
    const widgets = (p.screens || []).reduce((n, s) => n + ((s.widgets && s.widgets.length) || 0), 0);
    return widgets > 0 || (p.keys && p.keys.length > 0) || Object.keys(p.images || {}).length > 0;
  }

  function confirmReplaceProject(actionLabel, proceed) {
    if (!projectHasWork()) {
      proceed();
      return;
    }
    DLG.confirm(
      actionLabel,
      "This replaces <b>" +
        escapeHtml(LE.project.name || "the current project") +
        "</b> in the editor and clears its undo history. Use <i>File \u203a Save to file</i> or <i>Projects</i> first if you want to keep a copy.",
      { okLabel: "Replace project", onConfirm: proceed }
    );
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("could not read the file"));
      reader.readAsText(file);
    });
  }

  function loadProject(ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    confirmReplaceProject("Open project file", () => {
      busy($("btnFileMenu"), async () => {
        let obj;
        try {
          obj = JSON.parse(await readFileText(file));
        } catch (e) {
          console.warn("Project file parse failed", e);
          toast("Invalid file \u201c" + file.name + "\u201d: " + errorText(e, "not a Lucarne project"), "error");
          return;
        }
        if (!obj || typeof obj !== "object" || !Array.isArray(obj.screens)) {
          toast("Invalid file \u201c" + file.name + "\u201d: no screens found, not a Lucarne project", "error");
          return;
        }
        try {
          await applyProject(obj);
          toast("Project \u201c" + (LE.project.name || file.name) + "\u201d loaded", "success");
        } catch (e) {
          console.error("Project load failed", e);
          toast("Could not load \u201c" + file.name + "\u201d: " + errorText(e), "error");
        }
      }, "Loading project\u2026");
    });
  }

  async function applyProject(obj) {
    LE.project = S.hydrate(obj);
    project = LE.project;
    await S.idbLoadImages(LE.project);
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
    if (graph && graph.resetView) graph.resetView();
    setMode("blueprint");
    refreshDock();
    autosave();
    preloadIcons();
    if (history) history.reset();
  }

  async function loadFromUrl() {
    const src = LE.project.uiSource || S.defaultUiSource();
    const url = (src.url || "").trim();
    if (!url) {
      toast("Set URL in Inspector → UI source", "warn");
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const obj = await res.json();
      await applyProject(obj);
      toast("Loaded from URL", "success");
    } catch (e) {
      toast("URL: " + (e && e.message ? e.message : "load failed"), "error");
    }
  }

  async function loadFromSd() {
    if (!LE.live || !LE.live.isConnected()) {
      toast("Connect Live first", "warn");
      return;
    }
    const src = LE.project.uiSource || S.defaultUiSource();
    const path = (src.sdPath || "/ui.lucarne.json").trim();
    if (!path) {
      toast("Set SD path in Inspector → UI source", "warn");
      return;
    }
    try {
      const obj = await LE.live.loadFromSd(path);
      await applyProject(obj);
      toast("Loaded from SD", "success");
    } catch (e) {
      toast("SD: " + (e && e.message ? e.message : "load failed"), "error");
    }
  }

  function newProject() {
    confirmReplaceProject("Start a new project", () => {
      if (window.LucarneNewProjectWizard) {
        window.LucarneNewProjectWizard.open(LE);
      } else {
        applyProject(S.defaultProject());
      }
    });
  }

  /* ---------------- Boot ---------------- */
  function updateLiveBtn(on) {
    const b = $("btnLive");
    if (!b) return;
    b.classList.toggle("on", on);
    b.innerHTML = on ? 'Live<span class="live-dot" aria-hidden="true"></span>' : "Live";
    b.setAttribute("aria-pressed", String(!!on));
    b.title = on ? "Disconnect USB Live preview" : "USB Live preview on real hardware (Chrome/Edge) — not Bluetooth";
  }

  async function toggleLive() {
    if (!LE.live) return;
    if (!hasWebSerial()) {
      toast("Live needs Web Serial \u2014 open the Studio in Chrome or Edge on desktop", "warn");
      return;
    }
    if (LE.live.isConnected()) {
      await LE.live.disconnect();
      toast("Live disconnected", "info");
    } else {
      try {
        const dev = S.device(LE.project);
        if (dev.family === "oled_mono" && S.getLiveBaud() !== 921600) {
          S.setLiveBaud(921600);
          if (dom.liveSpeed) dom.liveSpeed.value = S.getLiveSpeedId();
          toast("Live speed set to Balanced (921600) for the OLED receiver", "info");
        }
        if (LE.live.setBaudRate) LE.live.setBaudRate(S.getLiveBaud());
        await LE.live.connect();
        await sendLiveHwConfig();
        toast("Live connected", "success");
      } catch (e) {
        toast("Live: " + (e && e.message ? e.message : "connection failed"), "error");
      }
    }
  }

  async function start() {
    let lastSaveErrorAt = 0;
    S.setSaveErrorHandler((e) => {
      saveFailed = true;
      const quota = e && e.name === "QuotaExceededError";
      const detail = quota ? "browser storage is full" : e && e.name === "ImageStoreError" ? "images could not be stored (" + errorText(e) + ")" : errorText(e);
      console.warn("Autosave failed", e);
      const now = Date.now();
      if (now - lastSaveErrorAt < 15000) return;
      lastSaveErrorAt = now;
      toast(
        quota
          ? "Autosave failed: browser storage is full. Delete entries in Projects or use Save to file."
          : "Autosave failed: " + detail + ". Use Save to file to keep your work.",
        { type: "error", action: { label: "Save to file", run: () => saveProject() } }
      );
    });
    const loaded = await S.load();
    project = loaded || S.defaultProject();
    LE.project = project;
    if (!project.panelWidth || !project.panelHeight) {
      const d = S.device(project);
      project.panelWidth = d.w;
      project.panelHeight = d.h;
    }
    boot();
    const loadErr = S.loadError ? S.loadError() : null;
    if (loadErr) {
      toast(
        "The last session could not be restored (" +
          loadErr.message +
          ")." +
          (loadErr.backupKey ? " A raw copy was kept in browser storage under \u201c" + loadErr.backupKey + "\u201d." : "") +
          " Started from the demo project.",
        { type: "warn", duration: 10000 }
      );
    }
  }

  function boot() {
    if (H) {
      history = H.init(LE, { onChange: renderHistoryBar, onRestore: onHistoryRestore });
    }
    graph = window.LucarneGraph.init(dom.graphHost, LE);
    designer = window.LucarneDesigner.init(dom.designerHost, LE);
    simulate = window.LucarneSimulate.init(dom.simHost, LE);
    LE.live = window.LucarneLive.init({
      getProject: () => LE.project,
      onState: updateLiveBtn,
      baudRate: S.getLiveBaud(),
      onError: (e) => {
        const msg = e && e.message ? e.message : "";
        if (msg.indexOf("ACK timeout") >= 0) {
          toast("Live: frame not confirmed — next refresh will resync full screen", "warn");
          if (LE.live.requestFullRefresh) LE.live.requestFullRefresh();
          return;
        }
        if (msg.indexOf("superseded") >= 0) return;
        if (msg) toast("Live lost: " + msg, "error");
        else toast("Live disconnected", "warn");
      },
      onEmptyFrame: () => {
        toast("Live: no frame sent (empty screen buffer)", "warn");
      },
      onRestart: () => {
        toast("Live: link restored, reapplying pins", "warn");
        return sendLiveHwConfig();
      },
    });
    LE.graph = graph;
    LE.designer = designer;
    LE.simulate = simulate;

    syncToolbar();
    wireToolbar();
    setupDockPanel();
    refreshDock();
    refreshMemoryBar();
    setMode("blueprint");
    ensureFonts();
    preloadIcons();
    if (window.LucarneFluentEmoji) {
      window.LucarneFluentEmoji.ensureManifest().catch((e) => {
        console.warn("Fluent emoji manifest load failed", e);
        toast("Emoji catalog unavailable \u2014 the emoji tab of the icon picker will be empty", "warn");
      });
    }
    window.addEventListener("beforeunload", () => flushAutosave());
    queueMicrotask(() => {
      if (window.LucarneWelcome && window.LucarneWelcome.shouldShow()) window.LucarneWelcome.open(LE);
    });
  }

  start();
})();
