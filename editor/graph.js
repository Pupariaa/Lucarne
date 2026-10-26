(function () {
  "use strict";

  const R = window.LucarneRender;
  const S = window.LucarneState;
  const CB = window.LucarneClipboard;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function svgEl(tag) {
    return document.createElementNS("http://www.w3.org/2000/svg", tag);
  }

  const MIN_SCALE = 0.3;
  const MAX_SCALE = 2.5;

  function init(host, LE) {
    host.innerHTML = "";
    const UI = window.LucarneUiIcons;

    function iconBtn(cls, icon, label, parent) {
      const b = el("button", "btn " + cls, parent);
      b.type = "button";
      b.title = label;
      b.setAttribute("aria-label", label);
      if (UI) b.innerHTML = UI.svg(icon, { size: 15 });
      return b;
    }

    const toolbar = el("div", "graph-toolbar", host);
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Blueprint tools");
    const addBtn = el("button", "btn primary graph-add", toolbar);
    addBtn.type = "button";
    addBtn.title = "Add a new screen";
    addBtn.innerHTML = (UI ? UI.svg("plus", { size: 14 }) : "+") + "<span>Screen</span>";
    const zoomGroup = el("div", "graph-zoom", toolbar);
    const zoomOutBtn = iconBtn("icon", "minus", "Zoom out", zoomGroup);
    const zoomLabel = el("span", "graph-zoom-label", zoomGroup);
    const zoomInBtn = iconBtn("icon", "plus", "Zoom in", zoomGroup);
    const fitBtn = iconBtn("icon", "fit", "Fit all screens in view", zoomGroup);

    const canvas = el("div", "graph-canvas", host);
    const svg = svgEl("svg");
    svg.setAttribute("class", "graph-links");
    canvas.appendChild(svg);
    const world = el("div", "graph-world", canvas);

    const hint = el("div", "graph-hintbar", host);
    const coarseMq = window.matchMedia("(pointer: coarse)");
    function syncHint() {
      hint.textContent = coarseMq.matches
        ? "Drag a screen header to move · drag an item pin onto a screen to link · pinch to zoom · Edit screen from the inspector"
        : "Drag a screen header to move · drag an item pin onto a screen to link · scroll to zoom · double-click a screen to edit";
    }
    syncHint();
    coarseMq.addEventListener("change", syncHint);

    let scale = 1;
    let panX = 60;
    let panY = 40;
    let userView = false;
    let fittedOnce = false;
    let pinch = null;

    function applyTransform() {
      world.style.transform = "translate(" + panX + "px," + panY + "px) scale(" + scale + ")";
      zoomLabel.textContent = Math.round(scale * 100) + "%";
      zoomOutBtn.disabled = scale <= MIN_SCALE + 0.001;
      zoomInBtn.disabled = scale >= MAX_SCALE - 0.001;
    }

    function thumbBox(d) {
      const maxW = 144;
      const maxH = 180;
      const s = Math.min(maxW / d.w, maxH / d.h);
      return { w: Math.round(d.w * s), h: Math.round(d.h * s) };
    }

    let pendingReveal = false;
    let nodeMoved = false;

    function buildNode(screen) {
      const project = LE.project;
      const d = LE.dims();
      const node = el("div", "node", world);
      node.style.left = (screen.gx || 0) + "px";
      node.style.top = (screen.gy || 0) + "px";
      node.dataset.screen = screen.id;
      node.tabIndex = 0;
      node.setAttribute("role", "button");
      node.setAttribute(
        "aria-label",
        "Screen " + (screen.name || screen.id) + (project.startScreen === screen.id ? ", start screen" : "") + ". Enter to edit."
      );
      const isSel = LE.graphSel && LE.graphSel.type === "node" && LE.graphSel.id === screen.id;
      if (isSel) node.classList.add("sel");
      node.setAttribute("aria-pressed", String(!!isSel));

      const port = el("div", "node-port-in", node);
      port.dataset.screen = screen.id;

      const head = el("div", "node-head", node);
      const title = el("div", "node-title", head);
      title.textContent = screen.name || screen.id;
      if (project.startScreen === screen.id) {
        const badge = el("span", "node-start", head);
        badge.textContent = "start";
      }
      if (screen.splash && screen.splash.enabled) {
        const sb = el("span", "node-splash", head);
        sb.textContent = "splash";
      }

      const box = thumbBox(d);
      const cv = el("canvas", "node-thumb", node);
      cv.width = d.w;
      cv.height = d.h;
      cv.style.width = box.w + "px";
      cv.style.height = box.h + "px";
      cv.setAttribute("aria-hidden", "true");
      renderThumb(cv, screen);

      const pins = el("div", "node-pins", node);
      screen.widgets.forEach((w) => {
        if (w.type !== "menu") return;
        (w.items || []).forEach((it) => {
          if (it.action === "callback") return;
          const pin = el("div", "pin", pins);
          const lbl = el("span", "pin-label", pin);
          lbl.textContent = it.label || "(item)";
          const dot = el("div", "pin-dot", pin);
          dot.title = "Drag onto a screen to link this item";
          if (it.target) dot.classList.add("linked");
          dot.dataset.screen = screen.id;
          dot.dataset.menu = w.id;
          dot.dataset.item = it.id;
          dot.addEventListener("pointerdown", (ev) => startLink(ev, screen.id, w.id, it.id));
        });
      });

      head.addEventListener("pointerdown", (ev) => startNodeDrag(ev, screen, node));
      node.addEventListener(
        "pointerdown",
        () => {
          const was = LE.graphSel && LE.graphSel.type === "node" && LE.graphSel.id === screen.id;
          pendingReveal = !was;
          nodeMoved = false;
          selectNode(screen.id);
        },
        true
      );
      node.addEventListener("click", () => {
        if (pendingReveal && !nodeMoved && LE.revealInspector) LE.revealInspector();
        pendingReveal = false;
      });
      node.addEventListener("dblclick", () => LE.openDesigner(screen.id));
      node.addEventListener("focus", () => {
        if (!(LE.graphSel && LE.graphSel.type === "node" && LE.graphSel.id === screen.id)) selectNode(screen.id);
      });
      node.addEventListener("keydown", (ev) => {
        if (ev.target !== node) return;
        if (ev.key === "Enter") {
          ev.preventDefault();
          LE.openDesigner(screen.id);
        }
      });

      return node;
    }

    function renderThumb(cv, screen) {
      const d = LE.dims();
      const disp = new R.Display(d.w, d.h);
      R.drawScreen(disp, screen, LE.renderTheme(), LE.env(screen));
      R.blitDisplayToCanvas(disp, cv.getContext("2d"), LE.project);
    }

    function render() {
      const focusedId = document.activeElement && document.activeElement.classList.contains("node") ? document.activeElement.dataset.screen : null;
      world.querySelectorAll(".node").forEach((n) => n.remove());
      LE.project.screens.forEach(buildNode);
      if (!userView && !fittedOnce && canvas.clientWidth > 0) {
        fittedOnce = true;
        fit(true);
      } else {
        applyTransform();
        requestAnimationFrame(redrawLinks);
      }
      if (focusedId) {
        const again = world.querySelector('.node[data-screen="' + focusedId + '"]');
        if (again) again.focus({ preventScroll: true });
      }
    }

    function centerOf(elm) {
      const r = elm.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
    }

    function redrawLinks() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const project = LE.project;
      project.screens.forEach((s) => {
        s.widgets.forEach((w) => {
          if (w.type !== "menu") return;
          (w.items || []).forEach((it) => {
            if (!it.target) return;
            const dot = canvas.querySelector('.pin-dot[data-item="' + it.id + '"]');
            const port = canvas.querySelector('.node-port-in[data-screen="' + it.target + '"]');
            if (!dot || !port) return;
            const a = centerOf(dot);
            const b = centerOf(port);
            const path = svgEl("path");
            const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
            path.setAttribute(
              "d",
              "M " + a.x + " " + a.y + " C " + (a.x + dx) + " " + a.y + " " + (b.x - dx) + " " + b.y + " " + b.x + " " + b.y
            );
            path.setAttribute("class", "glink");
            const isSel =
              LE.graphSel &&
              LE.graphSel.type === "link" &&
              LE.graphSel.menu === w.id &&
              LE.graphSel.item === it.id;
            if (isSel) path.classList.add("sel");
            path.addEventListener("click", (ev) => {
              ev.stopPropagation();
              LE.graphSel = { type: "link", screen: s.id, menu: w.id, item: it.id };
              LE.refreshDock();
              redrawLinks();
              if (LE.revealInspector) LE.revealInspector();
            });
            svg.appendChild(path);
          });
        });
      });
    }

    function selectNode(id) {
      LE.graphSel = { type: "node", id };
      world.querySelectorAll(".node").forEach((n) => {
        const on = n.dataset.screen === id;
        n.classList.toggle("sel", on);
        n.setAttribute("aria-pressed", String(on));
      });
      LE.refreshDock();
    }

    function startNodeDrag(ev, screen, node) {
      ev.stopPropagation();
      ev.preventDefault();
      const sx = ev.clientX;
      const sy = ev.clientY;
      const ox = screen.gx || 0;
      const oy = screen.gy || 0;
      function move(e) {
        if (pinch) return;
        if (!nodeMoved && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 3) return;
        nodeMoved = true;
        screen.gx = ox + (e.clientX - sx) / scale;
        screen.gy = oy + (e.clientY - sy) / scale;
        node.style.left = screen.gx + "px";
        node.style.top = screen.gy + "px";
        redrawLinks();
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        if (nodeMoved) LE.markDirty("Move screen");
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    }

    let tempPath = null;
    function startLink(ev, screenId, menuId, itemId) {
      ev.stopPropagation();
      ev.preventDefault();
      const dot = ev.currentTarget;
      const a = centerOf(dot);
      tempPath = svgEl("path");
      tempPath.setAttribute("class", "glink glink-temp");
      svg.appendChild(tempPath);

      function move(e) {
        const c = canvas.getBoundingClientRect();
        const bx = e.clientX - c.left;
        const by = e.clientY - c.top;
        const dx = Math.max(40, Math.abs(bx - a.x) * 0.5);
        tempPath.setAttribute(
          "d",
          "M " + a.x + " " + a.y + " C " + (a.x + dx) + " " + a.y + " " + (bx - dx) + " " + by + " " + bx + " " + by
        );
      }
      function up(e) {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (tempPath) {
          svg.removeChild(tempPath);
          tempPath = null;
        }
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const nodeEl = target ? target.closest(".node") : null;
        const item = findItem(screenId, menuId, itemId);
        if (item && nodeEl && nodeEl.dataset.screen !== screenId) {
          item.target = nodeEl.dataset.screen;
          LE.markDirty("Link menu item");
        }
        render();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    }

    function findItem(screenId, menuId, itemId) {
      const s = LE.getScreen(screenId);
      if (!s) return null;
      const m = s.widgets.find((w) => w.id === menuId);
      if (!m) return null;
      return (m.items || []).find((i) => i.id === itemId) || null;
    }

    canvas.addEventListener("pointerdown", (ev) => {
      if (ev.target !== canvas && ev.target !== svg && !ev.target.classList.contains("graph-world")) return;
      if (LE.graphSel) {
        LE.graphSel = null;
        world.querySelectorAll(".node.sel").forEach((n) => {
          n.classList.remove("sel");
          n.setAttribute("aria-pressed", "false");
        });
        LE.refreshDock();
        redrawLinks();
      }
      canvas.classList.add("panning");
      const sx = ev.clientX;
      const sy = ev.clientY;
      const ox = panX;
      const oy = panY;
      function move(e) {
        if (pinch) return;
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 2) userView = true;
        panX = ox + (e.clientX - sx);
        panY = oy + (e.clientY - sy);
        applyTransform();
        redrawLinks();
      }
      function up() {
        canvas.classList.remove("panning");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    });

    function zoomAt(mx, my, nextScale) {
      const wx = (mx - panX) / scale;
      const wy = (my - panY) / scale;
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      panX = mx - wx * scale;
      panY = my - wy * scale;
      userView = true;
      applyTransform();
      redrawLinks();
    }

    function zoomCenter(factor) {
      zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, scale * factor);
    }

    canvas.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const c = canvas.getBoundingClientRect();
        const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
        zoomAt(ev.clientX - c.left, ev.clientY - c.top, scale * factor);
      },
      { passive: false }
    );

    const touches = new Map();
    function pinchInfo() {
      const pts = Array.from(touches.values());
      const c = canvas.getBoundingClientRect();
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      return {
        dist: Math.max(1, Math.hypot(dx, dy)),
        mx: (pts[0].x + pts[1].x) / 2 - c.left,
        my: (pts[0].y + pts[1].y) / 2 - c.top,
      };
    }
    canvas.addEventListener(
      "pointerdown",
      (ev) => {
        if (ev.pointerType !== "touch") return;
        touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (touches.size === 2) {
          const p = pinchInfo();
          pinch = { dist: p.dist, wx: (p.mx - panX) / scale, wy: (p.my - panY) / scale, scale };
          canvas.classList.remove("panning");
        }
      },
      true
    );
    function onTouchMove(ev) {
      if (!touches.has(ev.pointerId)) return;
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (!pinch || touches.size < 2) return;
      const p = pinchInfo();
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.scale * (p.dist / pinch.dist)));
      panX = p.mx - pinch.wx * scale;
      panY = p.my - pinch.wy * scale;
      userView = true;
      applyTransform();
      redrawLinks();
    }
    function onTouchEnd(ev) {
      if (!touches.has(ev.pointerId)) return;
      touches.delete(ev.pointerId);
      if (touches.size < 2) pinch = null;
    }
    window.addEventListener("pointermove", onTouchMove);
    window.addEventListener("pointerup", onTouchEnd);
    window.addEventListener("pointercancel", onTouchEnd);

    function fit(auto) {
      const screens = LE.project.screens;
      if (!screens.length) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (!cw || !ch) return;
      let minx = Infinity,
        miny = Infinity,
        maxx = -Infinity,
        maxy = -Infinity;
      screens.forEach((s) => {
        minx = Math.min(minx, s.gx || 0);
        miny = Math.min(miny, s.gy || 0);
        maxx = Math.max(maxx, (s.gx || 0) + 180);
        maxy = Math.max(maxy, (s.gy || 0) + 320);
      });
      const sx = cw / (maxx - minx + 80);
      const sy = (ch - 60) / (maxy - miny + 80);
      scale = Math.min(1.3, Math.max(MIN_SCALE, Math.min(sx, sy)));
      panX = (cw - (maxx - minx) * scale) / 2 - minx * scale;
      panY = (ch - (maxy - miny) * scale) / 2 - miny * scale;
      if (auto !== true) userView = false;
      applyTransform();
      requestAnimationFrame(redrawLinks);
    }

    function resetView() {
      userView = false;
      fittedOnce = false;
    }

    if (typeof ResizeObserver !== "undefined") {
      let lastW = 0;
      let lastH = 0;
      const ro = new ResizeObserver(() => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h || (w === lastW && h === lastH)) return;
        lastW = w;
        lastH = h;
        if (host.hidden) return;
        if (!userView) {
          fittedOnce = true;
          fit(true);
        } else {
          redrawLinks();
        }
      });
      ro.observe(canvas);
    }

    function selectedScreen() {
      if (!LE.graphSel || LE.graphSel.type !== "node") return null;
      return LE.getScreen(LE.graphSel.id);
    }

    function copyScreenSelection() {
      const s = selectedScreen();
      if (s && CB) {
        CB.setScreen(s);
        LE.toast("Screen copied", { type: "info", duration: 1600 });
      }
    }

    function pasteScreenClipboard() {
      if (!CB || !CB.hasScreen()) return;
      const data = CB.getScreen();
      const copy = JSON.parse(JSON.stringify(data));
      copy.id = LE.genId("scr");
      copy.name = (data.name || data.id) + " copy";
      copy.gx = (data.gx || 0) + 40;
      copy.gy = (data.gy || 0) + 30;
      copy.widgets = (data.widgets || []).map((w) => S.cloneWidgetData(w));
      LE.project.screens.push(copy);
      LE.graphSel = { type: "node", id: copy.id };
      LE.markDirty("Paste screen");
      LE.refreshDock();
      render();
    }

    function deleteScreenSelection() {
      const s = selectedScreen();
      if (!s) return;
      if (LE.project.screens.length <= 1) {
        LE.toast("Keep at least one screen", { type: "warn" });
        return;
      }
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
      LE.markDirty("Delete screen");
      LE.refreshDock();
      render();
      LE.toast("Screen \u201c" + (s.name || s.id) + "\u201d deleted", {
        type: "info",
        action: { label: "Undo", run: () => LE.undo() },
      });
    }

    document.addEventListener("keydown", (ev) => {
      if (host.hidden) return;
      const tag = (ev.target && ev.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (document.querySelector(".modal:not([hidden])") || document.querySelector(".tour-root")) return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "c") {
        if (!selectedScreen()) return;
        ev.preventDefault();
        copyScreenSelection();
      } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "v") {
        ev.preventDefault();
        pasteScreenClipboard();
      } else if (ev.key === "Delete" || ev.key === "Backspace") {
        if (LE.graphSel && LE.graphSel.type === "node") {
          ev.preventDefault();
          deleteScreenSelection();
        }
      } else if ((ev.key === "+" || ev.key === "=") && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        zoomCenter(1.2);
      } else if (ev.key === "-" && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        zoomCenter(1 / 1.2);
      } else if ((ev.key === "f" || ev.key === "F") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        fit();
      }
    });

    addBtn.addEventListener("click", () => LE.addScreen());
    fitBtn.addEventListener("click", () => fit());
    zoomInBtn.addEventListener("click", () => zoomCenter(1.2));
    zoomOutBtn.addEventListener("click", () => zoomCenter(1 / 1.2));

    applyTransform();

    return { render, fit: () => fit(), redrawLinks, resetView };
  }

  window.LucarneGraph = { init };
})();
