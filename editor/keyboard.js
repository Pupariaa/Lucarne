(function () {
  "use strict";

  const GAP = 2;
  const PAD = 2;

  function key(label, units) {
    return { t: label, u: units || 1 };
  }

  function row() {
    const out = [];
    for (let i = 0; i < arguments.length; i++) {
      const a = arguments[i];
      if (typeof a === "string") out.push(key(a, 1));
      else out.push(a);
    }
    return out;
  }

  const LAYOUTS = {
    full: {
      label: "Full QWERTY",
      rows: [
        row("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"),
        row("q", "w", "e", "r", "t", "y", "u", "i", "o", "p"),
        row("a", "s", "d", "f", "g", "h", "j", "k", "l"),
        row(key("⇧", 1), "z", "x", "c", "v", "b", "n", "m", key("⌫", 1.5)),
        row(key("123", 1.5), key("space", 5), key("OK", 1.5)),
      ],
    },
    compact: {
      label: "Compact QWERTY",
      rows: [
        row("q", "w", "e", "r", "t", "y", "u", "i", "o", "p"),
        row("a", "s", "d", "f", "g", "h", "j", "k", "l"),
        row(key("⇧", 1), "z", "x", "c", "v", "b", "n", "m", key("⌫", 1.5)),
        row(key("123", 1.5), key("space", 4), key("OK", 1.5)),
      ],
    },
    minimal: {
      label: "Minimal QWERTY",
      rows: [
        row("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"),
        row("q", "w", "e", "r", "t", "y", "u", "i", "o", "p"),
        row(key("⇧", 1), "a", "s", "d", "f", "g", "h", "j", "k", "l", key("⌫", 1)),
        row(key("123", 1), key("space", 6), key("OK", 1)),
      ],
    },
    full_azerty: {
      label: "Full AZERTY",
      rows: [
        row("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"),
        row("a", "z", "e", "r", "t", "y", "u", "i", "o", "p"),
        row("q", "s", "d", "f", "g", "h", "j", "k", "l", "m"),
        row(key("⇧", 1), "w", "x", "c", "v", "b", "n", key("⌫", 1.5)),
        row(key("123", 1.5), key("space", 5), key("OK", 1.5)),
      ],
    },
    compact_azerty: {
      label: "Compact AZERTY",
      rows: [
        row("a", "z", "e", "r", "t", "y", "u", "i", "o", "p"),
        row("q", "s", "d", "f", "g", "h", "j", "k", "l", "m"),
        row(key("⇧", 1), "w", "x", "c", "v", "b", "n", key("⌫", 1.5)),
        row(key("123", 1.5), key("space", 4), key("OK", 1.5)),
      ],
    },
    minimal_azerty: {
      label: "Minimal AZERTY",
      rows: [
        row("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"),
        row("a", "z", "e", "r", "t", "y", "u", "i", "o", "p"),
        row(key("⇧", 1), "q", "s", "d", "f", "g", "h", "j", "k", "l", key("⌫", 1)),
        row(key("123", 1), key("space", 6), key("OK", 1)),
      ],
    },
    numeric: {
      label: "Numeric",
      rows: [
        row("1", "2", "3"),
        row("4", "5", "6"),
        row("7", "8", "9"),
        row(key(".", 1), key("0", 1), key("-", 1), key("⌫", 1)),
        row(key("OK", 4)),
      ],
    },
    hex: {
      label: "Hex",
      rows: [
        row("1", "2", "3", "A"),
        row("4", "5", "6", "B"),
        row("7", "8", "9", "C"),
        row(key("0", 1), key("D", 1), key("E", 1), key("F", 1)),
        row(key("⌫", 2), key("OK", 2)),
      ],
    },
  };

  const INPUT_KINDS = [
    { value: "text", label: "Text" },
    { value: "numeric", label: "Numeric (float)" },
    { value: "integer", label: "Integer" },
    { value: "hex", label: "Hex" },
    { value: "password", label: "Password" },
  ];

  function normalizeLayout(id) {
    const v = String(id || "compact");
    if (v === "qwerty") return "compact";
    if (v === "azerty") return "compact_azerty";
    if (LAYOUTS[v]) return v;
    return "compact";
  }

  function getLayout(id) {
    return LAYOUTS[normalizeLayout(id)];
  }

  function layoutIds() {
    return Object.keys(LAYOUTS);
  }

  function layoutLabel(id) {
    const l = LAYOUTS[normalizeLayout(id)];
    return l ? l.label : id;
  }

  function layoutOptions() {
    return layoutIds().map((id) => ({ value: id, label: LAYOUTS[id].label }));
  }

  function inputKindOptions() {
    return INPUT_KINDS.slice();
  }

  function normalizeInputKind(kind) {
    const v = String(kind || "text");
    if (INPUT_KINDS.some((k) => k.value === v)) return v;
    return "text";
  }

  function suggestedLayout(inputKind, hwLayout) {
    const kind = normalizeInputKind(inputKind);
    if (kind === "numeric" || kind === "integer") return "numeric";
    if (kind === "hex") return "hex";
    const hw = normalizeLayout(hwLayout || "compact");
    if (hw.indexOf("azerty") >= 0) return "compact_azerty";
    if (hw.indexOf("numeric") >= 0) return "numeric";
    if (hw.indexOf("hex") >= 0) return "hex";
    if (hw.indexOf("minimal") >= 0) return hw.indexOf("azerty") >= 0 ? "minimal_azerty" : "minimal";
    if (hw.indexOf("full") >= 0) return hw.indexOf("azerty") >= 0 ? "full_azerty" : "full";
    if (hw.indexOf("azerty") >= 0) return "compact_azerty";
    return hw;
  }

  function keyHeight(panelW, panelH, rowCount) {
    const byH = Math.floor((panelH * 0.4) / Math.max(1, rowCount)) - GAP;
    const byW = Math.floor(panelW / 14);
    let h = Math.min(byH, byW, 32);
    if (h < 8) h = 8;
    if (h > 36) h = 36;
    return h;
  }

  function measure(layoutId, panelW, panelH) {
    const layout = getLayout(layoutId);
    const rows = layout.rows;
    const kh = keyHeight(panelW, panelH, rows.length);
    const h = PAD * 2 + rows.length * kh + Math.max(0, rows.length - 1) * GAP;
    const w = panelW > 0 ? panelW : 240;
    return { w, h, keyH: kh, gap: GAP, pad: PAD, rows };
  }

  function defaultWidget(dims, layoutId, dock) {
    const layout = normalizeLayout(layoutId);
    const m = measure(layout, dims.w, dims.h);
    const dockPos = dock === "top" ? "top" : "bottom";
    const y = dockPos === "top" ? 0 : Math.max(0, dims.h - m.h);
    return { x: 0, y, w: dims.w, h: m.h, layout, dock: dockPos };
  }

  function overlayRect(dims, layoutId, dock) {
    const rect = defaultWidget(dims, layoutId, dock);
    rect.dock = dock === "top" ? "top" : "bottom";
    return rect;
  }

  function fieldHeight(field) {
    return field && field.h > 0 ? field.h : 28;
  }

  function computeScreenOffsetY(field, overlay, gap) {
    if (!field || !overlay) return 0;
    const g = gap === undefined ? 4 : gap;
    const fh = fieldHeight(field);
    const dock = overlay.dock === "top" ? "top" : "bottom";
    if (dock === "bottom") {
      const need = field.y + fh + g - overlay.y;
      return need > 0 ? Math.ceil(need) : 0;
    }
    const kbBottom = overlay.y + overlay.h;
    const need = kbBottom + g - field.y;
    return need > 0 ? -Math.ceil(need) : 0;
  }

  function fitWidget(widget, dims) {
    if (!widget || widget.type !== "keyboard") return widget;
    const layout = normalizeLayout(widget.layout);
    const m = measure(layout, dims.w, dims.h);
    widget.layout = layout;
    widget.w = dims.w;
    widget.h = m.h;
    if (widget.dock === "top") widget.y = 0;
    else widget.y = Math.max(0, dims.h - m.h);
    return widget;
  }

  function rowUnits(keys) {
    let u = 0;
    keys.forEach((k) => {
      u += k.u || 1;
    });
    return u;
  }

  function displayLabel(t) {
    if (t === "space") return " ";
    if (t === "OK") return "OK";
    if (t === "\u232B") return "<-";
    if (t === "\u21E7") return "^";
    if (t === "\u21B5") return "OK";
    return t;
  }

  function keyRegions(x, y, w, h, layoutId) {
    const layout = getLayout(layoutId);
    const rows = layout.rows;
    const gap = GAP;
    const pad = PAD;
    const kh = Math.max(8, Math.floor((h - pad * 2 - gap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length)));
    const regions = [];
    let cy = y + pad;
    rows.forEach((keys) => {
      const totalU = rowUnits(keys);
      const rowW = w - pad * 2;
      const unitW = (rowW - gap * (keys.length - 1)) / totalU;
      let cx = x + pad;
      keys.forEach((k) => {
        const kw = Math.max(4, Math.floor(unitW * (k.u || 1)));
        regions.push({ token: k.t, x: cx, y: cy, w: kw, h: kh });
        cx += kw + gap;
      });
      cy += kh + gap;
    });
    return regions;
  }

  function hitTestRect(rect, x, y) {
    const regions = keyRegions(rect.x, rect.y, rect.w, rect.h, rect.layout || "compact");
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r.token;
    }
    return null;
  }

  function hitTestWidget(widget, x, y) {
    if (!widget || widget.type !== "keyboard") return null;
    return hitTestRect(
      { x: widget.x, y: widget.y, w: widget.w, h: widget.h, layout: widget.layout || "compact" },
      x,
      y
    );
  }

  function isActionToken(token) {
    return !token || token === "space" || token === "⌫" || token === "↵" || token === "OK" || token === "⇧" || token === "123";
  }

  function acceptChar(token, inputKind) {
    if (isActionToken(token)) return true;
    const kind = normalizeInputKind(inputKind);
    if (kind === "numeric") return /^[0-9.\-]$/.test(token);
    if (kind === "integer") return /^[0-9\-]$/.test(token);
    if (kind === "hex") return /^[0-9A-Fa-f]$/.test(token);
    return token.length === 1;
  }

  function defaultKeyType(inputKind) {
    const kind = normalizeInputKind(inputKind);
    if (kind === "numeric") return "float";
    if (kind === "integer") return "int";
    return "string";
  }

  function defaultKeyValue(type) {
    if (type === "string") return "";
    return 0;
  }

  function ensureFieldDataKey(field, project) {
    if (!field || field.type !== "textfield" || !project) return null;
    let name = String(field.key || "").trim();
    if (!name) {
      name = "tf_" + String(field.id || "field").replace(/[^a-zA-Z0-9_]/g, "_");
      field.key = name;
    }
    const type = defaultKeyType(field.inputKind);
    let k = project.keys.find((x) => x.name === name);
    if (!k) {
      k = { name, type, value: defaultKeyValue(type) };
      if (!project.keys) project.keys = [];
      project.keys.push(k);
    }
    return field;
  }

  window.LucarneKeyboard = {
    LAYOUTS,
    INPUT_KINDS,
    GAP,
    PAD,
    normalizeLayout,
    normalizeInputKind,
    getLayout,
    layoutIds,
    layoutLabel,
    layoutOptions,
    inputKindOptions,
    suggestedLayout,
    measure,
    defaultWidget,
    overlayRect,
    fieldHeight,
    computeScreenOffsetY,
    fitWidget,
    rowUnits,
    displayLabel,
    keyRegions,
    hitTestRect,
    hitTestWidget,
    acceptChar,
    defaultKeyType,
    defaultKeyValue,
    ensureFieldDataKey,
  };
})();
