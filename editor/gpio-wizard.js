(function () {
  "use strict";

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function openWizard(LE) {
    const DLG = window.LucarneDialog;
    const B = window.LucarneBoards;
    const P = window.LucarneBoardPinouts;
    const H = window.LucarneHardware;
    if (!DLG || !B || !P || !H) return;
    H.migrate(LE.project);
    const hw = H.get(LE.project);

    const validIds = P.boardIds();
    let boardId = validIds.indexOf(hw.board.target) >= 0 ? hw.board.target : "esp32s3";
    let step = 1;
    let suggestion = null;

    const handle = DLG.open({
      title: "GPIO configuration wizard",
      size: "lg",
      render: (body) => renderStep(body),
    });

    function renderStep(body) {
      body.innerHTML = "";
      const steps = el("div", "wizard-steps", body);
      [1, 2, 3].forEach((n) => {
        const cls = "wizard-step" + (n === step ? " active" : n < step ? " done" : "");
        const s = el("div", cls, steps);
        s.textContent = n + ". " + (n === 1 ? "Pick MCU" : n === 2 ? "Auto-assign" : "Apply");
      });
      if (step === 1) renderStep1(body);
      else if (step === 2) renderStep2(body);
      else renderStep3(body);
    }

    function footer(body, opts) {
      const foot = el("div", "modal-foot", body);
      if (opts.onBack) {
        const b = el("button", "btn", foot);
        b.textContent = "Back";
        b.addEventListener("click", opts.onBack);
      }
      const spacer = el("div", "", foot);
      spacer.style.flex = "1";
      if (opts.onNext) {
        const n = el("button", "btn primary", foot);
        n.textContent = opts.nextLabel || "Next";
        n.addEventListener("click", opts.onNext);
      }
    }

    function renderStep1(body) {
      const hint = el("div", "hint", body);
      hint.textContent =
        "Pick the devkit you're wiring. This drives which GPIOs are safe to use (avoiding flash/PSRAM pins, boot straps and USB pins). Only ESP32-family and RP2040/RP2350-family boards are listed - classic AVR Arduino boards (Uno, Mega, Nano) don't have enough RAM/flash to run a framebuffer-based UI like this one.";
      const grid = el("div", "wizard-board-grid", body);
      validIds.forEach((id) => {
        const data = P.get(id);
        const cell = el("button", "wizard-board-cell" + (id === boardId ? " sel" : ""), grid);
        cell.setAttribute("aria-pressed", String(id === boardId));
        const title = el("span", "wizard-board-title", cell);
        title.textContent = data.label;
        const sub = el("span", "wizard-board-sub", cell);
        sub.textContent = B.boardLabel(id) + " - " + data.freePool.length + " free GPIOs curated";
        cell.addEventListener("click", () => {
          boardId = id;
          renderStep(handle.body);
        });
      });
      footer(body, {
        onNext: () => {
          step = 2;
          renderStep(handle.body);
        },
      });
    }

    function renderStep2(body) {
      suggestion = P.suggest(boardId, LE.project, hw);
      const hint = el("div", "hint", body);
      const roles = Object.keys(suggestion.assignments);
      hint.textContent = roles.length
        ? "Suggested pins for " + P.get(boardId).label + ", based on the peripherals currently enabled in Hardware / Input."
        : "No pin-based peripherals are enabled yet (no SPI display, I2C touch, SD card or button/encoder input). Enable them first in Hardware / Input.";
      if (suggestion.warnings.length) {
        const warn = el("div", "hint hint-warn", body);
        warn.textContent = suggestion.warnings.join(" ");
      }
      if (roles.length) {
        const table = el("table", "wizard-pin-table", body);
        const thead = el("thead", "", table);
        const htr = el("tr", "", thead);
        el("th", "", htr).textContent = "Role";
        el("th", "", htr).textContent = "GPIO";
        el("th", "", htr).textContent = "Note";
        const tbody = el("tbody", "", table);
        roles.forEach((role) => {
          const pin = suggestion.assignments[role];
          const tr = el("tr", "", tbody);
          el("td", "", tr).textContent = suggestion.roleLabels[role] || role;
          el("td", "", tr).textContent = "GPIO " + pin;
          const cls = P.classify(boardId, pin);
          el("td", "", tr).textContent = cls.kind === "inputOnly" ? "Input-only pin" : "";
        });
      }
      const data = P.get(boardId);
      if (data.notes && data.notes.length) {
        data.notes.forEach((n) => {
          const note = el("div", "hint", body);
          note.textContent = n;
        });
      }
      footer(body, {
        onBack: () => {
          step = 1;
          renderStep(handle.body);
        },
        onNext: () => {
          step = 3;
          renderStep(handle.body);
        },
        nextLabel: "Review & apply",
      });
    }

    function renderStep3(body) {
      const hint = el("div", "hint", body);
      hint.textContent =
        'Applying will set the board to "' +
        B.boardLabel(boardId) +
        '" and write the pin assignments below into Hardware / Input. This is one history step (Ctrl+Z will undo it).';
      const roles = Object.keys((suggestion && suggestion.assignments) || {});
      if (roles.length) {
        const table = el("table", "wizard-pin-table", body);
        const tbody = el("tbody", "", table);
        roles.forEach((role) => {
          const tr = el("tr", "", tbody);
          el("td", "", tr).textContent = suggestion.roleLabels[role] || role;
          el("td", "", tr).textContent = "GPIO " + suggestion.assignments[role];
        });
      }
      footer(body, {
        onBack: () => {
          step = 2;
          renderStep(handle.body);
        },
        onNext: () => {
          applyWizard();
        },
        nextLabel: "Apply",
      });
    }

    function applyWizard() {
      const rp = B.isRpBoard ? B.isRpBoard(boardId) : false;
      hw.board.target = boardId;
      const list = B.schemeList(boardId);
      if (list.length && !B.getScheme(boardId, hw.board.schemeId)) hw.board.schemeId = list[0].id;
      if (boardId === "esp32p4" && (!hw.board.psramMb || hw.board.psramMb < 8)) hw.board.psramMb = 32;
      if (rp) {
        hw.board.psramMb = 0;
        hw.board.sramKb = B.defaultSramKb(boardId);
      }
      if (suggestion && suggestion.assignments) {
        P.applyAssignments(LE.project, hw, suggestion.assignments);
      }
      LE.markDirty("Apply GPIO wizard");
      if (LE.refreshDock) LE.refreshDock();
      if (LE.toast) LE.toast("GPIO wizard applied to " + B.boardLabel(boardId), "success");
      handle.close();
    }
  }

  window.LucarneGpioWizard = { open: openWizard };
})();
