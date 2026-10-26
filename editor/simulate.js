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

  function init(host, LE) {
    host.innerHTML = "";
    const root = el("div", "sim", host);
    const device = el("div", "sim-device", root);
    const touchHint = el("div", "sim-touch-hint", device);
    touchHint.textContent = "Touch mode — tap widgets on screen";
    touchHint.hidden = true;
    const canvas = el("canvas", "", device);
    canvas.id = "simCanvas";

    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Simulated device screen");

    const UI = window.LucarneUiIcons;
    const dpad = el("div", "dpad", root);
    dpad.setAttribute("role", "group");
    dpad.setAttribute("aria-label", "Device buttons");
    function padBtn(cls, icon, text, label) {
      const b = el("button", cls, dpad);
      b.type = "button";
      b.setAttribute("aria-label", label);
      b.title = label;
      if (icon && UI) b.innerHTML = UI.svg(icon, { size: 20, stroke: 2.4 });
      else b.textContent = text;
      return b;
    }
    const bUp = padBtn("b-up", "chevronUp", "", "Up (Arrow Up)");
    const bLeft = padBtn("b-left", "chevronLeft", "", "Left (Arrow Left)");
    const bOk = padBtn("b-ok", null, "OK", "OK (Enter)");
    const bRight = padBtn("b-right", "chevronRight", "", "Right (Arrow Right)");
    const bDown = padBtn("b-down", "chevronDown", "", "Down (Arrow Down)");
    const bBack = padBtn("b-back", null, "Back", "Back (Backspace or Escape)");
    const stackMq = window.matchMedia("(max-width: 900px)");

    const state = {
      current: null,
      stack: [],
      sel: {},
      animating: false,
      focusFieldId: null,
      focusShapeId: null,
      focusNavId: null,
      kbKeyIndex: null,
      editDraft: null,
      dragSliderId: null,
      graphStreams: {},
    };

    function scaleFor() {
      const d = LE.dims();
      const stacked = stackMq.matches;
      const showPad = !dpad.hidden;
      const padW = showPad ? (dpad.offsetWidth || 172) + 32 : 0;
      const padH = showPad ? (dpad.offsetHeight || 172) + 32 : 0;
      const availH = host.clientHeight - 80 - (stacked ? padH : 0);
      const availW = host.clientWidth - 80 - (stacked ? 0 : padW);
      let s = Math.min(availH / d.h, availW / d.w);
      if (!isFinite(s) || s <= 0) s = 1;
      if (s > 6) s = 6;
      if (s < 0.05) s = 0.05;
      return Math.round(s * 100) / 100;
    }

    function isTouchInput() {
      return !!(LE.project.input && LE.project.input.type === "touch");
    }

    function isEncoderInput() {
      return !!(LE.project.input && LE.project.input.type === "encoder");
    }

    function virtualKbEnabled() {
      return !!(
        (LE.project.input && LE.project.input.virtualKeyboard) ||
        (LE.project.hardware && LE.project.hardware.keyboard && LE.project.hardware.keyboard.enabled)
      );
    }

    function touchWidgetsEnabled() {
      return isTouchInput() || virtualKbEnabled();
    }

    function resolveField(field) {
      const KB = window.LucarneKeyboard;
      if (!field || field.type !== "textfield") return null;
      if (KB && KB.ensureFieldDataKey) return KB.ensureFieldDataKey(field, LE.project);
      if (!String(field.key || "").trim()) {
        field.key = "tf_" + String(field.id || "field").replace(/[^a-zA-Z0-9_]/g, "_");
      }
      return field;
    }

    function findTypingField(screen) {
      if (!screen) return null;
      if (state.focusFieldId) {
        const focused = findWidget(state.focusFieldId);
        if (focused && focused.type === "textfield") return resolveField(focused);
      }
      const first = screen.widgets.find((w) => w.type === "textfield" && w.visible !== false);
      return first ? resolveField(first) : null;
    }

    function syncInputChrome() {
      const s = currentScreenObj();
      const hasNav = buildNavTargets(s).length > 0;
      const hasShapes = shapeTargets(s).length > 0;
      dpad.hidden = isTouchInput() && !hasShapes && !hasNav;
      dpad.classList.toggle("dpad-encoder", isEncoderInput());
      touchHint.hidden = !isTouchInput();
      canvas.style.cursor = touchWidgetsEnabled() ? "pointer" : "default";
    }

    function widgetBounds(w) {
      if (!w) return { x: 0, y: 0, w: 40, h: 16, cx: 0, cy: 0 };
      if (w.type === "menu") {
        const theme = LE.renderTheme(state.current);
        const rowH = menuRowHeight(theme);
        const h = rowH * (w.items ? w.items.length : 1);
        return { x: w.x, y: w.y, w: w.w, h, cx: w.x + w.w / 2, cy: w.y + h / 2 };
      }
      const bw = w.w > 0 ? w.w : w.type === "textfield" ? 80 : 40;
      const bh = w.h > 0 ? w.h : w.type === "textfield" ? 28 : 16;
      return { x: w.x, y: w.y, w: bw, h: bh, cx: w.x + bw / 2, cy: w.y + bh / 2 };
    }

    function buildNavTargets(screen) {
      if (!screen || !screen.widgets) return [];
      const targets = [];
      menuNavItems(screen).forEach((m) => targets.push({ kind: "menu", widget: m }));
      shapeTargets(screen).forEach((s) => targets.push({ kind: "shape", widget: s }));
      screen.widgets.forEach((w) => {
        if (w.visible === false) return;
        if (w.type === "button" || w.type === "switch" || w.type === "textfield" || w.type === "slider") {
          targets.push({ kind: w.type, widget: w });
        }
      });
      return targets.sort((a, b) => {
        const ab = widgetBounds(a.widget);
        const bb = widgetBounds(b.widget);
        if (ab.cy !== bb.cy) return ab.cy - bb.cy;
        return ab.cx - bb.cx;
      });
    }

    function keyboardMode() {
      return !!(state.focusFieldId && getOverlayKeyboard());
    }

    function getKeyboardRegions() {
      const overlay = getOverlayKeyboard();
      const KB = window.LucarneKeyboard;
      if (!overlay || !KB) return [];
      return KB.keyRegions(overlay.x, overlay.y, overlay.w, overlay.h, overlay.layout || "compact");
    }

    function closeKeyboard() {
      state.focusFieldId = null;
      state.kbKeyIndex = null;
      state.editDraft = null;
      paint();
    }

    function focusField(field) {
      if (state.focusFieldId !== field.id) state.editDraft = null;
      state.focusFieldId = field.id;
    }

    function ensureNavFocus(targets) {
      if (!targets.length) {
        state.focusNavId = null;
        state.focusShapeId = null;
        return;
      }
      if (!state.focusNavId || !targets.some((t) => t.widget.id === state.focusNavId)) {
        state.focusNavId = targets[0].widget.id;
      }
      syncFocusRender();
    }

    function syncFocusRender() {
      const w = findWidget(state.focusNavId);
      if (w && w.type === "shape") state.focusShapeId = w.id;
      else if (!keyboardMode()) state.focusShapeId = null;
    }

    function nearestTargetInDirection(targets, currentId, dir) {
      const cur = targets.find((t) => t.widget.id === currentId) || targets[0];
      if (!cur) return null;
      if (targets.length <= 1) return cur;
      const cc = widgetBounds(cur.widget);
      let best = null;
      let bestScore = Infinity;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (t.widget.id === cur.widget.id) continue;
        const sc = widgetBounds(t.widget);
        const dx = sc.cx - cc.cx;
        const dy = sc.cy - cc.cy;
        if (dir === "up" && dy >= -2) continue;
        if (dir === "down" && dy <= 2) continue;
        if (dir === "left" && dx >= -2) continue;
        if (dir === "right" && dx <= 2) continue;
        let score;
        if (dir === "up" || dir === "down") score = Math.abs(dy) + Math.abs(dx) * 0.35;
        else score = Math.abs(dx) + Math.abs(dy) * 0.35;
        if (score < bestScore) {
          bestScore = score;
          best = t;
        }
      }
      if (best) return best;
      let idx = targets.findIndex((t) => t.widget.id === cur.widget.id);
      if (idx < 0) idx = 0;
      if (dir === "down" || dir === "right") idx = (idx + 1) % targets.length;
      else idx = (idx - 1 + targets.length) % targets.length;
      return targets[idx];
    }

    function moveNavFocus(dir) {
      const targets = buildNavTargets(currentScreenObj());
      if (!targets.length) return;
      ensureNavFocus(targets);
      const next = nearestTargetInDirection(targets, state.focusNavId, dir);
      if (!next) return;
      state.focusNavId = next.widget.id;
      if (next.kind !== "textfield") {
        state.focusFieldId = null;
        state.editDraft = null;
      }
      state.kbKeyIndex = null;
      syncFocusRender();
      paint();
    }

    function moveKeyboardFocus(dir) {
      const regions = getKeyboardRegions();
      if (!regions.length) return;
      if (state.kbKeyIndex === null || state.kbKeyIndex === undefined) {
        state.kbKeyIndex = 0;
        paint();
        return;
      }
      const cur = regions[state.kbKeyIndex];
      const cc = { x: cur.x + cur.w / 2, y: cur.y + cur.h / 2 };
      let best = null;
      let bestScore = Infinity;
      for (let i = 0; i < regions.length; i++) {
        if (i === state.kbKeyIndex) continue;
        const r = regions[i];
        const sc = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
        const dx = sc.x - cc.x;
        const dy = sc.y - cc.y;
        if (dir === "up" && dy >= -2) continue;
        if (dir === "down" && dy <= 2) continue;
        if (dir === "left" && dx >= -2) continue;
        if (dir === "right" && dx <= 2) continue;
        let score;
        if (dir === "up" || dir === "down") score = Math.abs(dy) + Math.abs(dx) * 0.35;
        else score = Math.abs(dx) + Math.abs(dy) * 0.35;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best !== null) state.kbKeyIndex = best;
      else {
        let idx = state.kbKeyIndex;
        if (dir === "down" || dir === "right") idx = (idx + 1) % regions.length;
        else idx = (idx - 1 + regions.length) % regions.length;
        state.kbKeyIndex = idx;
      }
      paint();
    }

    function focusedNavTarget() {
      const targets = buildNavTargets(currentScreenObj());
      ensureNavFocus(targets);
      return targets.find((t) => t.widget.id === state.focusNavId) || null;
    }

    function menuStep(menu, delta) {
      if (!menu || !menu.items || !menu.items.length) return;
      const cur = state.sel[menu.id] || 0;
      state.sel[menu.id] = Math.max(0, Math.min(menu.items.length - 1, cur + delta));
      paint();
    }

    function currentScreenObj() {
      return LE.getScreen(state.current);
    }

    function findWidget(id) {
      const s = currentScreenObj();
      if (!s || !id) return null;
      return s.widgets.find((w) => w.id === id) || null;
    }

    function hitWidget(screen, x, y) {
      if (!screen || !screen.widgets) return null;
      const oy = getScreenOffsetY();
      const ly = y + oy;
      for (let i = screen.widgets.length - 1; i >= 0; i--) {
        const w = screen.widgets[i];
        if (w.visible === false) continue;
        if (w.type === "shape") {
          if (R.shapeHitTest(w, x, ly)) return w;
          continue;
        }
        const bw = w.w > 0 ? w.w : w.type === "textfield" ? 80 : 40;
        const bh = w.h > 0 ? w.h : w.type === "textfield" ? 28 : 16;
        if (x >= w.x && ly >= w.y && x < w.x + bw && ly < w.y + bh) return w;
      }
      return null;
    }

    function shapeCenter(w) {
      return { x: w.x + w.w / 2, y: w.y + w.h / 2 };
    }

    function sortShapes(shapes) {
      return shapes.slice().sort((a, b) => {
        const ay = a.y + a.h / 2;
        const by = b.y + b.h / 2;
        if (ay !== by) return ay - by;
        return a.x + a.w / 2 - (b.x + b.w / 2);
      });
    }

    function shapeNavItems(screen) {
      if (!screen || !screen.widgets) return [];
      return sortShapes(
        screen.widgets.filter((w) => w.visible !== false && w.type === "shape")
      );
    }

    function shapeTargets(screen) {
      return shapeNavItems(screen).filter((w) => {
        if (w.action === "callback" && w.callbackId) return true;
        if (w.action !== "callback" && w.target) return true;
        return false;
      });
    }

    function activateShape(w) {
      if (!w || w.type !== "shape") return;
      if (w.action === "callback") {
        const id = (w.callbackId || w.label || "callback").replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
        LE.toast("Callback ACTION_" + id + " — handle in loop() with ui.pollMenuAction()", "info");
        return;
      }
      if (w.target) {
        const t = resolveTrans(w.transition);
        state.stack.push({ id: state.current, trans: t });
        animate(w.target, t);
      }
    }

    function menuRowHeight(theme) {
      let rowH = theme.rowHeight;
      if (rowH < 16) rowH = 16;
      return rowH;
    }

    function menuHitIndex(menu, x, y, theme) {
      if (!menu || !menu.items || !menu.items.length) return -1;
      const rowH = menuRowHeight(theme);
      if (x < menu.x || x >= menu.x + menu.w) return -1;
      const relY = y - menu.y;
      if (relY < 0) return -1;
      const row = Math.floor(relY / rowH);
      if (row < 0 || row >= menu.items.length) return -1;
      return row;
    }

    function getOverlayKeyboard() {
      if (!state.focusFieldId || !virtualKbEnabled()) return null;
      const KB = window.LucarneKeyboard;
      const field = resolveField(findWidget(state.focusFieldId));
      if (!KB || !field) return null;
      const hw = LE.project.hardware && LE.project.hardware.keyboard;
      const layout = KB.suggestedLayout(field.inputKind || "text", hw && hw.layout);
      const d = LE.dims();
      const dock = hw && hw.dock === "top" ? "top" : "bottom";
      const rect = KB.overlayRect(d, layout, dock);
      rect.layout = layout;
      rect.dock = dock;
      return rect;
    }

    function getScreenOffsetY() {
      const overlay = getOverlayKeyboard();
      if (!overlay) return 0;
      const field = resolveField(findWidget(state.focusFieldId));
      const KB = window.LucarneKeyboard;
      if (!field || !KB || !KB.computeScreenOffsetY) return 0;
      return KB.computeScreenOffsetY(field, overlay, 4);
    }

    function ensureKey(name, type, value) {
      if (!name) return null;
      let k = LE.project.keys.find((x) => x.name === name);
      if (!k) {
        k = { name, type, value };
        LE.project.keys.push(k);
      }
      return k;
    }

    function fieldText(field) {
      if (!field) return "";
      if (state.editDraft !== null && state.focusFieldId === field.id) return state.editDraft;
      const kind = field.inputKind || "text";
      const k = LE.project.keys.find((x) => x.name === field.key);
      if (!k) return kind === "integer" || kind === "numeric" ? "" : "";
      if (kind === "numeric" || kind === "integer") {
        if (k.value === undefined || k.value === null || k.value === "") return "";
        return String(k.value);
      }
      return String(k.value || "");
    }

    function setFieldText(field, text) {
      field = resolveField(field);
      if (!field) return;
      // Keep the raw typed text as the source of truth while editing: parsing it back
      // into a number (below) and re-deriving the display text from that number would
      // drop trailing "." / "-" and make it impossible to type multi-digit decimals.
      if (state.focusFieldId === field.id) state.editDraft = text;
      const KB = window.LucarneKeyboard;
      const kind = KB ? KB.normalizeInputKind(field.inputKind) : field.inputKind || "text";
      const type = KB ? KB.defaultKeyType(kind) : "string";
      const k = ensureKey(field.key, type, kind === "integer" ? 0 : kind === "numeric" ? 0 : "");
      if (!k) return;
      if (kind === "integer") k.value = text === "" || text === "-" ? 0 : parseInt(text, 10) || 0;
      else if (kind === "numeric") k.value = text === "" || text === "-" || text === "." ? 0 : parseFloat(text) || 0;
      else k.value = text;
      markDirtyKeys();
    }

    function applyKeyboardToken(token, field) {
      const KB = window.LucarneKeyboard;
      field = resolveField(field);
      if (!field || !KB) return;
      const kind = KB.normalizeInputKind(field.inputKind);
      let cur = fieldText(field);
      const maxLen = field.maxLen || 32;

      if (token === "⌫") {
        setFieldText(field, cur.slice(0, -1));
        return;
      }
      if (token === "↵" || token === "OK") {
        closeKeyboard();
        return;
      }
      if (token === "⇧" || token === "123") return;

      if (token === "space") token = " ";

      if (token === " ") {
        if (kind === "text" || kind === "password") {
          if (cur.length < maxLen) setFieldText(field, cur + " ");
        }
        return;
      }

      if (!KB.acceptChar(token, kind)) return;

      const next = cur + token;
      if (kind === "text" || kind === "password" || kind === "hex") {
        if (next.length > maxLen) return;
        setFieldText(field, next);
        return;
      }
      setFieldText(field, next);
    }

    function toggleSwitch(w) {
      if (!w || !w.key) return;
      let k = LE.project.keys.find((x) => x.name === w.key);
      if (!k) {
        k = { name: w.key, type: "bool", value: false };
        LE.project.keys.push(k);
      }
      k.value = !k.value;
      markDirtyKeys();
    }

    function activateButton(w) {
      if (!w || w.type !== "button") return;
      if (w.action === "callback") {
        const id = (w.callbackId || w.label || "callback").replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
        LE.toast("Callback ACTION_" + id + " — handle in loop() with ui.pollMenuAction()", "info");
        return;
      }
      if (w.target) {
        const t = resolveTrans(w.transition);
        state.stack.push({ id: state.current, trans: t });
        animate(w.target, t);
      }
    }

    function bumpSlider(w, delta) {
      if (!w || w.type !== "slider") return;
      const min = w.min === undefined ? 0 : w.min;
      const max = w.max === undefined ? 100 : w.max;
      const k = ensureKey(w.key, "float", min);
      if (!k) return;
      let v = Number(k.value);
      if (!isFinite(v)) v = min;
      const step = w.step || (max - min) / 20;
      v += delta * step;
      if (v < min) v = min;
      if (v > max) v = max;
      k.value = Math.round(v * 1000) / 1000;
      markDirtyKeys();
    }

    function toggleKey(name) {
      const k = LE.project.keys.find((x) => x.name === name);
      if (!k || k.type !== "bool") return;
      k.value = !k.value;
      markDirtyKeys();
    }

    function setSliderValue(w, x) {
      const min = w.min === undefined ? 0 : w.min;
      const max = w.max === undefined ? 100 : w.max;
      const pad = 4;
      const tx = w.x + pad;
      const tw = w.w - pad * 2;
      if (tw <= 0) return;
      let ratio = (x - tx) / tw;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;
      const val = min + ratio * (max - min);
      const k = ensureKey(w.key, "float", min);
      if (k) {
        k.value = Math.round(val * 1000) / 1000;
        markDirtyKeys();
      }
    }

    function markDirtyKeys() {
      LE.autosave();
      paint();
    }

    function canvasPoint(ev) {
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      return {
        x: Math.floor((ev.clientX - rect.left) * scale),
        y: Math.floor((ev.clientY - rect.top) * scale),
      };
    }

    function activateMenuItem(menu, idx) {
      const it = menu.items[idx];
      if (!it) return;
      state.sel[menu.id] = idx;
      if (it.action === "callback") {
        const id = (it.callbackId || it.label || "callback").replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
        LE.toast("Callback ACTION_" + id + " — handle in loop() with ui.pollMenuAction()", "info");
        paint();
        return;
      }
      if (it.target) {
        const t = resolveTrans(it.transition);
        state.stack.push({ id: state.current, trans: t });
        animate(it.target, t);
      } else {
        paint();
      }
    }

    function activateAt(x, y) {
      if (state.animating) return;
      const s = currentScreenObj();
      if (!s) return;
      const KB = window.LucarneKeyboard;
      const theme = LE.renderTheme(state.current);
      const overlay = getOverlayKeyboard();

      const oy = getScreenOffsetY();

      if (overlay && y >= overlay.y && y < overlay.y + overlay.h) {
        const hit = KB && KB.hitTestRect(overlay, x, y);
        const field = resolveField(findWidget(state.focusFieldId));
        if (hit && field) {
          applyKeyboardToken(hit, field);
        }
        return;
      }

      const w = hitWidget(s, x, y);

      if (w && w.type === "keyboard") {
        const hit = KB && KB.hitTestWidget(Object.assign({}, w, { y: w.y - oy }), x, y);
        if (hit) {
          let field = findTypingField(s);
          if (field) {
            focusField(field);
            applyKeyboardToken(hit, field);
          } else {
            LE.toast("Add a text input field to type", "warn");
          }
        }
        return;
      }

      if (w && w.type === "textfield") {
        const field = resolveField(w);
        state.focusNavId = w.id;
        focusField(field);
        state.kbKeyIndex = virtualKbEnabled() ? 0 : null;
        LE.autosave();
        paint();
        return;
      }

      if (!w) {
        if (state.focusFieldId) {
          closeKeyboard();
        }
        return;
      }

      if (w.type === "button") {
        state.focusNavId = w.id;
        activateButton(w);
      } else if (w.type === "shape") {
        state.focusNavId = w.id;
        state.focusShapeId = w.id;
        paint();
      } else if (w.type === "switch") {
        state.focusNavId = w.id;
        toggleSwitch(w);
      } else if (w.type === "menu" && isTouchInput()) {
        const idx = menuHitIndex(w, x, y + oy, theme);
        if (idx >= 0) activateMenuItem(w, idx);
      } else if (w.type === "slider") {
        state.focusNavId = w.id;
        state.dragSliderId = w.id;
        setSliderValue(w, x);
      }
    }

    canvas.addEventListener("pointerdown", (ev) => {
      const p = canvasPoint(ev);
      activateAt(p.x, p.y);
    });

    canvas.addEventListener("pointermove", (ev) => {
      if (!state.dragSliderId || state.animating) return;
      const w = findWidget(state.dragSliderId);
      if (!w || w.type !== "slider") return;
      const p = canvasPoint(ev);
      setSliderValue(w, p.x);
    });

    canvas.addEventListener("pointerup", () => {
      state.dragSliderId = null;
    });

    canvas.addEventListener("pointerleave", () => {
      state.dragSliderId = null;
    });

    function menuNavItems(screen) {
      if (!screen || !screen.widgets) return [];
      return screen.widgets.filter((w) => w.visible !== false && w.type === "menu" && w.items && w.items.length);
    }

    function navContext(screen) {
      if (keyboardMode()) return { mode: "keyboard" };
      const targets = buildNavTargets(screen);
      if (!targets.length) return null;
      return { mode: "targets", targets };
    }

    function tickGraphStreams(screen) {
      if (!screen || !screen.widgets) return;
      screen.widgets.forEach((w) => {
        if (w.type !== "graph" || (w.mode || "stream") !== "stream") return;
        if (!state.graphStreams[w.id]) {
          state.graphStreams[w.id] = w.samples ? w.samples.slice() : [];
        }
        const buf = state.graphStreams[w.id];
        const rec = w.key ? LE.project.keys.find((k) => k.name === w.key) : null;
        let v;
        if (rec && rec.type !== "string" && rec.type !== "bool") v = Number(rec.value);
        else {
          const last = buf.length ? buf[buf.length - 1] : 40;
          v = last + (Math.random() - 0.5) * 10;
        }
        const min = w.min === undefined ? 0 : w.min;
        const max = w.max === undefined ? 100 : w.max;
        if (v < min) v = min;
        if (v > max) v = max;
        buf.push(v);
        const cap = w.capacity || 32;
        while (buf.length > cap) buf.shift();
      });
    }

    function paintExtra(extra) {
      const out = Object.assign({}, extra || {});
      out.focusFieldId = state.focusFieldId;
      out.focusShapeId = state.focusShapeId;
      out.focusNavId = state.focusNavId;
      out.editDraft = state.editDraft;
      out.kbFocusIndex = keyboardMode() ? state.kbKeyIndex : null;
      out.screenOffsetY = getScreenOffsetY();
      out.graphSamples = (id) => state.graphStreams[id] || null;
      out.overlayKeyboard = getOverlayKeyboard();
      return out;
    }

    function renderTo(disp, screen, extra) {
      R.drawScreen(disp, screen, LE.renderTheme(screen && screen.id), LE.env(screen, state.sel, paintExtra(extra)));
    }

    function recomputeCalcKeys() {
      const CK = window.LucarneCalcKeys;
      if (!CK) return;
      const calc = CK.calcKeys(LE.project);
      if (!calc.length) return;
      const values = CK.resolveAll(LE.project);
      calc.forEach((k) => {
        const v = values.get(k.name);
        k.value = typeof v === "number" && Number.isFinite(v) ? v : 0;
      });
    }

    function paint(extra) {
      syncInputChrome();
      const d = LE.dims();
      const scale = scaleFor();
      if (canvas.width !== d.w || canvas.height !== d.h) {
        canvas.width = d.w;
        canvas.height = d.h;
      }
      canvas.style.width = d.w * scale + "px";
      canvas.style.height = d.h * scale + "px";
      const s = currentScreenObj();
      if (!s) return;
      recomputeCalcKeys();
      tickGraphStreams(s);
      const nav = navContext(s);
      if (nav && nav.mode === "targets") ensureNavFocus(nav.targets);
      const disp = LE.getSharedDisplay ? LE.getSharedDisplay(d.w, d.h) : new R.Display(d.w, d.h);
      renderTo(disp, s, extra);
      R.blitDisplayToCanvas(disp, canvas.getContext("2d"), LE.project);
      if (LE.live && LE.live.isConnected()) LE.live.sendDisplay(disp);
    }

    function resolveTrans(t) {
      const H = window.LucarneHardware;
      if (H && H.runtimeTransition) return H.runtimeTransition(LE.project, t);
      return !t || t === "Inherit" ? LE.project.transition.default || "None" : t;
    }

    function reverse(t) {
      switch (t) {
        case "SlideLeft":
        case "Push":
          return "SlideRight";
        case "SlideRight":
          return "SlideLeft";
        case "SlideUp":
          return "SlideDown";
        case "SlideDown":
          return "SlideUp";
        default:
          return t;
      }
    }

    function animate(toId, type) {
      const d = LE.dims();
      const fromS = currentScreenObj();
      const toS = LE.getScreen(toId);
      if (!toS) return;
      state.focusFieldId = null;
      state.focusShapeId = null;
      state.focusNavId = null;
      state.kbKeyIndex = null;
      state.editDraft = null;
      if (type === "None" || !fromS) {
        state.current = toId;
        paint();
        return;
      }
      const scale = scaleFor();
      canvas.width = d.w;
      canvas.height = d.h;
      canvas.style.width = d.w * scale + "px";
      canvas.style.height = d.h * scale + "px";
      const ctx = canvas.getContext("2d");

      const A = new R.Display(d.w, d.h);
      const B = new R.Display(d.w, d.h);
      renderTo(A, fromS);
      renderTo(B, toS);
      const out = new R.Display(d.w, d.h);

      const duration = LE.project.transition.durationMs || 220;
      const start = performance.now();
      state.animating = true;

      function frame(now) {
        let p = (now - start) / duration;
        if (p > 1) p = 1;
        const e = 1 - (1 - p) * (1 - p) * (1 - p);
        R.composeFB(out.fb, A.fb, B.fb, d.w, d.h, type, e);
        R.blitDisplayToCanvas(out, ctx, LE.project);
        if (LE.live && LE.live.isConnected()) LE.live.sendDisplay(out);
        if (p < 1) {
          requestAnimationFrame(frame);
        } else {
          state.animating = false;
          state.current = toId;
          paint();
        }
      }
      requestAnimationFrame(frame);
    }

    function handleDirection(dir) {
      if (state.animating) return;
      if (isEncoderInput() && (dir === "left" || dir === "right")) return;
      if (keyboardMode()) {
        moveKeyboardFocus(dir);
        return;
      }
      const target = focusedNavTarget();
      if (target && target.kind === "menu" && (dir === "up" || dir === "down")) {
        const m = target.widget;
        const cur = state.sel[m.id] || 0;
        const atTop = cur <= 0;
        const atBottom = cur >= m.items.length - 1;
        // At the edge of the list, bubble up to spatial navigation instead of
        // capturing the arrow keys forever inside the menu.
        if ((dir === "up" && atTop) || (dir === "down" && atBottom)) {
          moveNavFocus(dir);
          return;
        }
        menuStep(m, dir === "down" ? 1 : -1);
        return;
      }
      if (target && target.kind === "slider" && (dir === "left" || dir === "right")) {
        bumpSlider(target.widget, dir === "right" ? 1 : -1);
        return;
      }
      moveNavFocus(dir);
    }

    function next() {
      handleDirection("down");
    }
    function prev() {
      handleDirection("up");
    }
    function select() {
      if (state.animating) return;
      if (keyboardMode()) {
        const regions = getKeyboardRegions();
        const idx = state.kbKeyIndex === null || state.kbKeyIndex === undefined ? 0 : state.kbKeyIndex;
        const region = regions[idx];
        const field = resolveField(findWidget(state.focusFieldId));
        if (region && field) applyKeyboardToken(region.token, field);
        return;
      }
      const target = focusedNavTarget();
      if (!target) return;
      const w = target.widget;
      if (target.kind === "menu") {
        activateMenuItem(w, state.sel[w.id] || 0);
        return;
      }
      if (target.kind === "shape") {
        activateShape(w);
        return;
      }
      if (target.kind === "button") {
        activateButton(w);
        return;
      }
      if (target.kind === "switch") {
        toggleSwitch(w);
        return;
      }
      if (target.kind === "textfield") {
        const field = resolveField(w);
        focusField(field);
        state.kbKeyIndex = virtualKbEnabled() ? 0 : null;
        paint();
        return;
      }
    }
    function back() {
      if (state.animating) return;
      if (keyboardMode()) {
        closeKeyboard();
        return;
      }
      if (!state.stack.length) return;
      const e = state.stack.pop();
      animate(e.id, reverse(e.trans));
    }

    bUp.addEventListener("click", () => handleDirection("up"));
    bLeft.addEventListener("click", () => handleDirection("left"));
    bDown.addEventListener("click", () => handleDirection("down"));
    bRight.addEventListener("click", () => handleDirection("right"));
    bBack.addEventListener("click", back);

    // Real hardware EncoderInput models the encoder button as short-press =
    // select(), long-press (>=500ms) = back() — mirror that here instead of
    // treating OK as a plain button, so encoder projects preview accurately.
    const ENCODER_LONG_PRESS_MS = 500;
    let encOkTimer = null;
    let encOkLong = false;
    bOk.addEventListener("click", () => {
      if (isEncoderInput()) return;
      select();
    });
    bOk.addEventListener("pointerdown", () => {
      if (!isEncoderInput()) return;
      encOkLong = false;
      encOkTimer = setTimeout(() => {
        encOkLong = true;
        back();
      }, ENCODER_LONG_PRESS_MS);
    });
    function releaseEncOk() {
      if (!isEncoderInput()) return;
      if (encOkTimer) {
        clearTimeout(encOkTimer);
        encOkTimer = null;
      }
      if (!encOkLong) select();
    }
    bOk.addEventListener("pointerup", releaseEncOk);
    bOk.addEventListener("pointerleave", () => {
      if (encOkTimer) {
        clearTimeout(encOkTimer);
        encOkTimer = null;
      }
    });

    function keyHandler(ev) {
      if (host.hidden) return;
      const tag = (ev.target && ev.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (ev.target && ev.target.isContentEditable) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (tag === "BUTTON" && (ev.key === "Enter" || ev.key === " ")) return;
      if (document.querySelector(".modal:not([hidden])") || document.querySelector(".tour-root")) return;
      if (ev.target && ev.target.closest && ev.target.closest("#dock, .topbar, #historyBar, #memoryBar, .toast-stack")) return;
      if (ev.key === "ArrowUp") handleDirection("up");
      else if (ev.key === "ArrowDown") handleDirection("down");
      else if (ev.key === "ArrowLeft") handleDirection("left");
      else if (ev.key === "ArrowRight") handleDirection("right");
      else if (ev.key === "Enter" || ev.key === " ") select();
      else if (ev.key === "Backspace" || ev.key === "Escape") back();
      else return;
      ev.preventDefault();
    }
    document.addEventListener("keydown", keyHandler);

    let splashTimer = null;
    let animFrameId = null;
    let lastAnimPaint = 0;

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
          paint();
        }
        animFrameId = requestAnimationFrame(tick);
      }
      lastAnimPaint = 0;
      animFrameId = requestAnimationFrame(tick);
    }

    function clearSplashTimer() {
      if (splashTimer) {
        clearInterval(splashTimer);
        splashTimer = null;
      }
    }

    function maybeStartSplash(screen) {
      clearSplashTimer();
      if (!screen || !screen.splash || !screen.splash.enabled) return;
      const dur = screen.splash.durationMs || 2000;
      const nextId = screen.splash.nextScreen;
      if (!nextId) return;
      const start = performance.now();
      splashTimer = setInterval(() => {
        const elapsed = performance.now() - start;
        paint({ splashElapsedMs: elapsed });
        if (elapsed >= dur) {
          clearSplashTimer();
          const t = resolveTrans("Fade");
          if (state.stack.length === 0) state.stack.push({ id: state.current, trans: t });
          animate(nextId, t);
        }
      }, 50);
    }

    function open() {
      state.current = LE.project.startScreen || (LE.project.screens[0] && LE.project.screens[0].id);
      state.stack = [];
      state.sel = {};
      state.focusFieldId = null;
      state.focusShapeId = null;
      state.focusNavId = null;
      state.kbKeyIndex = null;
      state.editDraft = null;
      state.dragSliderId = null;
      state.graphStreams = {};
      clearSplashTimer();
      syncInputChrome();
      paint();
      startAnimLoop();
      const s = currentScreenObj();
      maybeStartSplash(s);
    }

    if (typeof ResizeObserver !== "undefined") {
      let lastW = 0;
      let lastH = 0;
      new ResizeObserver(() => {
        if (host.hidden || !state.current) return;
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        paint();
      }).observe(host);
    }
    stackMq.addEventListener("change", () => {
      if (!host.hidden && state.current) paint();
    });

    function currentScreenId() {
      return state.current || LE.project.startScreen || (LE.project.screens[0] && LE.project.screens[0].id);
    }

    return { render: paint, open, stopAnimLoop, startAnimLoop, currentScreenId };
  }

  window.LucarneSimulate = { init };
})();
