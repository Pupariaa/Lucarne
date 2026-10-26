(function () {
  "use strict";

  const FALLBACK_CDN = "https://cdn.jsdelivr.net/gh/bignutty/fluent-emoji@main/animated/";
  const REF_PREFIX = "emoji:";
  const SIZE = window.LucarneIconFmt ? window.LucarneIconFmt.ICON_SIZE : 32;
  const ICON_CACHE = new Map();
  const PLAYERS = new Set();
  const MAX_EXPORT_FRAMES = 0;
  const MAX_EXPORT_PX = 512;
  let manifest = null;
  let manifestPromise = null;
  let fileIndex = null;
  let cdnBase = FALLBACK_CDN;

  function rgb888to565(r, g, b) {
    return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
  }

  function parseApngLib() {
    const lib = window["apng-js"];
    if (!lib || typeof lib.default !== "function") return null;
    return lib;
  }

  function manifestUrl() {
    const s = document.querySelector('script[src*="fluent-emojis.js"]');
    if (!s || !s.src) return "fluent-emoji-manifest.json";
    return s.src.replace(/[^/]+$/, "fluent-emoji-manifest.json");
  }

  async function loadManifest() {
    if (manifest) return manifest;
    const res = await fetch(manifestUrl());
    if (!res.ok) throw new Error("Fluent emoji manifest unavailable");
    manifest = await res.json();
    if (manifest.cdn) cdnBase = manifest.cdn;
    fileIndex = new Map();
    (manifest.icons || []).forEach((ic) => fileIndex.set(ic.id, ic));
    return manifest;
  }

  function ensureManifest() {
    if (!manifestPromise) {
      manifestPromise = loadManifest().catch((e) => {
        manifestPromise = null;
        throw e;
      });
    }
    return manifestPromise;
  }

  function pngUrl(idOrFile) {
    const name = idOrFile.indexOf(".png") === idOrFile.length - 4 ? idOrFile : idOrFile + ".png";
    return cdnBase + name.split("/").map(encodeURIComponent).join("/");
  }

  function parseEmojiRef(ref) {
    if (!ref || ref.indexOf(REF_PREFIX) !== 0) return null;
    return ref.slice(REF_PREFIX.length);
  }

  function emojiRef(id) {
    return REF_PREFIX + id;
  }

  function normalizeLegacyId(id) {
    if (!manifest || !id) return id;
    if (fileIndex.has(id)) return id;
    if (id.indexOf("/") >= 0 && manifest.legacy && manifest.legacy[id]) return manifest.legacy[id];
    return id;
  }

  function rasterizeSource(source, srcW, srcH, outSize) {
    const size = outSize > 0 ? outSize : SIZE;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, size, size);
    const scale = Math.min(size / srcW, size / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    ctx.drawImage(source, (size - dw) / 2, (size - dh) / 2, dw, dh);
    const data = ctx.getImageData(0, 0, size, size).data;
    const pixels = new Uint16Array(size * size);
    const alpha = new Uint8Array(size * size);
    for (let p = 0, i = 0; p < size * size; p++, i += 4) {
      alpha[p] = data[i + 3];
      pixels[p] = rgb888to565(data[i], data[i + 1], data[i + 2]);
    }
    return { w: size, h: size, pixels, alpha };
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("PNG load failed"));
      img.src = url;
    });
  }

  async function loadStaticIcon(url) {
    const img = await loadImage(url);
    const base = rasterizeSource(img, img.naturalWidth, img.naturalHeight);
    return Object.assign(base, { color: true, animated: false, image: img, url });
  }

  async function loadAnimatedIcon(url) {
    const lib = parseApngLib();
    if (!lib) throw new Error("apng-js unavailable");
    const parseAPNG = lib.default;
    const res = await fetch(url);
    if (!res.ok) throw new Error("PNG fetch failed");
    const buffer = await res.arrayBuffer();
    const apng = parseAPNG(buffer);
    if (apng instanceof Error) {
      if (lib.isNotAPNG && lib.isNotAPNG(apng)) return loadStaticIcon(url);
      throw apng;
    }
    if (!apng.frames || apng.frames.length <= 1) return loadStaticIcon(url);

    await apng.createImages();
    const canvas = document.createElement("canvas");
    canvas.width = apng.width;
    canvas.height = apng.height;
    const ctx = canvas.getContext("2d");
    const player = await apng.getPlayer(ctx, false);
    PLAYERS.add(player);

    const base = rasterizeSource(canvas, apng.width, apng.height);
    return Object.assign(base, {
      color: true,
      animated: true,
      image: canvas,
      url,
      player,
      apng,
    });
  }

  function framesEqualLocal(a, b) {
    if (!a || !b || a.w !== b.w || a.h !== b.h) return false;
    if (!a.pixels || !b.pixels || a.pixels.length !== b.pixels.length) return false;
    for (let i = 0; i < a.pixels.length; i++) {
      if (a.pixels[i] !== b.pixels[i]) return false;
      const aa = a.alpha ? a.alpha[i] : 255;
      const ba = b.alpha ? b.alpha[i] : 255;
      if (aa !== ba) return false;
    }
    return true;
  }

  function mergeConsecutiveFrames(frames, delays) {
    if (!frames.length) return { frames: [], delays: [] };
    const outF = [frames[0]];
    const outD = [delays[0] || 1];
    for (let i = 1; i < frames.length; i++) {
      if (framesEqualLocal(frames[i], outF[outF.length - 1])) {
        outD[outD.length - 1] += delays[i] || 1;
      } else {
        outF.push(frames[i]);
        outD.push(delays[i] || 1);
      }
    }
    return { frames: outF, delays: outD };
  }

  function findWidgetByIconKey(project, key) {
    if (!key || !project.screens) return null;
    for (let si = 0; si < project.screens.length; si++) {
      const screen = project.screens[si];
      const widgets = screen.widgets || [];
      for (let wi = 0; wi < widgets.length; wi++) {
        const w = widgets[wi];
        if (w.id === key) return w;
      }
    }
    return null;
  }

  function resolveAnimExportOpts(project, widgetOrKey) {
    const g = (project && project.iconAnim) || {};
    let w = widgetOrKey;
    if (typeof widgetOrKey === "string") w = findWidgetByIconKey(project, widgetOrKey);
    const maxFrames =
      w && w.animMaxFrames > 0 ? w.animMaxFrames : g.maxFrames > 0 ? g.maxFrames : 0;
    const frameStep = w && w.animFrameStep > 1 ? w.animFrameStep : g.frameStep > 1 ? g.frameStep : 1;
    return { maxFrames, frameStep };
  }

  function sourceFrameCount(ref) {
    const ic = getIconByRef(ref);
    if (ic && ic.apng && ic.apng.frames && ic.apng.frames.length) return ic.apng.frames.length;
    if (ic && ic.player && ic.apng && ic.apng.frames) return ic.apng.frames.length;
    return 1;
  }

  function effectiveExportFrameCount(sourceCount, opts) {
    if (!sourceCount || sourceCount < 1) return 1;
    const step = opts && opts.frameStep > 1 ? opts.frameStep : 1;
    let n = Math.ceil(sourceCount / step);
    if (opts && opts.maxFrames > 0 && n > opts.maxFrames) n = opts.maxFrames;
    return Math.max(1, n);
  }

  function estimateAnimFlashBytes(exportPx, frameCount, storage) {
    const px = Math.max(1, exportPx || SIZE);
    const fc = Math.max(1, frameCount || 1);
    let n = fc * 12 + fc * 2 + 64;
    n += fc * px * px * 2;
    if (storage !== "flash") n += fc * px * px;
    return n;
  }

  function frameIndicesForExport(sourceCount, opts) {
    const step = opts && opts.frameStep > 1 ? opts.frameStep : 1;
    const maxFrames = opts && opts.maxFrames > 0 ? opts.maxFrames : 0;
    const indices = [];
    for (let i = 0; i < sourceCount; i += step) {
      indices.push(i);
      if (maxFrames > 0 && indices.length >= maxFrames) break;
    }
    return indices.length ? indices : [0];
  }

  async function bakeApngUrlForFlash(url, exportPx, opts) {
    const lib = parseApngLib();
    if (!lib) return null;
    const parseAPNG = lib.default;
    const res = await fetch(url);
    if (!res.ok) return null;
    const apng = parseAPNG(await res.arrayBuffer());
    if (apng instanceof Error || !apng.frames || apng.frames.length <= 1) return null;
    await apng.createImages();
    const sw = apng.width;
    const sh = apng.height;
    let outSize = exportPx > 0 ? Math.round(exportPx) : SIZE;
    if (outSize < SIZE) outSize = SIZE;
    if (outSize > MAX_EXPORT_PX) outSize = MAX_EXPORT_PX;
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    const frames = [];
    const delays = [];
    let prevFrameData = null;
    const indices = frameIndicesForExport(apng.frames.length, opts);
    for (let ii = 0; ii < indices.length; ii++) {
      const i = indices[ii];
      const frame = apng.frames[i];
      if (frame.disposeOp === 2 && prevFrameData) ctx.putImageData(prevFrameData, 0, 0);
      if (frame.blendOp === 0) ctx.clearRect(frame.left, frame.top, frame.width, frame.height);
      if (frame.disposeOp === 2) prevFrameData = ctx.getImageData(0, 0, sw, sh);
      ctx.drawImage(frame.imageElement, frame.left, frame.top);
      frames.push(rasterizeSource(canvas, sw, sh, outSize));
      delays.push(Math.max(1, Math.round((frame.delay || 100) * (opts && opts.frameStep > 1 ? opts.frameStep : 1))));
      if (frame.disposeOp === 1) ctx.clearRect(frame.left, frame.top, frame.width, frame.height);
    }
    const merged = mergeConsecutiveFrames(frames, delays);
    return {
      w: outSize,
      h: outSize,
      exportPx: outSize,
      frames: merged.frames,
      delays: merged.delays,
      numPlays: apng.numPlays || 0,
      sourceFrames: apng.frames.length,
      exportFrames: merged.frames.length,
    };
  }

  async function bakeForFlash(ref, exportPx, opts) {
    const id = parseEmojiRef(ref);
    if (!id) return null;
    await ensureManifest();
    const key = normalizeLegacyId(id);
    const meta = fileIndex.get(key);
    if (!meta) return null;
    const url = pngUrl(meta.file || key);
    try {
      return await bakeApngUrlForFlash(url, exportPx, opts);
    } catch (e) {
      return null;
    }
  }

  function collectAnimIconUsage(project) {
    const usage = {};
    const R = window.LucarneRender;
    function consider(ref, w) {
      if (!ref || ref.indexOf(REF_PREFIX) !== 0 || !w) return;
      const sz =
        R && R.iconWidgetDisplaySize ? R.iconWidgetDisplaySize(w, project.icons || {}) : null;
      const side = sz ? sz.w : SIZE;
      if (!usage[ref] || side > usage[ref]) usage[ref] = side;
    }
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type === "icon") consider(w.icon, w);
        if (w.type === "button") consider(w.icon, w);
        if (w.type === "menu") {
          (w.items || []).forEach((it) => {
            consider(it.icon, w);
            const ri = it.rightIcon;
            if (ri && ri !== "none" && ri !== "auto") consider(ri, w);
          });
        }
      });
    });
    return usage;
  }

  async function ensureIcon(id) {
    if (!id) return null;
    const key = normalizeLegacyId(id);
    if (ICON_CACHE.has(key)) return ICON_CACHE.get(key);
    await ensureManifest();
    const meta = fileIndex.get(key);
    if (!meta) return null;
    const url = pngUrl(meta.file || key);
    let icon = null;
    try {
      icon = await loadAnimatedIcon(url);
    } catch (e) {
      icon = await loadStaticIcon(url);
    }
    ICON_CACHE.set(key, icon);
    return icon;
  }

  function getIcon(id) {
    return ICON_CACHE.get(normalizeLegacyId(id)) || null;
  }

  function getIconByRef(ref) {
    const id = parseEmojiRef(ref);
    if (!id) return null;
    return getIcon(id);
  }

  function refMayAnimate(ref) {
    if (!ref || ref.indexOf(REF_PREFIX) !== 0) return false;
    const ic = getIconByRef(ref);
    if (ic) return !!ic.animated;
    const id = parseEmojiRef(ref);
    if (!id) return false;
    if (fileIndex) return fileIndex.has(normalizeLegacyId(id));
    return true;
  }

  function collectEmojiIds(project) {
    const set = new Set();
    function use(ref) {
      const id = parseEmojiRef(ref);
      if (id) set.add(id);
    }
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type === "icon") use(w.icon);
        if (w.type === "button") use(w.icon);
        if (w.type === "menu")
          (w.items || []).forEach((it) => {
            use(it.icon);
            const ri = it.rightIcon;
            if (ri && ri !== "none" && ri !== "auto") use(ri);
          });
      });
    });
    return Array.from(set);
  }

  function hasAnimatedInCache(project) {
    const ids = collectEmojiIds(project);
    for (let i = 0; i < ids.length; i++) {
      const ic = ICON_CACHE.get(normalizeLegacyId(ids[i]));
      if (ic && ic.player) return true;
    }
    return false;
  }

  function projectUsesAnimatedEmoji(project) {
    return hasAnimatedInCache(project);
  }

  function pauseAnimated() {
    PLAYERS.forEach((p) => {
      if (p && !p.paused) p.pause();
    });
  }

  function resumeAnimated() {
    PLAYERS.forEach((p) => {
      if (p && !p.ended) p.play();
    });
  }

  async function preloadProject(project) {
    const ids = collectEmojiIds(project);
    await Promise.all(ids.map((id) => ensureIcon(id).catch(() => null)));
  }

  function projectUsesEmoji(project) {
    return collectEmojiIds(project).length > 0;
  }

  function capped(arr, limit) {
    if (limit > 0) return arr.slice(0, limit);
    return arr;
  }

  function searchIcons(query, category, limit) {
    if (!manifest) return [];
    let pool = manifest.icons || [];
    if (category && category !== "all") {
      pool = pool.filter((ic) => ic.category === category);
    }
    const q = (query || "").trim().toLowerCase();
    if (!q) return capped(pool, limit);
    const out = [];
    for (let i = 0; i < pool.length; i++) {
      const ic = pool[i];
      if (ic.id.indexOf(q) !== -1 || ic.label.toLowerCase().indexOf(q) !== -1) out.push(ic);
      if (limit > 0 && out.length >= limit) break;
    }
    return out;
  }

  window.LucarneFluentEmoji = {
    REF_PREFIX,
    SIZE,
    ensureManifest,
    ensureIcon,
    getIcon,
    getIconByRef,
    refMayAnimate,
    parseEmojiRef,
    emojiRef,
    pngUrl,
    preloadProject,
    projectUsesEmoji,
    projectUsesAnimatedEmoji,
    hasAnimatedInCache,
    pauseAnimated,
    resumeAnimated,
    searchIcons,
    collectEmojiIds,
    collectAnimIconUsage,
    resolveAnimExportOpts,
    sourceFrameCount,
    effectiveExportFrameCount,
    estimateAnimFlashBytes,
    findWidgetByIconKey,
    normalizeLegacyId,
    bakeForFlash,
    bakeApngUrlForFlash,
    MAX_EXPORT_PX,
  };
})();
