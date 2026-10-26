(function () {
  "use strict";

  const BAKE_SEP = "@w:";
  const DYNAMIC_TYPES = new Set([
    "label",
    "metric",
    "bar",
    "menu",
    "button",
    "switch",
    "slider",
    "chart",
    "graph",
    "gauge",
    "list",
    "battery",
    "clock",
    "date",
    "status",
    "dynamicimage",
  ]);

  function render() {
    return window.LucarneRender;
  }

  function fluent() {
    return window.LucarneFluentEmoji;
  }

  function isTransparentColor(v) {
    const TS = window.LucarneTextStyle;
    return TS && TS.isTransparentColor(v);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function isAnimEmojiRef(ref) {
    return ref && ref.indexOf("emoji:") === 0;
  }

  function isDynamicWidget(w) {
    return DYNAMIC_TYPES.has(w.type);
  }

  function widgetById(project, screenId, widgetId) {
    const screen = (project.screens || []).find((s) => s.id === screenId);
    return screen && (screen.widgets || []).find((w) => w.id === widgetId);
  }

  function iconWidgetRect(w, env) {
    const R = render();
    if (!R || w.type !== "icon" || isTransparentColor(w.color)) return null;
    const ic = R.resolveIcon(w.icon, env);
    const base = ic ? ic.w || 16 : 16;
    const scale = R.normalizeIconScale(w.scale);
    const dw = Math.max(1, Math.round(base * scale));
    const dh = Math.max(1, Math.round((ic ? ic.h || base : base) * scale));
    const bw = w.w > 0 ? w.w : dw;
    const bh = w.h > 0 ? w.h : dh;
    return { x: w.x, y: w.y, w: bw, h: bh, dw, dh, dx: w.x + Math.trunc((bw - dw) / 2), dy: w.y + Math.trunc((bh - dh) / 2) };
  }

  function widgetRect(w, env, theme) {
    const R = render();
    if (!R) return null;
    if (w.type === "icon") return iconWidgetRect(w, env);
    let x = w.x | 0;
    let y = w.y | 0;
    let bw = w.w | 0;
    let bh = w.h | 0;
    if (w.type === "label" && (bw <= 0 || bh <= 0)) {
      const TS = window.LucarneTextStyle;
      const stLabel =
        TS && env && env.LE ? TS.resolveLabelWidget(env.LE, env.LE.project.theme, w) : { size: theme.textSize, atlas: theme.fontBody };
      const atlas = stLabel.atlas || theme.fontBody;
      const size = stLabel.size !== undefined ? stLabel.size : theme.textSize;
      const text = w.text || "";
      const m = atlas ? R.getAATextBounds(atlas, text) : { w: R.textWidth(text, size), h: 8 * size };
      if (bw <= 0) bw = m.w;
      if (bh <= 0) bh = m.h;
    }
    if (bw <= 0 || bh <= 0) return null;
    return { x, y, w: bw, h: bh };
  }

  function exportPxForIconWidget(w) {
    const R = render();
    if (R && R.iconWidgetDisplaySize) return R.iconWidgetDisplaySize(w).w;
    const FE = fluent();
    const base = FE && FE.SIZE ? FE.SIZE : 32;
    const sc = R ? R.normalizeIconScale(w.scale, 1) : 1;
    let side = Math.max(1, Math.round(base * sc));
    if (w.w > 0 && w.h > 0) side = Math.max(side, Math.max(w.w, w.h));
    const maxPx = FE && FE.MAX_EXPORT_PX ? FE.MAX_EXPORT_PX : 160;
    if (side > maxPx) side = maxPx;
    return side;
  }

  function animatedEmojiRefs(project) {
    const FE = fluent();
    const set = new Set();
    if (!FE) return set;
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type !== "icon" || !isAnimEmojiRef(w.icon)) return;
        const ic = FE.getIconByRef(w.icon);
        if (ic && ic.animated) set.add(w.icon);
      });
    });
    return set;
  }

  function collectAnimIconPlacements(project, LE) {
    const FE = fluent();
    const R = render();
    if (!FE || !R) return [];
    const out = [];
    (project.screens || []).forEach((screen) => {
      const widgets = screen.widgets || [];
      widgets.forEach((w, widgetIndex) => {
        if (w.type !== "icon" || w.visible === false) return;
        if (!isAnimEmojiRef(w.icon)) return;
        if (isTransparentColor(w.color)) return;
        const ic = FE.getIconByRef(w.icon);
        if (!ic || !ic.animated) return;
        const env = LE.env(screen, {});
        const rect = iconWidgetRect(w, env);
        if (!rect) return;
        out.push({
          screenId: screen.id,
          screenLabel: screen.name || screen.id,
          widgetId: w.id,
          widgetIndex,
          ref: w.icon,
          rect,
          exportPx: exportPxForIconWidget(w),
          opaqueBake: !!w.opaqueBake,
        });
      });
    });
    return out;
  }

  function collectOpaqueBakePlacements(project, LE) {
    return collectAnimIconPlacements(project, LE).filter((p) => p.opaqueBake);
  }

  function refUsedOutsideIconWidgets(project, ref) {
    let found = false;
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type === "button" && w.icon === ref) found = true;
        if (w.type === "menu") {
          (w.items || []).forEach((it) => {
            if (it.icon === ref) found = true;
            const ri = it.rightIcon;
            if (ri && ri !== "none" && ri !== "auto" && ri === ref) found = true;
          });
        }
      });
    });
    return found;
  }

  function refFullyOpaqueBaked(project, LE, ref) {
    let iconUses = 0;
    let opaqueUses = 0;
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type !== "icon" || w.icon !== ref) return;
        iconUses++;
        if (w.opaqueBake) opaqueUses++;
      });
    });
    if (!iconUses || iconUses !== opaqueUses) return false;
    return !refUsedOutsideIconWidgets(project, ref);
  }

  function bakedExportRef(ref, widgetId) {
    return ref + BAKE_SEP + widgetId;
  }

  function drawStaticUnderlay(disp, screen, theme, env, targetIndex, animRefs) {
    const R = render();
    const sw = disp.width;
    const sh = disp.height;
    const cr = screen.cornerRadius || 0;
    const bezel = theme.surfaceEdge;
    if (cr <= 0) {
      disp.fillScreen(theme.background);
    } else {
      disp.fillScreen(bezel);
      disp.fillRoundRect(0, 0, sw, sh, cr, theme.background);
    }
    const widgets = screen.widgets || [];
    for (let i = 0; i < targetIndex; i++) {
      const w = widgets[i];
      if (!w || w.visible === false) continue;
      if (isDynamicWidget(w)) continue;
      if (w.type === "icon" && isAnimEmojiRef(w.icon) && animRefs.has(w.icon)) continue;
      R.drawWidget(disp, w, theme, env);
    }
  }

  function extractRectPixels(disp, rect) {
    const out = new Uint16Array(rect.w * rect.h);
    for (let y = 0; y < rect.h; y++) {
      for (let x = 0; x < rect.w; x++) {
        out[y * rect.w + x] = disp.peekPixel(rect.x + x, rect.y + y);
      }
    }
    return out;
  }

  function compositeOpaqueFrame(bg, bgW, bgH, frame, dx, dy, dw, dh) {
    const R = render();
    const out = new Uint16Array(bgW * bgH);
    out.set(bg);
    const fw = frame.w;
    const fh = frame.h;
    const blend = R ? R.blend565 : null;
    for (let py = 0; py < dh; py++) {
      for (let px = 0; px < dw; px++) {
        const sx = Math.floor((px * fw) / dw);
        const sy = Math.floor((py * fh) / dh);
        const fi = sy * fw + sx;
        const a = frame.alpha ? frame.alpha[fi] : 255;
        if (a < 1) continue;
        const tx = dx + px;
        const ty = dy + py;
        if (tx < 0 || ty < 0 || tx >= bgW || ty >= bgH) continue;
        const fg = frame.pixels[fi];
        const bi = ty * bgW + tx;
        out[bi] = a >= 250 || !blend ? fg : blend(out[bi], fg, a);
      }
    }
    return { w: bgW, h: bgH, pixels: out };
  }

  async function bakePlacementOpaque(LE, placement, exportPx) {
    const R = render();
    const FE = fluent();
    if (!R || !FE || !FE.bakeForFlash) return null;
    const project = LE.project;
    const screen = (project.screens || []).find((s) => s.id === placement.screenId);
    if (!screen) return null;
    const alphaPack = await FE.bakeForFlash(placement.ref, exportPx || placement.exportPx);
    if (!alphaPack || !alphaPack.frames || alphaPack.frames.length <= 1) return null;

    const dims = window.LucarneState ? window.LucarneState.dims(project) : { w: 240, h: 280 };
    const disp = new R.Display(dims.w, dims.h);
    const theme = LE.renderTheme(screen.id);
    const env = LE.env(screen, {});
    const animRefs = animatedEmojiRefs(project);
    drawStaticUnderlay(disp, screen, theme, env, placement.widgetIndex, animRefs);
    const rect = placement.rect;
    const bg = extractRectPixels(disp, rect);
    const localDx = rect.dx - rect.x;
    const localDy = rect.dy - rect.y;
    const frames = [];
    for (let i = 0; i < alphaPack.frames.length; i++) {
      frames.push(
        compositeOpaqueFrame(bg, rect.w, rect.h, alphaPack.frames[i], localDx, localDy, rect.dw, rect.dh)
      );
    }
    return {
      w: rect.w,
      h: rect.h,
      exportPx: exportPx || placement.exportPx,
      frames,
      delays: alphaPack.delays,
      numPlays: alphaPack.numPlays,
      opaqueBake: true,
    };
  }

  function validateOpaqueBake(project, LE) {
    const warnings = [];
    const placements = collectOpaqueBakePlacements(project, LE);
    if (!placements.length) return { ok: true, warnings };
    const seen = new Set();
    function warn(msg) {
      if (seen.has(msg)) return;
      seen.add(msg);
      warnings.push(msg);
    }
    const refCounts = {};
    placements.forEach((p) => {
      refCounts[p.ref] = (refCounts[p.ref] || 0) + 1;
    });
    Object.keys(refCounts).forEach((ref) => {
      if (refCounts[ref] > 1) {
        warn(
          "Animated icon " +
            ref +
            " opaque bake on " +
            refCounts[ref] +
            " widgets — display glitches are likely if layouts differ."
        );
      }
    });
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i];
        const b = placements[j];
        if (a.screenId !== b.screenId) continue;
        if (rectsOverlap(a.rect, b.rect)) {
          warn(
            'Overlapping opaque-baked icons on "' +
              a.screenLabel +
              '" — display glitches are likely.'
          );
        }
      }
    }
    const theme = LE.renderTheme();
    (project.screens || []).forEach((screen) => {
      const env = LE.env(screen, {});
      placements
        .filter((p) => p.screenId === screen.id)
        .forEach((ap) => {
          (screen.widgets || []).forEach((w) => {
            if (w.visible === false) return;
            if (!isDynamicWidget(w)) return;
            const wr = widgetRect(w, env, theme);
            if (wr && rectsOverlap(ap.rect, wr)) {
              warn(
                'Opaque-baked icon on "' +
                  ap.screenLabel +
                  '" overlaps a ' +
                  w.type +
                  " — dynamic content may glitch."
              );
            }
          });
        });
    });
    return { ok: warnings.length === 0, warnings };
  }

  function estimateOpaqueBakeBytes(project, LE) {
    let n = 0;
    collectOpaqueBakePlacements(project, LE).forEach((p) => {
      const FE = fluent();
      const ic = FE && FE.getIconByRef(p.ref);
      let frames = 60;
      if (ic && ic.apng && ic.apng.frames) frames = ic.apng.frames.length;
      n += p.rect.w * p.rect.h * 2 * frames;
    });
    return n;
  }

  window.LucarneOpaqueBake = {
    BAKE_SEP,
    collectAnimIconPlacements,
    collectOpaqueBakePlacements,
    refUsedOutsideIconWidgets,
    refFullyOpaqueBaked,
    bakedExportRef,
    bakePlacementOpaque,
    validateOpaqueBake,
    estimateOpaqueBakeBytes,
    widgetById,
  };
})();
