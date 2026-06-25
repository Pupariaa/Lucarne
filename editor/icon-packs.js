(function () {
  "use strict";

  const F = window.LucarneIconFmt;
  const ICON_CACHE = new Map();
  let index = null;
  let indexPromise = null;
  const manifests = new Map();
  const manifestPromises = new Map();
  const iconPromises = new Map();

  function baseUrl() {
    const s = document.querySelector('script[src*="icon-packs.js"]');
    if (!s || !s.src) return "icon-packs/";
    return s.src.replace(/[^/]+$/, "icon-packs/");
  }

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (!indexPromise) {
      indexPromise = fetch(baseUrl() + "index.json")
        .then((r) => {
          if (!r.ok) throw new Error("icon packs index missing");
          return r.json();
        })
        .then((data) => {
          index = data;
          return index;
        })
        .catch((e) => {
          indexPromise = null;
          throw e;
        });
    }
    return indexPromise;
  }

  function loadManifest(packId) {
    if (manifests.has(packId)) return Promise.resolve(manifests.get(packId));
    if (!manifestPromises.has(packId)) {
      manifestPromises.set(
        packId,
        loadIndex()
          .then((idx) => {
            const meta = (idx.packs || []).find((p) => p.id === packId);
            if (!meta) throw new Error("pack not found: " + packId);
            return fetch(baseUrl() + meta.manifest).then((r) => {
              if (!r.ok) throw new Error("manifest missing: " + meta.manifest);
              return r.json();
            });
          })
          .then((m) => {
            manifests.set(packId, m);
            return m;
          })
          .catch((e) => {
            manifestPromises.delete(packId);
            throw e;
          })
      );
    }
    return manifestPromises.get(packId);
  }

  function parseRef(ref) {
    if (!ref) return null;
    const i = ref.indexOf(":");
    if (i <= 0) return null;
    return { packId: ref.slice(0, i), name: ref.slice(i + 1), ref: ref };
  }

  function iconUrl(packId, name) {
    return baseUrl() + packId + "/icons/" + encodeURIComponent(name) + ".json";
  }

  function cacheIcon(packId, name, icon) {
    ICON_CACHE.set(packId + ":" + name, icon);
    const m = manifests.get(packId);
    if (m) ICON_CACHE.set(m.refPrefix + name, icon);
    return icon;
  }

  function loadIconFile(packId, name) {
    const key = packId + ":" + name;
    if (ICON_CACHE.has(key)) return Promise.resolve(ICON_CACHE.get(key));
    if (!iconPromises.has(key)) {
      iconPromises.set(
        key,
        fetch(iconUrl(packId, name))
          .then((r) => {
            if (!r.ok) throw new Error("icon missing: " + name);
            return r.json();
          })
          .then((raw) => {
            const icon = F.decodePackIcon(raw);
            if (!icon) throw new Error("bad icon: " + name);
            return cacheIcon(packId, name, icon);
          })
          .catch((e) => {
            iconPromises.delete(key);
            throw e;
          })
      );
    }
    return iconPromises.get(key);
  }

  function getIcon(ref) {
    return ICON_CACHE.get(ref) || null;
  }

  async function ensureRef(ref) {
    const cached = getIcon(ref);
    if (cached) return cached;
    const p = parseRef(ref);
    if (!p) return null;
    await loadManifest(p.packId);
    return loadIconFile(p.packId, p.name);
  }

  function searchPack(manifest, query, limit) {
    const q = (query || "").trim().toLowerCase();
    let pool = manifest.names || [];
    if (q) pool = pool.filter((n) => n.indexOf(q) !== -1);
    return pool.slice(0, limit || 150);
  }

  function collectRefs(project) {
    const set = new Set();
    function use(ref) {
      if (!ref || ref === "none") return;
      if (parseRef(ref)) set.add(ref);
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
    await loadIndex();
    const refs = collectRefs(project);
    await Promise.all(refs.map((r) => ensureRef(r).catch(() => null)));
  }

  window.LucarneIconPacks = {
    loadIndex,
    loadManifest,
    loadIconFile,
    parseRef,
    getIcon,
    ensureRef,
    searchPack,
    collectRefs,
    preloadProject,
  };
})();
