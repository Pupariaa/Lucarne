(function () {
  "use strict";

  const R = window.LucarneRender;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function svgEl(tag) {
    return document.createElementNS("http://www.w3.org/2000/svg", tag);
  }

  function init(host, LE) {
    host.innerHTML = "";

    const toolbar = el("div", "graph-toolbar", host);
    const addBtn = el("button", "btn primary", toolbar);
    addBtn.textContent = "+ Screen";
    const fitBtn = el("button", "btn", toolbar);
    fitBtn.textContent = "Fit";
    const zoomLabel = el("span", "muted", toolbar);
    zoomLabel.style.marginLeft = "4px";

    const canvas = el("div", "graph-canvas", host);
    const svg = svgEl("svg");
    svg.setAttribute("class", "graph-links");
    svg.style.width = "100%";
    svg.style.height = "100%";
    canvas.appendChild(svg);
    const world = el("div", "graph-world", canvas);

    const hint = el("div", "graph-hintbar", host);
    hint.textContent =
      "Drag a screen header to move · drag an item pin to a screen to link · scroll to zoom · double-click a screen to edit";

    let scale = 1;
    let panX = 60;
    let panY = 40;

    function applyTransform() {
      world.style.transform = "translate(" + panX + "px," + panY + "px) scale(" + scale + ")";
      zoomLabel.textContent = Math.round(scale * 100) + "%";
    }

    function thumbBox(d) {
      const maxW = 144;
      const maxH = 180;
      const s = Math.min(maxW / d.w, maxH / d.h);
      return { w: Math.round(d.w * s), h: Math.round(d.h * s) };
    }

    function buildNode(screen) {
      const project = LE.project;
      const d = LE.dims();
      const node = el("div", "node", world);
      node.style.left = (screen.gx || 0) + "px";
      node.style.top = (screen.gy || 0) + "px";
      node.dataset.screen = screen.id;
      if (LE.graphSel && LE.graphSel.type === "node" && LE.graphSel.id === screen.id)
        node.classList.add("sel");

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
          if (it.target) dot.classList.add("linked");
          dot.dataset.screen = screen.id;
          dot.dataset.menu = w.id;
          dot.dataset.item = it.id;
          dot.addEventListener("pointerdown", (ev) => startLink(ev, screen.id, w.id, it.id));
        });
      });

      head.addEventListener("pointerdown", (ev) => startNodeDrag(ev, screen, node));
      node.addEventListener("pointerdown", () => selectNode(screen.id), true);
      node.addEventListener("dblclick", () => LE.openDesigner(screen.id));

      return node;
    }

    function renderThumb(cv, screen) {
      const d = LE.dims();
      const disp = new R.Display(d.w, d.h);
      R.drawScreen(disp, screen, LE.renderTheme(), LE.env(screen));
      disp.blitTo(cv.getContext("2d"));
    }

    function render() {
      world.querySelectorAll(".node").forEach((n) => n.remove());
      LE.project.screens.forEach(buildNode);
      applyTransform();
      requestAnimationFrame(redrawLinks);
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
            });
            svg.appendChild(path);
          });
        });
      });
    }

    function selectNode(id) {
      LE.graphSel = { type: "node", id };
      world.querySelectorAll(".node").forEach((n) =>
        n.classList.toggle("sel", n.dataset.screen === id)
      );
      LE.refreshDock();
    }

    function startNodeDrag(ev, screen, node) {
      ev.stopPropagation();
      ev.preventDefault();
      selectNode(screen.id);
      const sx = ev.clientX;
      const sy = ev.clientY;
      const ox = screen.gx || 0;
      const oy = screen.gy || 0;
      function move(e) {
        screen.gx = ox + (e.clientX - sx) / scale;
        screen.gy = oy + (e.clientY - sy) / scale;
        node.style.left = screen.gx + "px";
        node.style.top = screen.gy + "px";
        redrawLinks();
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        LE.autosave();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
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
          LE.markDirty();
        } else if (item && (!nodeEl || nodeEl.dataset.screen === screenId)) {
          // dropped on empty space over same node: no-op
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
      if (ev.target !== canvas && ev.target !== svg && !ev.target.classList.contains("graph-world"))
        return;
      LE.graphSel = null;
      world.querySelectorAll(".node.sel").forEach((n) => n.classList.remove("sel"));
      LE.refreshDock();
      redrawLinks();
      canvas.classList.add("panning");
      const sx = ev.clientX;
      const sy = ev.clientY;
      const ox = panX;
      const oy = panY;
      function move(e) {
        panX = ox + (e.clientX - sx);
        panY = oy + (e.clientY - sy);
        applyTransform();
        redrawLinks();
      }
      function up() {
        canvas.classList.remove("panning");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });

    canvas.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const c = canvas.getBoundingClientRect();
        const mx = ev.clientX - c.left;
        const my = ev.clientY - c.top;
        const wx = (mx - panX) / scale;
        const wy = (my - panY) / scale;
        const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
        scale = Math.min(2.5, Math.max(0.3, scale * factor));
        panX = mx - wx * scale;
        panY = my - wy * scale;
        applyTransform();
        redrawLinks();
      },
      { passive: false }
    );

    function fit() {
      const screens = LE.project.screens;
      if (!screens.length) return;
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
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const sx = cw / (maxx - minx + 80);
      const sy = ch / (maxy - miny + 80);
      scale = Math.min(1.3, Math.max(0.3, Math.min(sx, sy)));
      panX = (cw - (maxx - minx) * scale) / 2 - minx * scale;
      panY = (ch - (maxy - miny) * scale) / 2 - miny * scale;
      applyTransform();
      redrawLinks();
    }

    addBtn.addEventListener("click", () => LE.addScreen());
    fitBtn.addEventListener("click", fit);

    applyTransform();

    return { render, fit, redrawLinks };
  }

  window.LucarneGraph = { init };
})();
