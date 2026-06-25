(function () {
  "use strict";

  const T = window.LucarneTabler;
  const P = window.LucarneIconPacks;
  const R = window.LucarneRender;
  const F = window.LucarneIconFmt;

  let host = null;
  let onPick = null;
  let pickValue = "";
  let packList = [];
  let activePack = "tabler";

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function ensureHost() {
    if (host) return host;
    host = el("div", "icon-picker modal", document.body);
    host.hidden = true;
    const card = el("div", "icon-picker-card modal-card", host);
    const head = el("div", "icon-picker-head modal-head", card);
    const title = el("span", "icon-picker-title", head);
    title.textContent = "Icons";
    const close = el("button", "btn ghost", head);
    close.textContent = "Close";
    close.addEventListener("click", () => closePicker());
    const toolbar = el("div", "icon-picker-toolbar", card);
    const packSel = el("select", "select icon-picker-pack", toolbar);
    const search = el("input", "field icon-picker-search", toolbar);
    search.type = "search";
    search.placeholder = "Search icons…";
    const catSel = el("select", "select icon-picker-cat", toolbar);
    catSel.hidden = true;
    const body = el("div", "icon-picker-body", card);
    const grid = el("div", "icon-picker-grid", body);
    const foot = el("div", "icon-picker-foot muted", card);
    foot.textContent = "";
    host._pack = packSel;
    host._search = search;
    host._cat = catSel;
    host._grid = grid;
    host._foot = foot;
    packSel.addEventListener("change", () => {
      activePack = packSel.value;
      host._cat.hidden = activePack !== "tabler" || (T && T._embedded);
      renderGrid();
    });
    search.addEventListener("input", () => renderGrid());
    catSel.addEventListener("change", () => renderGrid());
    host.addEventListener("click", (ev) => {
      if (ev.target === host) closePicker();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && host && !host.hidden) closePicker();
    });
    return host;
  }

  function closePicker() {
    if (!host) return;
    host.hidden = true;
    onPick = null;
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
    const ic = R.resolveIcon(ref, { customIconAtlas: () => null });
    if (F) F.drawToCanvas(cv, ic);
  }

  function addEmbeddedCells(grid, packId, names) {
    names.forEach((name) => {
      const meta = packList.find((p) => p.id === packId);
      const ref = (meta ? meta.refPrefix : packId + ":") + name;
      const cell = el("button", "icon-picker-cell", grid);
      if (ref === pickValue) cell.classList.add("sel");
      const cv = el("canvas", "icon-picker-cv", cell);
      cv.width = 32;
      cv.height = 32;
      const lbl = el("span", "icon-picker-lbl", cell);
      lbl.textContent = name;
      const ic = P.getIcon(ref);
      if (ic && F) F.drawToCanvas(cv, ic);
      else if (P) {
        P.loadIconFile(packId, name)
          .then((icon) => F.drawToCanvas(cv, icon))
          .catch(() => {});
      }
      cell.addEventListener("click", async () => {
        try {
          if (P) await P.loadIconFile(packId, name);
          if (onPick) onPick(ref);
          closePicker();
        } catch (e) {}
      });
      grid.appendChild(cell);
    });
  }

  async function renderGrid() {
    const h = ensureHost();
    const grid = h._grid;
    const search = h._search;
    const catSel = h._cat;
    grid.innerHTML = "";
    const extras = h._extras || [];

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

    if (activePack === "tabler" && T) {
      try {
        const cat = await T.ensureCatalog();
        const embedded = !!cat.embedded;
        const names = embedded
          ? P.searchPack(await P.loadManifest("tabler"), search.value, 150)
          : T.searchIcons(search.value, catSel.value, 150);
        h._foot.textContent = names.length + " icons · Tabler" + (embedded ? " (embedded)" : " (online)");
        if (embedded) {
          addEmbeddedCells(grid, "tabler", names);
        } else {
          names.forEach((name) => {
            const ref = T.tablerRef(name);
            const cell = el("button", "icon-picker-cell", grid);
            if (ref === pickValue) cell.classList.add("sel");
            const img = el("img", "icon-picker-svg", cell);
            img.src = T.svgUrl(name);
            img.alt = "";
            img.loading = "lazy";
            const lbl = el("span", "icon-picker-lbl", cell);
            lbl.textContent = name;
            cell.addEventListener("click", async () => {
              try {
                await T.ensureIcon(name);
                if (onPick) onPick(ref);
                closePicker();
              } catch (e) {}
            });
          });
        }
      } catch (e) {
        h._foot.textContent = "Tabler catalog offline";
      }
      return;
    }

    const meta = packList.find((p) => p.id === activePack);
    if (!meta || !P) {
      h._foot.textContent = "Pack unavailable";
      return;
    }
    try {
      const manifest = await P.loadManifest(meta.id);
      const names = P.searchPack(manifest, search.value, 150);
      h._foot.textContent = names.length + " / " + manifest.count + " · " + manifest.label;
      addEmbeddedCells(grid, meta.id, names);
    } catch (e) {
      h._foot.textContent = "Failed to load " + meta.label;
    }
  }

  async function fillPackSelect(packSel) {
    packSel.innerHTML = "";
    const tab = document.createElement("option");
    tab.value = "tabler";
    tab.textContent = "Tabler Icons";
    packSel.appendChild(tab);
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
      } catch (e) {}
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
    h.hidden = false;
    h._search.value = "";
    await fillPackSelect(h._pack);
    if (opts.pack) activePack = opts.pack;
    else if (pickValue.indexOf("streamline:") === 0) activePack = "streamline";
    else if (pickValue.indexOf("glyphs:") === 0) activePack = "glyphs";
    else if (pickValue.indexOf("tabler:") === 0) activePack = "tabler";
    else if (pickValue.indexOf("c:") === 0 || pickValue === "none") activePack = "builtin";
    else if (window.LUCARNE_ICONS && window.LUCARNE_ICONS[pickValue]) activePack = "builtin";
    else activePack = "tabler";
    h._pack.value = activePack;
    h._cat.hidden = activePack !== "tabler";
    h._cat.innerHTML = "";
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "All categories";
    h._cat.appendChild(all);
    if (T) {
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
      } catch (e) {}
    }
    h._cat.value = "all";
    await renderGrid();
    h._search.focus();
  }

  window.LucarneIconPicker = { open, close: closePicker };
})();
