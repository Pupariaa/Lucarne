(function () {
  "use strict";

  const TABLER_VERSION = "3.44.0";
  const CDN = "https://cdn.jsdelivr.net/npm/@tabler/icons@" + TABLER_VERSION;
  const SIZE = window.LucarneIconFmt ? window.LucarneIconFmt.ICON_SIZE : 32;
  const ICON_CACHE = new Map();
  let catalog = null;
  let catalogPromise = null;

  function svgUrl(name) {
    return CDN + "/icons/outline/" + name + ".svg";
  }

  function rgb888to565(r, g, b) {
    return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
  }

  function rasterizeSvg(svgText) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = SIZE;
        c.height = SIZE;
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, SIZE, SIZE);
        const scale = Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
        const pixels = new Uint16Array(SIZE * SIZE);
        const alpha = new Uint8Array(SIZE * SIZE);
        for (let p = 0, i = 0; p < SIZE * SIZE; p++, i += 4) {
          alpha[p] = data[i + 3];
          pixels[p] = rgb888to565(data[i], data[i + 1], data[i + 2]);
        }
        URL.revokeObjectURL(url);
        resolve({ w: SIZE, h: SIZE, pixels, alpha, color: true });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("SVG rasterize failed"));
      };
      img.src = url;
    });
  }

  async function loadCatalog() {
    if (catalog) return catalog;
    const P = window.LucarneIconPacks;
    if (P) {
      try {
        const idx = await P.loadIndex();
        const emb = (idx.packs || []).find((p) => p.id === "tabler");
        if (emb) {
          const m = await P.loadManifest("tabler");
          catalog = { names: m.names, categories: [], tagIndex: {}, embedded: true };
          return catalog;
        }
      } catch (e) {}
    }
    const res = await fetch(CDN + "/icons.json");
    if (!res.ok) throw new Error("Tabler catalog unavailable");
    const data = await res.json();
    const names = Object.keys(data).sort();
    catalog = { names, tagIndex: {}, categories: [], embedded: false };
    return catalog;
  }

  function ensureCatalog() {
    if (!catalogPromise) {
      catalogPromise = loadCatalog().catch((e) => {
        catalogPromise = null;
        throw e;
      });
    }
    return catalogPromise;
  }

  async function fetchSvg(name) {
    const res = await fetch(svgUrl(name));
    if (!res.ok) throw new Error("Icon not found: " + name);
    return res.text();
  }

  async function ensureIcon(name) {
    if (!name) return null;
    if (ICON_CACHE.has(name)) return ICON_CACHE.get(name);
    const P = window.LucarneIconPacks;
    if (P) {
      try {
        const icon = await P.ensureRef("tabler:" + name);
        if (icon) {
          ICON_CACHE.set(name, icon);
          return icon;
        }
      } catch (e) {}
    }
    const svg = await fetchSvg(name);
    const icon = await rasterizeSvg(svg);
    ICON_CACHE.set(name, icon);
    return icon;
  }

  function getIcon(name) {
    return ICON_CACHE.get(name) || null;
  }

  function tablerRef(name) {
    return "tabler:" + name;
  }

  function parseTablerRef(ref) {
    if (!ref || ref.indexOf("tabler:") !== 0) return null;
    return ref.slice(7);
  }

  function collectTablerNames(project) {
    const set = new Set();
    function use(ref) {
      const n = parseTablerRef(ref);
      if (n) set.add(n);
    }
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type === "icon") use(w.icon);
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

  async function preloadProject(project) {
    const names = collectTablerNames(project);
    await Promise.all(names.map((n) => ensureIcon(n).catch(() => null)));
  }

  function searchIcons(query, category, limit) {
    if (!catalog) return [];
    let pool = catalog.names;
    if (!catalog.embedded && category && category !== "all" && catalog.tagIndex[category]) {
      pool = catalog.tagIndex[category];
    }
    const q = (query || "").trim().toLowerCase();
    if (!q) return pool.slice(0, limit || 150);
    const out = [];
    for (let i = 0; i < pool.length && out.length < (limit || 150); i++) {
      const n = pool[i];
      if (n.indexOf(q) !== -1) out.push(n);
    }
    return out;
  }

  window.LucarneTabler = {
    CDN,
    SIZE,
    svgUrl,
    ensureCatalog,
    ensureIcon,
    getIcon,
    tablerRef,
    parseTablerRef,
    collectTablerNames,
    preloadProject,
    searchIcons,
    rasterizeSvg,
  };
})();
