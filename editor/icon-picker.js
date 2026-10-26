(function () {
  "use strict";

  const T = window.LucarneTabler;
  const E = window.LucarneFluentEmoji;
  const P = window.LucarneIconPacks;
  function getRender() {
    return window.LucarneRender;
  }

  const F = window.LucarneIconFmt;
  const BATCH = 120;
  const LOAD_MARGIN = 280;
  const MAX_LOADS = 8;

  let host = null;
  let onPick = null;
  let pickValue = "";
  let packList = [];
  let activePack = "tabler";
  let lazyRoot = null;
  let lazyObserver = null;
  const loadQueue = [];
  const lazyJobs = new WeakMap();
  let loadActive = 0;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function ensureHost() {
    if (host) return host;
    host = el("div", "icon-picker modal", document.body);
    host.hidden = true;
    const card = el("div", "icon-picker-card modal-card size-xl", host);
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "iconPickerTitle");
    const head = el("div", "icon-picker-head modal-head", card);
    const title = el("h2", "icon-picker-title lc-dialog-title", head);
    title.id = "iconPickerTitle";
    title.textContent = "Icons";
    const close = el("button", "btn ghost", head);
    close.textContent = "Close";
    close.setAttribute("aria-label", "Close icon picker");
    close.addEventListener("click", () => closePicker());
    const toolbar = el("div", "icon-picker-toolbar", card);
    toolbar.setAttribute("role", "search");
    const packSel = el("select", "select icon-picker-pack", toolbar);
    packSel.setAttribute("aria-label", "Icon pack");
    const search = el("input", "field icon-picker-search", toolbar);
    search.type = "search";
    search.placeholder = "Search icons…";
    search.setAttribute("aria-label", "Search icons");
    const catSel = el("select", "select icon-picker-cat", toolbar);
    catSel.setAttribute("aria-label", "Icon category");
    catSel.hidden = true;
    const body = el("div", "icon-picker-body", card);
    const grid = el("div", "icon-picker-grid", body);
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Available icons");
    const foot = el("div", "icon-picker-foot muted", card);
    foot.setAttribute("aria-live", "polite");
    foot.textContent = "";
    host._pack = packSel;
    host._search = search;
    host._cat = catSel;
    host._grid = grid;
    host._foot = foot;
    host._body = body;
    packSel.addEventListener("change", () => {
      activePack = packSel.value;
      host._cat.hidden = activePack !== "tabler" && activePack !== "fluent";
      if (activePack === "tabler" && T && T._embedded) host._cat.hidden = true;
      renderGrid();
    });
    search.addEventListener("input", () => renderGrid());
    catSel.addEventListener("change", () => renderGrid());
    body.addEventListener("scroll", () => {
      flushVisible(body);
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 120) {
        appendGridBatch(host);
        fillViewport(host);
      }
    });
    host.addEventListener("click", (ev) => {
      if (ev.target === host) closePicker();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && host && !host.hidden) closePicker();
    });
    grid.addEventListener("keydown", (ev) => {
      const cell = ev.target.closest && ev.target.closest(".icon-picker-cell");
      if (!cell) return;
      const cells = Array.from(grid.querySelectorAll(".icon-picker-cell"));
      const i = cells.indexOf(cell);
      if (i < 0) return;
      const cols = Math.max(1, Math.round(grid.clientWidth / Math.max(1, cell.offsetWidth)));
      let next = -1;
      if (ev.key === "ArrowRight") next = i + 1;
      else if (ev.key === "ArrowLeft") next = i - 1;
      else if (ev.key === "ArrowDown") next = i + cols;
      else if (ev.key === "ArrowUp") next = i - cols;
      else if (ev.key === "Home") next = 0;
      else if (ev.key === "End") next = cells.length - 1;
      else return;
      ev.preventDefault();
      next = Math.max(0, Math.min(cells.length - 1, next));
      cells[next].focus();
      cells[next].scrollIntoView({ block: "nearest" });
    });
    return host;
  }

  let releaseTrap = null;

  function closePicker() {
    if (!host || host.hidden) return;
    host.hidden = true;
    onPick = null;
    const release = releaseTrap;
    releaseTrap = null;
    if (release) release();
  }

  function pickFailed(cell, label, err) {
    console.warn("Icon load failed for " + label, err);
    cell.classList.add("broken");
    if (host && host._foot) host._foot.textContent = "Could not load \u201c" + label + "\u201d \u2014 check your connection and try again.";
  }

  function addCell(grid, value, label, paintFn) {
    const cell = el("button", "icon-picker-cell", grid);
    if (value === pickValue) cell.classList.add("sel");
    const cv = el("canvas", "icon-picker-cv", cell);
    cv.width = 32;
    cv.height = 32;
    paintFn(cv);
    const lbl = el("span", "icon-picker-lbl", cell);
    lbl.textContent = label;
    cell.addEventListener("click", () => {
      if (onPick) onPick(value);
      closePicker();
    });
    return cell;
  }

  function paintRef(cv, ref) {
    const LR = getRender();
    if (!LR) return;
    const ic = LR.resolveIcon(ref, { customIconAtlas: () => null });
    if (F) F.drawToCanvas(cv, ic);
  }

  function resetLazyLoader() {
    if (lazyObserver) {
      lazyObserver.disconnect();
      lazyObserver = null;
    }
    lazyRoot = null;
    loadQueue.length = 0;
    loadActive = 0;
  }

  function ensureLazyObserver(root) {
    if (lazyObserver && lazyRoot === root) return lazyObserver;
    resetLazyLoader();
    lazyRoot = root;
    if (!("IntersectionObserver" in window)) return null;
    lazyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          lazyObserver.unobserve(entry.target);
          const el = entry.target;
          if (el.tagName === "IMG" && el.dataset.src) enqueueImgLoad(el);
          else runLazyJob(el);
        });
      },
      { root, rootMargin: LOAD_MARGIN + "px 0px", threshold: 0.01 }
    );
    return lazyObserver;
  }

  function startImgLoad(img) {
    const src = img.dataset.src;
    if (!src || img.dataset.loaded || img.dataset.loading) return;
    img.dataset.loading = "1";
    loadActive++;
    const done = () => {
      loadActive--;
      pumpLoadQueue();
    };
    img.addEventListener(
      "load",
      () => {
        img.dataset.loaded = "1";
        delete img.dataset.loading;
        done();
      },
      { once: true }
    );
    img.addEventListener(
      "error",
      () => {
        delete img.dataset.loading;
        if (!img.dataset.retried) {
          img.dataset.retried = "1";
          loadActive--;
          enqueueImgLoad(img, true);
          return;
        }
        img.dataset.loaded = "1";
        done();
      },
      { once: true }
    );
    img.src = src;
  }

  function pumpLoadQueue() {
    while (loadActive < MAX_LOADS && loadQueue.length) {
      const img = loadQueue.shift();
      if (img && img.isConnected) startImgLoad(img);
    }
  }

  function enqueueImgLoad(img, front) {
    if (!img || img.dataset.loaded || img.dataset.loading) return;
    if (loadQueue.indexOf(img) >= 0) return;
    if (front) loadQueue.unshift(img);
    else loadQueue.push(img);
    pumpLoadQueue();
  }

  function runLazyJob(el) {
    const fn = lazyJobs.get(el);
    if (!fn || el.dataset.loaded) return;
    lazyJobs.delete(el);
    el.dataset.loaded = "1";
    fn();
  }

  function isVisibleInRoot(el, root, margin) {
    const rootRect = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) return false;
    return !(r.bottom < rootRect.top - margin || r.top > rootRect.bottom + margin);
  }

  function flushVisible(root) {
    if (!root) return;
    root.querySelectorAll("img[data-src]:not([data-loaded])").forEach((img) => {
      if (isVisibleInRoot(img, root, LOAD_MARGIN)) enqueueImgLoad(img);
    });
    root.querySelectorAll("canvas[data-lazy]:not([data-loaded])").forEach((cv) => {
      if (isVisibleInRoot(cv, root, LOAD_MARGIN)) runLazyJob(cv);
    });
  }

  function lazyWhenVisible(el, root, fn) {
    if (!("IntersectionObserver" in window)) {
      fn();
      return;
    }
    const obs = ensureLazyObserver(root);
    if (!obs) {
      fn();
      return;
    }
    lazyJobs.set(el, fn);
    if (el.tagName === "CANVAS") el.dataset.lazy = "1";
    obs.observe(el);
    requestAnimationFrame(() => flushVisible(root));
  }

  function lazyImg(img, src, root) {
    img.width = 32;
    img.height = 32;
    img.dataset.src = src;
    if (!("IntersectionObserver" in window)) {
      img.src = src;
      return;
    }
    const obs = ensureLazyObserver(root);
    if (!obs) {
      img.src = src;
      return;
    }
    obs.observe(img);
    requestAnimationFrame(() => flushVisible(root));
  }

  function appendFluentCell(grid, ic, h) {
    const ref = E.emojiRef(ic.id);
    const cell = el("button", "icon-picker-cell", grid);
    if (ref === pickValue) cell.classList.add("sel");
    const img = el("img", "icon-picker-svg icon-picker-apng", cell);
    img.alt = ic.label || ic.id;
    const lbl = el("span", "icon-picker-lbl", cell);
    lbl.textContent = ic.label || ic.id;
    cell.addEventListener("click", async () => {
      try {
        await E.ensureIcon(ic.id);
        if (onPick) onPick(ref);
        closePicker();
      } catch (err) {
        pickFailed(cell, ic.label || ic.id, err);
      }
    });
    lazyImg(img, E.pngUrl(ic.file || ic.id), h._body);
    img.addEventListener("error", () => cell.classList.add("broken"));
  }

  function appendTablerCell(grid, name, h) {
    const ref = T.tablerRef(name);
    const cell = el("button", "icon-picker-cell", grid);
    if (ref === pickValue) cell.classList.add("sel");
    const img = el("img", "icon-picker-svg", cell);
    img.alt = name;
    const lbl = el("span", "icon-picker-lbl", cell);
    lbl.textContent = name;
    cell.addEventListener("click", async () => {
      try {
        await T.ensureIcon(name);
        if (onPick) onPick(ref);
        closePicker();
      } catch (e) {
        pickFailed(cell, name, e);
      }
    });
    lazyImg(img, T.svgUrl(name), h._body);
    img.addEventListener("error", () => cell.classList.add("broken"));
  }

  function appendEmbeddedCell(grid, packId, name, h) {
    const meta = packList.find((p) => p.id === packId);
    const ref = (meta ? meta.refPrefix : packId + ":") + name;
    const cell = el("button", "icon-picker-cell", grid);
    if (ref === pickValue) cell.classList.add("sel");
    const cv = el("canvas", "icon-picker-cv", cell);
    cv.width = 32;
    cv.height = 32;
    const lbl = el("span", "icon-picker-lbl", cell);
    lbl.textContent = name;
    lazyWhenVisible(cv, h._body, () => {
      const cached = P.getIcon(ref);
      if (cached && F) {
        F.drawToCanvas(cv, cached);
        return;
      }
      if (!P) return;
      P.loadIconFile(packId, name)
        .then((icon) => F.drawToCanvas(cv, icon))
        .catch(() => cell.classList.add("broken"));
    });
    cell.addEventListener("click", async () => {
      try {
        if (P) await P.loadIconFile(packId, name);
        if (onPick) onPick(ref);
        closePicker();
      } catch (e) {
        pickFailed(cell, name, e);
      }
    });
  }

  function updateFoot(h, label) {
    const st = h._gridState;
    if (!st) return;
    const suffix = label ? " · " + label : "";
    h._foot.textContent = st.shown + " / " + st.items.length + suffix;
  }

  function appendGridBatch(h) {
    const st = h._gridState;
    if (!st || st.shown >= st.items.length) return;
    const grid = h._grid;
    const batch = st.items.slice(st.shown, st.shown + BATCH);
    batch.forEach((item) => {
      if (item.kind === "fluent") appendFluentCell(grid, item.ic, h);
      else if (item.kind === "tabler") appendTablerCell(grid, item.name, h);
      else if (item.kind === "embedded") appendEmbeddedCell(grid, item.packId, item.name, h);
    });
    st.shown += batch.length;
    updateFoot(h, st.label);
    requestAnimationFrame(() => flushVisible(h._body));
  }

  async function buildGridItems(h) {
    const search = h._search.value;
    const cat = h._cat.value || "all";
    const items = [];

    if (activePack === "tabler" && T) {
      const catalog = await T.ensureCatalog();
      if (catalog.embedded) {
        const man = await P.loadManifest("tabler");
        P.searchPack(man, search, 0).forEach((name) => items.push({ kind: "embedded", packId: "tabler", name }));
        return { items, label: "Tabler (embedded)" };
      }
      T.searchIcons(search, cat, 0).forEach((name) => items.push({ kind: "tabler", name }));
      return { items, label: "Tabler (online)" };
    }

    if (activePack === "fluent" && E) {
      await E.ensureManifest();
      E.searchIcons(search, cat, 0).forEach((ic) => items.push({ kind: "fluent", ic }));
      return { items, label: "Fluent Emojis (APNG)" };
    }

    const meta = packList.find((p) => p.id === activePack);
    if (meta && P) {
      const manifest = await P.loadManifest(meta.id);
      P.searchPack(manifest, search, 0).forEach((name) => items.push({ kind: "embedded", packId: meta.id, name }));
      return { items, label: meta.label };
    }

    return { items, label: "" };
  }

  function fillViewport(h) {
    const body = h._body;
    const st = h._gridState;
    if (!st) return;
    while (st.shown < st.items.length && body.scrollHeight <= body.clientHeight + 8) {
      appendGridBatch(h);
    }
  }

  async function renderGrid() {
    const h = ensureHost();
    const grid = h._grid;
    const extras = h._extras || [];
    resetLazyLoader();
    grid.innerHTML = "";
    h._gridState = null;
    h._body.scrollTop = 0;

    if (activePack === "builtin") {
      extras.forEach((opt) => {
        addCell(grid, opt.value, opt.label, (cv) => {
          if (opt.value === "none") return;
          if (opt.rows && F) F.drawToCanvas(cv, F.monoFromRows(opt.rows));
          else if (opt.icon && F) F.drawToCanvas(cv, opt.icon);
          else paintRef(cv, opt.value);
        });
      });
      h._foot.textContent = extras.length + " built-in / custom";
      return;
    }

    if (extras.length && activePack === "tabler") {
      extras.forEach((opt) => {
        addCell(grid, opt.value, opt.label, (cv) => {
          if (opt.value === "none") return;
          if (opt.icon && F) F.drawToCanvas(cv, opt.icon);
          else paintRef(cv, opt.value);
        });
      });
      el("div", "icon-picker-divider", grid);
    }

    try {
      const built = await buildGridItems(h);
      h._gridState = { items: built.items, shown: 0, label: built.label };
      appendGridBatch(h);
      fillViewport(h);
      if (!built.items.length) h._foot.textContent = "No icons match";
    } catch (e) {
      h._foot.textContent =
        activePack === "fluent" ? "Fluent emoji catalog offline — use a local HTTP server" : "Catalog offline";
    }
  }

  async function fillPackSelect(packSel) {
    packSel.innerHTML = "";
    const tab = document.createElement("option");
    tab.value = "tabler";
    tab.textContent = "Tabler Icons";
    packSel.appendChild(tab);
    const flu = document.createElement("option");
    flu.value = "fluent";
    flu.textContent = "Fluent Emojis";
    packSel.appendChild(flu);
    packList = [];
    if (P) {
      try {
        const idx = await P.loadIndex();
        packList = (idx.packs || []).filter((p) => p.id !== "tabler");
        packList.forEach((p) => {
          const o = document.createElement("option");
          o.value = p.id;
          o.textContent = p.label + " (" + p.count + ")";
          packSel.appendChild(o);
        });
      } catch (e) {
        console.warn("Icon pack index unavailable", e);
        if (host && host._foot) host._foot.textContent = "Extra icon packs unavailable \u2014 only Tabler, Fluent and built-in icons are listed.";
      }
    }
    const builtin = document.createElement("option");
    builtin.value = "builtin";
    builtin.textContent = "Built-in / custom";
    packSel.appendChild(builtin);
  }

  async function open(opts) {
    opts = opts || {};
    const h = ensureHost();
    onPick = opts.onSelect || null;
    pickValue = opts.value || "none";
    h._extras = opts.extras || [];
    const opener = document.activeElement;
    if (h.hidden) {
      h.hidden = false;
      const DLG = window.LucarneDialog;
      const card = h.querySelector(".modal-card");
      if (DLG && DLG.trapFocus && card) releaseTrap = DLG.trapFocus(card, { opener, initialFocus: h._search });
    }
    h._search.value = "";
    await fillPackSelect(h._pack);
    if (opts.pack) activePack = opts.pack;
    else if (pickValue.indexOf("streamline:") === 0) activePack = "streamline";
    else if (pickValue.indexOf("glyphs:") === 0) activePack = "glyphs";
    else if (pickValue.indexOf("emoji:") === 0) activePack = "fluent";
    else if (pickValue.indexOf("tabler:") === 0) activePack = "tabler";
    else if (pickValue.indexOf("c:") === 0 || pickValue === "none") activePack = "builtin";
    else if (window.LUCARNE_ICONS && window.LUCARNE_ICONS[pickValue]) activePack = "builtin";
    else activePack = "tabler";
    h._pack.value = activePack;
    h._cat.hidden = activePack !== "tabler" && activePack !== "fluent";
    h._cat.innerHTML = "";
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "All categories";
    h._cat.appendChild(all);
    if (activePack === "fluent" && E) {
      try {
        const man = await E.ensureManifest();
        (man.categories || []).forEach((c) => {
          const o = document.createElement("option");
          o.value = c;
          o.textContent = c.charAt(0).toUpperCase() + c.slice(1);
          h._cat.appendChild(o);
        });
      } catch (e) {
        console.warn("Fluent emoji manifest unavailable", e);
        h._foot.textContent = "Emoji catalog unavailable \u2014 check your connection.";
      }
    } else if (T) {
      try {
        const cat = await T.ensureCatalog();
        if (!cat.embedded) {
          cat.categories.slice(0, 40).forEach((c) => {
            const o = document.createElement("option");
            o.value = c;
            o.textContent = c;
            h._cat.appendChild(o);
          });
        }
      } catch (e) {
        console.warn("Tabler catalog unavailable", e);
        h._foot.textContent = "Tabler categories unavailable \u2014 search still works on loaded icons.";
      }
    }
    h._cat.value = "all";
    await renderGrid();
    h._search.focus();
  }

  window.LucarneIconPicker = { open, close: closePicker };
})();
