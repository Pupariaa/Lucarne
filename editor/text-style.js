(function () {
  "use strict";

  const TRANSPARENT = "transparent";

  function isTransparentColor(v) {
    return v === TRANSPARENT;
  }

  function hexTo565(hex) {
    return window.LucarneRender.hexTo565(hex);
  }

  function styleHasFont(style) {
    if (!style) return false;
    return !!(style.fontId || style.customFamily || (style.fontSizePx !== undefined && style.fontSizePx !== "") || style.bold);
  }

  function has(style) {
    if (!style) return false;
    return !!(
      style.fontId ||
      style.customFamily ||
      style.fontSizePx !== undefined ||
      style.textSize !== undefined ||
      style.bold ||
      style.color ||
      style.spacing ||
      style.align
    );
  }

  function ensure(obj, key) {
    if (!obj[key]) obj[key] = {};
    return obj[key];
  }

  function projectFontId(theme, fontId) {
    if (fontId === "body") return theme.fontBodyId;
    if (fontId === "title") return theme.fontTitleId;
    return fontId || "";
  }

  function fontOptions(LE, includeInherit) {
    const opts = [];
    if (includeInherit !== false) {
      opts.push({ value: "", label: "Theme default" });
      opts.push({ value: "body", label: "Theme body" });
      opts.push({ value: "title", label: "Theme title" });
    }
    Object.values(LE.project.fonts || {}).forEach((f) => {
      opts.push({ value: f.id, label: f.label + (f.builtin ? " (built-in)" : "") });
    });
    return opts;
  }

  function findProjectFont(LE, family, sizePx, weight) {
    if (!family) return null;
    for (const f of Object.values(LE.project.fonts || {})) {
      const fam = f.googleName || f.family;
      if (fam === family && f.sizePx === sizePx && (f.weight || 400) === weight) return f;
    }
    return null;
  }

  function findBoldSibling(LE, baseFont) {
    if (!baseFont) return null;
    const fam = baseFont.googleName || baseFont.family;
    for (const f of Object.values(LE.project.fonts || {})) {
      if ((f.googleName || f.family) === fam && (f.weight || 400) >= 600) return f;
    }
    return null;
  }

  function resolveFontSpec(LE, theme, style, defaults) {
    const st = style || {};
    const d = defaults || {};
    let pid = projectFontId(theme, st.fontId);
    let base = pid ? LE.project.fonts[pid] : null;
    if (!base && !st.fontId && !st.customFamily) {
      pid = d.fontKind === "title" ? theme.fontTitleId : theme.fontBodyId;
      base = LE.project.fonts[pid];
    }
    let family = (st.customFamily || "").trim();
    let sizePx = st.fontSizePx !== undefined && st.fontSizePx !== "" ? parseInt(st.fontSizePx, 10) : null;
    let weight = st.bold ? 700 : null;
    if (!family && base) family = base.googleName || base.family;
    if (!sizePx && base) sizePx = base.sizePx;
    if (weight === null && base) weight = base.weight || 400;
    if (weight === null) weight = 400;
    if (!sizePx || sizePx < 8) sizePx = 15;
    if (st.bold && base && !st.customFamily && !(st.fontSizePx !== undefined && st.fontSizePx !== "")) {
      const boldFont = findBoldSibling(LE, base);
      if (boldFont) {
        return {
          pid: boldFont.id,
          family: boldFont.googleName || boldFont.family,
          sizePx: boldFont.sizePx,
          weight: boldFont.weight || 700,
          kind: boldFont.kind,
          googleName: boldFont.googleName,
        };
      }
    }
    const matched = findProjectFont(LE, family, sizePx, weight);
    if (matched) {
      return {
        pid: matched.id,
        family: matched.googleName || matched.family,
        sizePx: matched.sizePx,
        weight: matched.weight || 400,
        kind: matched.kind,
        googleName: matched.googleName,
      };
    }
    return {
      pid: pid || "",
      family,
      sizePx,
      weight,
      kind: "google",
      googleName: family,
    };
  }

  function specKey(spec) {
    return [spec.family || "", spec.sizePx || 0, spec.weight || 400].join("|");
  }

  function styleCacheKey(LE, theme, style, defaults) {
    return specKey(resolveFontSpec(LE, theme, style, defaults));
  }

  function getCachedAtlas(LE, theme, style, defaults) {
    if (!LE._textStyleAtlases) return null;
    return LE._textStyleAtlases[styleCacheKey(LE, theme, style, defaults)] || null;
  }

  async function bakeSpec(LE, spec) {
    const LF = window.LucarneFonts;
    if (!LF || !spec.family) return null;
    try {
      if (spec.pid) {
        const f = LE.project.fonts[spec.pid];
        if (f && f._atlas && f.sizePx === spec.sizePx && (f.weight || 400) === spec.weight) return f._atlas;
      }
      const matched = findProjectFont(LE, spec.family, spec.sizePx, spec.weight);
      if (matched && matched._atlas) return matched._atlas;
      if (spec.kind === "google" || !spec.kind) {
        await LF.loadGoogle(spec.googleName || spec.family, spec.weight);
      }
      return LF.bake(spec.family, spec.sizePx, spec.weight);
    } catch (e) {
      return null;
    }
  }

  async function bakeStyle(LE, theme, style, defaults) {
    const spec = resolveFontSpec(LE, theme, style, defaults);
    if (!spec.family) return null;
    let atlas = await bakeSpec(LE, spec);
    if (atlas && LE.project && window.LucarneUtf8) {
      const needed = window.LucarneUtf8.fontExportLast(window.LucarneUtf8.collectProjectCodepoints(LE.project));
      if (atlas.last < needed) {
        const rebaked = window.LucarneFonts.bake(spec.family, spec.sizePx, spec.weight, 32, needed);
        if (rebaked) atlas = rebaked;
      }
    }
    if (!LE._textStyleAtlases) LE._textStyleAtlases = {};
    if (atlas) LE._textStyleAtlases[specKey(spec)] = atlas;
    return atlas;
  }

  async function bakeAllWidgetStyles(LE) {
    const theme = LE.project.theme;
    const jobs = [];
    function walk(st, defaults) {
      if (!styleHasFont(st)) return;
      jobs.push(bakeStyle(LE, theme, st, defaults));
    }
    (LE.project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type === "label") walk(labelStyleForResolve(w), {});
        else walk(w.textStyle, { align: w.align });
        walk(w.labelStyle, { dim: true });
        walk(w.valueStyle, {});
        if (w.type === "menu") {
          walk(w.textStyle, {});
          (w.items || []).forEach((it) => walk(it.textStyle, {}));
        }
        if (w.type === "list") {
          walk(w.textStyle, {});
          (w.items || []).forEach((it) => walk(it.textStyle, {}));
        }
      });
    });
    await Promise.all(jobs);
  }

  function resolveFontAtlas(LE, theme, style, defaults) {
    const d = defaults || {};
    if (!styleHasFont(style)) {
      const pid = d.fontKind === "title" ? theme.fontTitleId : theme.fontBodyId;
      return LE.fontAtlas(pid);
    }
    const cached = getCachedAtlas(LE, theme, style, defaults);
    if (cached) return cached;
    const spec = resolveFontSpec(LE, theme, style, d);
    if (spec.pid) {
      const atlas = LE.fontAtlas(spec.pid);
      if (atlas) return atlas;
    }
    const matched = findProjectFont(LE, spec.family, spec.sizePx, spec.weight);
    if (matched) return LE.fontAtlas(matched.id);
    return null;
  }

  function resolve(LE, theme, style, defaults) {
    const d = defaults || {};
    const st = style || {};
    const atlas = resolveFontAtlas(LE, theme, st, d);
    let color565;
    let transparent = false;
    if (isTransparentColor(st.color)) {
      transparent = true;
    } else if (st.color) color565 = hexTo565(st.color);
    else if (d.dim) color565 = hexTo565(theme.textDim);
    else if (d.colorHex !== undefined) color565 = d.colorHex;
    else color565 = hexTo565(theme.text);
    return {
      atlas,
      size: st.textSize !== undefined && st.textSize !== "" ? st.textSize : d.size !== undefined ? d.size : theme.textSize,
      color565,
      transparent,
      align: st.align || d.align || "left",
      spacing: st.spacing !== undefined && st.spacing !== "" ? parseInt(st.spacing, 10) || 0 : 0,
    };
  }

  function labelStyleForResolve(w) {
    const st = Object.assign({}, w.textStyle || {});
    if (w.font && !st.fontId) st.fontId = w.font;
    if (w.color && !st.color) st.color = w.color;
    if (w.align && !st.align) st.align = w.align;
    if (w.size !== undefined && w.size !== "" && st.textSize === undefined) st.textSize = w.size;
    return st;
  }

  function migrateLabelLegacy(w) {
    if (!w || w.type !== "label") return;
    const st = ensure(w, "textStyle");
    if (w.font && !st.fontId) st.fontId = w.font;
    if (w.color && !st.color) st.color = w.color;
    if (w.align && !st.align) st.align = w.align;
    if (w.size !== undefined && w.size !== "" && st.textSize === undefined) st.textSize = w.size;
    delete w.font;
    delete w.color;
    delete w.align;
    delete w.size;
  }

  function migrateProjectLabels(project) {
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => migrateLabelLegacy(w));
    });
  }

  function resolveLabelWidget(LE, theme, w) {
    const st = labelStyleForResolve(w);
    return resolve(LE, theme, st, { align: st.align || w.align || "left" });
  }

  function collectExportSpecs(LE, theme) {
    const map = new Map();
    function add(style, defaults) {
      if (!has(style)) return;
      if (!styleHasFont(style)) return;
      const spec = resolveFontSpec(LE, theme, style, defaults || {});
      if (!spec.family) return;
      const matched = findProjectFont(LE, spec.family, spec.sizePx, spec.weight);
      if (matched) {
        map.set(specKey(spec), { spec, cName: matched.builtin ? matched.cName : "Font_" + sanitize(matched.id), builtin: matched.builtin });
        return;
      }
      const key = specKey(spec);
      if (!map.has(key)) {
        map.set(key, {
          spec,
          cName: "Font_style_" + sanitize(spec.family) + "_" + spec.sizePx + "_w" + spec.weight,
          builtin: false,
        });
      }
    }
    function sanitize(s) {
      return String(s || "").replace(/[^a-zA-Z0-9_]/g, "_");
    }
    (LE.project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type === "label") add(labelStyleForResolve(w), {});
        else add(w.textStyle, { align: w.align });
        add(w.labelStyle, { dim: true });
        add(w.valueStyle, {});
        if (w.type === "menu") {
          add(w.textStyle, {});
          (w.items || []).forEach((it) => add(it.textStyle, {}));
        }
        if (w.type === "list") {
          add(w.textStyle, {});
          (w.items || []).forEach((it) => add(typeof it === "object" ? it.textStyle : null, {}));
        }
      });
    });
    return map;
  }

  function exportFontCName(LE, theme, style, exportMap) {
    if (!styleHasFont(style)) return null;
    const spec = resolveFontSpec(LE, theme, style, {});
    const entry = exportMap.get(specKey(spec));
    return entry ? entry.cName : null;
  }

  function appendUI(parent, title, obj, key, markDirty, LE, opts) {
    const o = opts || {};
    const st = ensure(obj, key);
    const theme = LE.project.theme;
    const host = parent;
    let sec = parent;
    if (!o.flat) {
      sec = document.createElement("div");
      sec.className = "section subcard";
      if (title) {
        const head = document.createElement("div");
        head.className = "subsection-title";
        head.textContent = title;
        sec.appendChild(head);
      }
      host.appendChild(sec);
    } else if (title) {
      const head = document.createElement("div");
      head.className = "subsection-title";
      head.textContent = title;
      host.appendChild(head);
    }

    const fontSel = document.createElement("select");
    fontSel.className = "select";
    fontOptions(LE).forEach((opt) => {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      if ((st.fontId || "") === opt.value) el.selected = true;
      fontSel.appendChild(el);
    });
    fontSel.addEventListener("change", () => {
      if (fontSel.value) st.fontId = fontSel.value;
      else delete st.fontId;
      bakeStyle(LE, theme, st, o.defaults).then(() => markDirty());
    });
    appendField(sec, "Defined font", fontSel);

    const familyInput = document.createElement("input");
    familyInput.type = "text";
    familyInput.className = "field";
    familyInput.placeholder = "Custom family (Google), optional";
    familyInput.value = st.customFamily || "";
    familyInput.addEventListener("change", () => {
      const v = familyInput.value.trim();
      if (v) st.customFamily = v;
      else delete st.customFamily;
      bakeStyle(LE, theme, st, o.defaults).then(() => markDirty());
    });
    appendField(sec, "Custom family", familyInput);

    const sizePxInput = document.createElement("input");
    sizePxInput.type = "number";
    sizePxInput.className = "field";
    sizePxInput.min = "8";
    sizePxInput.max = "48";
    sizePxInput.placeholder = "From font";
    sizePxInput.value = st.fontSizePx !== undefined ? st.fontSizePx : "";
    sizePxInput.addEventListener("input", () => {
      const v = sizePxInput.value.trim();
      if (v === "") delete st.fontSizePx;
      else st.fontSizePx = parseInt(v, 10) || 15;
      bakeStyle(LE, theme, st, o.defaults).then(() => markDirty());
    });
    appendField(sec, "Size px", sizePxInput);

    const sizeInput = document.createElement("input");
    sizeInput.type = "number";
    sizeInput.className = "field";
    sizeInput.min = "1";
    sizeInput.max = "4";
    sizeInput.placeholder = "Classic scale";
    sizeInput.value = st.textSize !== undefined ? st.textSize : "";
    sizeInput.addEventListener("input", () => {
      const v = sizeInput.value.trim();
      if (v === "") delete st.textSize;
      else st.textSize = parseInt(v, 10) || 1;
      markDirty();
    });
    appendField(sec, "Classic scale", sizeInput);

    const boldWrap = document.createElement("div");
    boldWrap.className = "row row-toggle";
    const boldLabel = document.createElement("span");
    boldLabel.className = "row-label";
    boldLabel.textContent = "Bold";
    boldWrap.appendChild(boldLabel);
    const boldToggle = document.createElement("label");
    boldToggle.className = "toggle";
    const boldInput = document.createElement("input");
    boldInput.type = "checkbox";
    boldInput.checked = !!st.bold;
    boldInput.addEventListener("change", () => {
      if (boldInput.checked) st.bold = true;
      else delete st.bold;
      bakeStyle(LE, theme, st, o.defaults).then(() => markDirty());
    });
    boldToggle.appendChild(boldInput);
    const boldTrack = document.createElement("span");
    boldTrack.className = "toggle-track";
    boldToggle.appendChild(boldTrack);
    boldWrap.appendChild(boldToggle);
    sec.appendChild(boldWrap);

    if (o.align !== false) {
      const alignSel = document.createElement("select");
      alignSel.className = "select";
      [
        { value: "", label: "Default" },
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ].forEach((opt) => {
        const el = document.createElement("option");
        el.value = opt.value;
        el.textContent = opt.label;
        if ((st.align || "") === opt.value) el.selected = true;
        alignSel.appendChild(el);
      });
      alignSel.addEventListener("change", () => {
        if (alignSel.value) st.align = alignSel.value;
        else delete st.align;
        markDirty();
      });
      appendField(sec, "Align", alignSel);
    }

    const spacingInput = document.createElement("input");
    spacingInput.type = "number";
    spacingInput.className = "field";
    spacingInput.min = "-4";
    spacingInput.max = "8";
    spacingInput.placeholder = "0";
    spacingInput.value = st.spacing !== undefined ? st.spacing : "";
    spacingInput.addEventListener("input", () => {
      const v = spacingInput.value.trim();
      if (v === "") delete st.spacing;
      else st.spacing = parseInt(v, 10) || 0;
      markDirty();
    });
    appendField(sec, "Spacing", spacingInput);

    const colorWrap = document.createElement("div");
    colorWrap.className = "row color";
    const colorLabel = document.createElement("label");
    colorLabel.textContent = "Color";
    colorWrap.appendChild(colorLabel);
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.disabled = isTransparentColor(st.color);
    colorInput.value = isTransparentColor(st.color) ? LE.project.theme.text : st.color || LE.project.theme.text;
    colorInput.addEventListener("input", () => {
      st.color = colorInput.value;
      colorInput.disabled = false;
      markDirty();
    });
    colorWrap.appendChild(colorInput);
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn tiny";
    clearBtn.textContent = "auto";
    clearBtn.addEventListener("click", () => {
      delete st.color;
      colorInput.disabled = false;
      colorInput.value = LE.project.theme.text;
      markDirty();
      if (o.refreshDock) o.refreshDock();
    });
    colorWrap.appendChild(clearBtn);
    const transBtn = document.createElement("button");
    transBtn.type = "button";
    transBtn.className = "btn tiny";
    transBtn.textContent = "transparent";
    transBtn.addEventListener("click", () => {
      st.color = TRANSPARENT;
      colorInput.disabled = true;
      markDirty();
      if (o.refreshDock) o.refreshDock();
    });
    colorWrap.appendChild(transBtn);
    sec.appendChild(colorWrap);

    if (!getCachedAtlas(LE, theme, st, o.defaults)) {
      bakeStyle(LE, theme, st, o.defaults);
    }
  }

  function appendField(sec, label, input) {
    const r = document.createElement("div");
    r.className = "row";
    const l = document.createElement("label");
    l.textContent = label;
    r.appendChild(l);
    if (input.classList && !input.classList.contains("field") && !input.classList.contains("select")) {
      input.classList.add("field");
    }
    r.appendChild(input);
    const ctl = input.matches && input.matches("input, select, textarea") ? input : input.querySelector && input.querySelector("input, select, textarea");
    if (ctl) {
      if (!ctl.id) ctl.id = "lc-ts-" + ++appendFieldSeq;
      l.htmlFor = ctl.id;
    }
    sec.appendChild(r);
  }

  let appendFieldSeq = 0;

  window.LucarneTextStyle = {
    TRANSPARENT,
    isTransparentColor,
    has,
    styleHasFont,
    ensure,
    fontOptions,
    resolveFontSpec,
    resolveFontAtlas,
    resolve,
    labelStyleForResolve,
    migrateLabelLegacy,
    migrateProjectLabels,
    resolveLabelWidget,
    bakeStyle,
    bakeAllWidgetStyles,
    collectExportSpecs,
    exportFontCName,
    appendUI,
  };
})();
