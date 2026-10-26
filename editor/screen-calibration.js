(function () {
  "use strict";

  const STORAGE_KEY = "lucarne_screen_calibration_px_per_inch";
  const DEFAULT_PX_PER_INCH = 96;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function get() {
    try {
      const raw = parseFloat(localStorage.getItem(STORAGE_KEY));
      if (raw && raw > 20 && raw < 2000) return raw;
    } catch (e) {}
    return DEFAULT_PX_PER_INCH;
  }

  function isCalibrated() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch (e) {
      return false;
    }
  }

  function set(pxPerInch) {
    try {
      localStorage.setItem(STORAGE_KEY, String(pxPerInch));
    } catch (e) {}
  }

  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  // Reference objects with a precisely known physical width, so the user can
  // hold one up to the screen instead of needing an actual ruler.
  const REFERENCES = [
    { id: "card", label: "Bank / credit card (ID-1) \u2014 85.60 mm wide", mm: 85.6 },
    { id: "a4", label: "A4 paper, short edge \u2014 210 mm wide", mm: 210 },
    { id: "letter", label: "US Letter, short edge \u2014 215.9 mm wide", mm: 215.9 },
    { id: "custom", label: "Custom \u2014 enter a length I can measure", mm: null },
  ];

  function openCalibrator(opts) {
    opts = opts || {};
    const DLG = window.LucarneDialog;
    if (!DLG) return;

    let refId = "card";
    let customMm = 100;
    // Start the bar from the current calibration guess so the drag only has
    // to make a small correction rather than starting from nothing.
    let pxPerInch = get();

    function refMm() {
      const ref = REFERENCES.find((r) => r.id === refId);
      return ref.id === "custom" ? customMm : ref.mm;
    }

    function barWidthPx() {
      return (pxPerInch * refMm()) / 25.4;
    }

    DLG.open({
      title: "Calibrate screen size",
      size: "md",
      render: (body, ctx) => render(body, ctx),
    });

    function render(body, ctx) {
      body.innerHTML = "";

      const intro = el("p", "hint", body);
      intro.textContent =
        "Browsers deliberately hide your monitor's real pixel density (it's considered a fingerprinting risk), so \u201cRealistic 1:1\u201d has to guess. Hold a real object of known size against the screen and drag the bar below until it matches exactly \u2014 Studio remembers this for every project on this browser.";

      const row1 = el("div", "row", body);
      const lbl1 = el("label", "row-label", row1);
      lbl1.textContent = "Reference object";
      const sel = document.createElement("select");
      sel.className = "field";
      REFERENCES.forEach((r) => {
        const o = document.createElement("option");
        o.value = r.id;
        o.textContent = r.label;
        sel.appendChild(o);
      });
      sel.value = refId;
      row1.appendChild(sel);

      const customRow = el("div", "row", body);
      const customLbl = el("label", "row-label", customRow);
      customLbl.textContent = "Length (mm)";
      const customInput = document.createElement("input");
      customInput.type = "number";
      customInput.className = "field";
      customInput.min = "5";
      customInput.max = "500";
      customInput.step = "0.1";
      customInput.value = String(customMm);
      customRow.appendChild(customInput);
      customRow.hidden = refId !== "custom";

      const barWrap = el("div", "calib-bar-wrap", body);
      const bar = el("div", "calib-bar", barWrap);
      const grip = el("div", "calib-bar-grip", bar);
      const readout = el("div", "calib-readout", body);

      const dprHint = el("div", "hint", body);
      dprHint.textContent = "This browser reports a device pixel ratio of " + window.devicePixelRatio + ".";

      function syncBar() {
        bar.style.width = Math.max(20, barWidthPx()) + "px";
        const inches = refMm() / 25.4;
        readout.textContent =
          "\u2248 " + pxPerInch.toFixed(0) + " CSS px / inch \u2014 bar is " + refMm().toFixed(1) + " mm (" + inches.toFixed(2) + " in) wide";
      }
      syncBar();

      sel.addEventListener("change", () => {
        refId = sel.value;
        customRow.hidden = refId !== "custom";
        syncBar();
      });
      customInput.addEventListener("input", () => {
        customMm = parseFloat(customInput.value) || 1;
        syncBar();
      });

      grip.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        grip.setPointerCapture(ev.pointerId);
        const startX = ev.clientX;
        const startPxPerInch = pxPerInch;
        const startWidth = (startPxPerInch * refMm()) / 25.4;
        function move(e) {
          const dx = e.clientX - startX;
          const newWidth = Math.max(20, startWidth + dx);
          pxPerInch = (newWidth * 25.4) / refMm();
          syncBar();
        }
        function up() {
          grip.removeEventListener("pointermove", move);
          grip.removeEventListener("pointerup", up);
        }
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", up);
      });

      const foot = el("div", "modal-foot", body);
      const resetBtn = el("button", "btn", foot);
      resetBtn.textContent = "Reset to default (96/in)";
      resetBtn.addEventListener("click", () => {
        pxPerInch = DEFAULT_PX_PER_INCH;
        syncBar();
      });
      const spacer = el("div", "", foot);
      spacer.style.flex = "1";
      const saveBtn = el("button", "btn primary", foot);
      saveBtn.textContent = "Save calibration";
      saveBtn.addEventListener("click", () => {
        set(pxPerInch);
        if (ctx && ctx.close) ctx.close();
        if (opts.onSave) opts.onSave(pxPerInch);
      });
    }
  }

  window.LucarneScreenCalibration = { get, set, reset, isCalibrated, openCalibrator, DEFAULT_PX_PER_INCH };
})();
