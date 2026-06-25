(function () {
  "use strict";

  const R = window.LucarneRender;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function init(host, LE) {
    host.innerHTML = "";
    const root = el("div", "sim", host);
    const device = el("div", "sim-device", root);
    const canvas = el("canvas", "", device);
    canvas.id = "simCanvas";

    const dpad = el("div", "dpad", root);
    const bUp = el("button", "b-up", dpad);
    bUp.textContent = "\u25B2";
    const bLeft = el("button", "b-left", dpad);
    bLeft.textContent = "\u25C0";
    const bOk = el("button", "b-ok", dpad);
    bOk.textContent = "OK";
    const bRight = el("button", "b-right", dpad);
    bRight.textContent = "\u25B6";
    const bDown = el("button", "b-down", dpad);
    bDown.textContent = "\u25BC";
    const bBack = el("button", "b-back", dpad);
    bBack.textContent = "Back";

    const state = { current: null, stack: [], sel: {}, animating: false };

    function scaleFor() {
      const d = LE.dims();
      const availH = host.clientHeight - 80;
      const availW = host.clientWidth - 260;
      let s = Math.floor(Math.min(availH / d.h, availW / d.w));
      if (s < 1) s = 1;
      if (s > 6) s = 6;
      return s;
    }

    function activeMenu(screen) {
      if (!screen) return null;
      return screen.widgets.find((w) => w.type === "menu") || null;
    }

    function renderTo(disp, screen, extra) {
      R.drawScreen(disp, screen, LE.renderTheme(), LE.env(screen, state.sel, extra));
    }

    function paint(extra) {
      const d = LE.dims();
      const scale = scaleFor();
      canvas.width = d.w;
      canvas.height = d.h;
      canvas.style.width = d.w * scale + "px";
      canvas.style.height = d.h * scale + "px";
      const s = LE.getScreen(state.current);
      if (!s) return;
      const disp = new R.Display(d.w, d.h);
      renderTo(disp, s, extra);
      disp.blitTo(canvas.getContext("2d"));
      if (LE.live && LE.live.isConnected()) LE.live.sendDisplay(disp);
    }

    function resolveTrans(t) {
      if (!t || t === "Inherit") return LE.project.transition.default || "None";
      return t;
    }

    function reverse(t) {
      switch (t) {
        case "SlideLeft":
        case "Push":
          return "SlideRight";
        case "SlideRight":
          return "SlideLeft";
        case "SlideUp":
          return "SlideDown";
        case "SlideDown":
          return "SlideUp";
        default:
          return t;
      }
    }

    function animate(toId, type) {
      const d = LE.dims();
      const fromS = LE.getScreen(state.current);
      const toS = LE.getScreen(toId);
      if (!toS) return;
      if (type === "None" || !fromS) {
        state.current = toId;
        paint();
        return;
      }
      const scale = scaleFor();
      canvas.width = d.w;
      canvas.height = d.h;
      canvas.style.width = d.w * scale + "px";
      canvas.style.height = d.h * scale + "px";
      const ctx = canvas.getContext("2d");

      const A = new R.Display(d.w, d.h);
      const B = new R.Display(d.w, d.h);
      renderTo(A, fromS);
      renderTo(B, toS);
      const out = new R.Display(d.w, d.h);

      const duration = LE.project.transition.durationMs || 220;
      const start = performance.now();
      state.animating = true;

      function frame(now) {
        let p = (now - start) / duration;
        if (p > 1) p = 1;
        const e = 1 - (1 - p) * (1 - p) * (1 - p);
        R.composeFB(out.fb, A.fb, B.fb, d.w, d.h, type, e);
        out.blitTo(ctx);
        if (LE.live && LE.live.isConnected()) LE.live.sendDisplay(out);
        if (p < 1) {
          requestAnimationFrame(frame);
        } else {
          state.animating = false;
          state.current = toId;
          paint();
        }
      }
      requestAnimationFrame(frame);
    }

    function next() {
      if (state.animating) return;
      const m = activeMenu(LE.getScreen(state.current));
      if (!m || !m.items || !m.items.length) return;
      const cur = state.sel[m.id] || 0;
      state.sel[m.id] = Math.min(m.items.length - 1, cur + 1);
      paint();
    }
    function prev() {
      if (state.animating) return;
      const m = activeMenu(LE.getScreen(state.current));
      if (!m || !m.items || !m.items.length) return;
      const cur = state.sel[m.id] || 0;
      state.sel[m.id] = Math.max(0, cur - 1);
      paint();
    }
    function select() {
      if (state.animating) return;
      const m = activeMenu(LE.getScreen(state.current));
      if (!m || !m.items || !m.items.length) return;
      const it = m.items[state.sel[m.id] || 0];
      if (!it) return;
      if (it.action === "callback") {
        const id = (it.callbackId || it.label || "callback").replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
        LE.toast("Callback ACTION_" + id + " — handle in loop() with ui.pollMenuAction()");
        return;
      }
      if (it && it.target) {
        const t = resolveTrans(it.transition);
        state.stack.push({ id: state.current, trans: t });
        animate(it.target, t);
      }
    }
    function back() {
      if (state.animating) return;
      if (!state.stack.length) return;
      const e = state.stack.pop();
      animate(e.id, reverse(e.trans));
    }

    bUp.addEventListener("click", prev);
    bLeft.addEventListener("click", prev);
    bDown.addEventListener("click", next);
    bRight.addEventListener("click", next);
    bOk.addEventListener("click", select);
    bBack.addEventListener("click", back);

    function keyHandler(ev) {
      if (host.hidden) return;
      if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") prev();
      else if (ev.key === "ArrowDown" || ev.key === "ArrowRight") next();
      else if (ev.key === "Enter" || ev.key === " ") select();
      else if (ev.key === "Backspace" || ev.key === "Escape") back();
      else return;
      ev.preventDefault();
    }
    document.addEventListener("keydown", keyHandler);

    let splashTimer = null;

    function clearSplashTimer() {
      if (splashTimer) {
        clearInterval(splashTimer);
        splashTimer = null;
      }
    }

    function maybeStartSplash(screen) {
      clearSplashTimer();
      if (!screen || !screen.splash || !screen.splash.enabled) return;
      const dur = screen.splash.durationMs || 2000;
      const next = screen.splash.nextScreen;
      if (!next) return;
      const start = performance.now();
      splashTimer = setInterval(() => {
        const elapsed = performance.now() - start;
        paint({ splashElapsedMs: elapsed });
        if (elapsed >= dur) {
          clearSplashTimer();
          const t = resolveTrans("Fade");
          if (state.stack.length === 0) state.stack.push({ id: state.current, trans: t });
          animate(next, t);
        }
      }, 50);
    }

    function open() {
      state.current = LE.project.startScreen || (LE.project.screens[0] && LE.project.screens[0].id);
      state.stack = [];
      state.sel = {};
      clearSplashTimer();
      paint();
      const s = LE.getScreen(state.current);
      maybeStartSplash(s);
    }

    return { render: paint, open };
  }

  window.LucarneSimulate = { init };
})();
