(function () {
  "use strict";

  const STORAGE_KEY = "lucarne_tour_v1";
  const PAD = 8;

  let root = null;
  let spotlight = null;
  let bubble = null;
  let LE = null;
  let index = 0;
  let onLayout = null;
  let onKey = null;

  const STEPS = [
    {
      title: "Three modes",
      text: "Blueprint maps screens and links. Designer lays out widgets. Simulate runs the UI with the D-pad.",
      selector: ".modeTabs",
    },
    {
      title: "Blueprint",
      text: "Pan and zoom the graph. Select a screen in the inspector and use Edit screen to open the Designer.",
      selector: ".graph-toolbar, #graphHost",
      pick: (nodes) => nodes.find((n) => n.classList && n.classList.contains("graph-toolbar")) || nodes[0],
    },
    {
      title: "Inspector",
      text: "Project, screen, widget and link settings live here. On tablet widths it opens as a drawer from the panel button.",
      selector: "#dock",
      prepare: (ctx) => ctx.revealInspector && ctx.revealInspector(),
    },
    {
      title: "Designer",
      text: "Pick widgets from the palette, place them on the canvas, and reorder layers on the right.",
      selector: "#designerCanvas, .palette",
      prepare: (ctx) => ctx.setMode && ctx.setMode("designer"),
      pick: (nodes) => nodes.find((n) => n.id === "designerCanvas") || nodes[0],
    },
    {
      title: "Simulate",
      text: "Drive the UI with the on-screen D-pad or the same keys as on-device buttons.",
      selector: ".dpad, #simHost",
      prepare: (ctx) => ctx.setMode && ctx.setMode("simulate"),
      pick: (nodes) => nodes.find((n) => n.classList && n.classList.contains("dpad")) || nodes[0],
    },
    {
      title: "Memory bar",
      text: "Flash, library and asset estimates update as you edit. Watch this before exporting to a small partition.",
      selector: "#memoryBar",
    },
    {
      title: "Project settings",
      text: "Theme, fonts, hardware, assets and data keys are grouped in one place.",
      selector: "#btnProjectSettings",
    },
    {
      title: "Live preview",
      text: "Connect over USB serial to push UI changes to hardware already running the Lucarne receiver sketch.",
      selector: "#btnLive",
    },
    {
      title: "Export",
      text: "Generate the Arduino sketch, headers and optional SD or volume asset files.",
      selector: "#btnExport",
    },
    {
      title: "History",
      text: "Every edit is labeled here. Jump back to any step or use Undo and Redo in the toolbar.",
      selector: "#historyBar",
    },
  ];

  function markSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: true }));
    } catch (e) {
      console.warn("Tour preference not saved", e);
    }
  }

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function isVisible(node) {
    if (!node || !node.isConnected) return false;
    if (node.closest("[hidden], [inert]")) return false;
    const r = node.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function queryTargets(step) {
    const parts = step.selector.split(",").map((s) => s.trim());
    const nodes = [];
    parts.forEach((sel) => {
      const n = document.querySelector(sel);
      if (n) nodes.push(n);
    });
    if (step.pick) return step.pick(nodes);
    return nodes.find(isVisible) || nodes[0] || null;
  }

  function openMoreIfNeeded(node) {
    const panel = document.getElementById("moreMenuPanel");
    const btn = document.getElementById("btnMoreMenu");
    if (!panel || !btn || panel.hidden) return;
    if (node && panel.contains(node)) btn.click();
    else if (!isVisible(node) && btn.offsetParent) btn.click();
  }

  function resolveTarget(step) {
    if (step.prepare && LE) step.prepare(LE);
    let node = queryTargets(step);
    if (isVisible(node)) return node;
    openMoreIfNeeded(node);
    node = queryTargets(step);
    if (isVisible(node)) return node;
    if (step.selector.indexOf("#dock") >= 0 && LE && LE.revealInspector) {
      LE.revealInspector();
      node = queryTargets(step);
    }
    return isVisible(node) ? node : null;
  }

  function placeSpotlight(target) {
    if (!spotlight) return;
    if (!target) {
      spotlight.hidden = true;
      return;
    }
    spotlight.hidden = false;
    const r = target.getBoundingClientRect();
    const top = Math.max(0, r.top - PAD);
    const left = Math.max(0, r.left - PAD);
    const w = r.width + PAD * 2;
    const h = r.height + PAD * 2;
    spotlight.style.top = top + "px";
    spotlight.style.left = left + "px";
    spotlight.style.width = w + "px";
    spotlight.style.height = h + "px";
    target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  }

  function placeBubble(target, step) {
    if (!bubble) return;
    bubble.querySelector(".tour-title").textContent = step.title;
    bubble.querySelector(".tour-text").textContent = step.text;
    bubble.querySelector(".tour-progress").textContent = index + 1 + " / " + STEPS.length;
    const back = bubble.querySelector(".tour-back");
    back.disabled = index <= 0;
    const next = bubble.querySelector(".tour-next");
    next.textContent = index >= STEPS.length - 1 ? "Done" : "Next";
    if (!target) {
      bubble.classList.add("tour-bubble-center");
      bubble.style.top = "50%";
      bubble.style.left = "50%";
      bubble.style.right = "auto";
      bubble.style.bottom = "auto";
      bubble.style.transform = "translate(-50%, -50%)";
      return;
    }
    bubble.classList.remove("tour-bubble-center");
    bubble.style.transform = "";
    const margin = 12;
    const br = bubble.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    let top = tr.bottom + margin;
    let left = tr.left;
    if (top + br.height > window.innerHeight - margin) {
      top = tr.top - br.height - margin;
    }
    if (top < margin) top = margin;
    if (left + br.width > window.innerWidth - margin) {
      left = window.innerWidth - br.width - margin;
    }
    if (left < margin) left = margin;
    bubble.style.top = top + "px";
    bubble.style.left = left + "px";
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
  }

  function renderStep() {
    const step = STEPS[index];
    const target = resolveTarget(step);
    placeSpotlight(target);
    requestAnimationFrame(() => placeBubble(target, step));
  }

  function next() {
    if (index >= STEPS.length - 1) {
      markSeen();
      stop();
      return;
    }
    index += 1;
    renderStep();
  }

  function back() {
    if (index <= 0) return;
    index -= 1;
    renderStep();
  }

  function ensureRoot() {
    if (root) return root;
    root = el("div", "tour-root", document.body);
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Studio tour");
    spotlight = el("div", "tour-spotlight", root);
    spotlight.setAttribute("aria-hidden", "true");
    bubble = el("div", "tour-bubble", root);
    el("div", "tour-progress muted", bubble);
    el("h2", "tour-title lc-dialog-title", bubble);
    el("p", "tour-text hint", bubble);
    const actions = el("div", "tour-actions", bubble);
    const skip = el("button", "btn ghost tour-skip", actions);
    skip.textContent = "Skip tour";
    skip.addEventListener("click", () => {
      markSeen();
      stop();
    });
    const backBtn = el("button", "btn tour-back", actions);
    backBtn.textContent = "Back";
    backBtn.addEventListener("click", back);
    const nextBtn = el("button", "btn primary tour-next", actions);
    nextBtn.textContent = "Next";
    nextBtn.addEventListener("click", next);
    return root;
  }

  function stop() {
    if (onLayout) {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
      onLayout = null;
    }
    if (onKey) {
      document.removeEventListener("keydown", onKey, true);
      onKey = null;
    }
    if (root) {
      root.remove();
      root = null;
      spotlight = null;
      bubble = null;
    }
    LE = null;
    index = 0;
  }

  function start(ctx) {
    if (!ctx) return;
    stop();
    LE = ctx;
    index = 0;
    ensureRoot();
    onLayout = () => renderStep();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    onKey = (ev) => {
      if (!root) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        markSeen();
        stop();
      } else if (ev.key === "ArrowRight") {
        ev.preventDefault();
        next();
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        back();
      }
    };
    document.addEventListener("keydown", onKey, true);
    renderStep();
    bubble.querySelector(".tour-next").focus();
  }

  window.LucarneTour = { start, stop };
})();
