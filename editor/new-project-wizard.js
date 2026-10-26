(function () {
  "use strict";

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function row(parent, label) {
    const r = el("div", "row", parent);
    const l = el("label", "", r);
    l.textContent = label;
    return r;
  }

  function textField(parent, value) {
    const i = el("input", "field", parent);
    i.type = "text";
    i.value = value || "";
    return i;
  }

  function selectField(parent, options, value) {
    const s = el("select", "field", parent);
    options.forEach((o) => {
      const op = document.createElement("option");
      op.value = o.value;
      op.textContent = o.label;
      if (o.value === value) op.selected = true;
      s.appendChild(op);
    });
    return s;
  }

  function toggleRow(parent, label, checked, onchange) {
    const r = el("div", "row row-toggle", parent);
    const l = el("label", "", r);
    l.textContent = label;
    const track = el("label", "toggle", r);
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.checked = !!checked;
    track.appendChild(inp);
    track.appendChild(el("span", "toggle-track"));
    inp.addEventListener("change", () => onchange(inp.checked));
    return inp;
  }

  const FAMILY_LABELS = {
    spi_rgb: "SPI TFT (color)",
    oled_mono: "OLED (monochrome)",
    matrix_lcd: "Character LCD",
    mipi_dsi: "MIPI-DSI panel",
  };

  const INPUT_CHOICES = [
    { id: "buttons", title: "Buttons", sub: "Up / Down / OK / Back on a D-pad" },
    { id: "encoder", title: "Rotary encoder", sub: "Turn to move, press to select" },
    { id: "touch", title: "Touchscreen", sub: "Tap menus, fields and sliders directly" },
  ];

  function blankProject(S, deviceId) {
    const homeId = "home";
    return {
      name: "MyProject",
      deviceId: deviceId,
      panelWidth: 240,
      panelHeight: 280,
      rotation: 0,
      theme: S.defaultTheme(),
      fonts: S.defaultFonts(),
      input: S.defaultInput(),
      hardware: null,
      transition: { default: "SlideLeft", durationMs: 220 },
      images: {},
      icons: {},
      iconExportStorage: "flash",
      iconAnim: { maxFrames: 0, frameStep: 1 },
      uiSource: S.defaultUiSource(),
      callbacks: [],
      startScreen: homeId,
      keys: [],
      screens: [
        {
          id: homeId,
          name: "Home",
          gx: 80,
          gy: 90,
          widgets: [
            {
              id: S.genId("w"),
              type: "label",
              x: 16,
              y: 16,
              w: 208,
              h: 30,
              text: "LUCARNE",
              textStyle: { fontId: "title", align: "center" },
            },
          ],
        },
      ],
    };
  }

  function open(LE) {
    const DLG = window.LucarneDialog;
    const S = window.LucarneState;
    const B = window.LucarneBoards;
    const P = window.LucarneBoardPinouts;
    const H = window.LucarneHardware;
    if (!DLG || !S || !LE) return;

    const deviceIds = Object.keys(S.DEVICES);
    const boardIds = P ? P.boardIds() : [];

    const data = {
      name: "MyProject",
      template: "demo",
      deviceId: deviceIds.indexOf("st7789_169") >= 0 ? "st7789_169" : deviceIds[0],
      rotation: 0,
      boardId: boardIds.indexOf("esp32s3") >= 0 ? "esp32s3" : boardIds[0] || "esp32s3",
      inputType: "buttons",
      activeLow: true,
      virtualKeyboard: false,
      sdEnabled: true,
      moduleId: "",
    };

    let step = 1;
    const STEP_LABELS = ["Project", "Display", "Board", "Input", "Review"];

    const handle = DLG.open({
      title: "New project setup",
      size: "lg",
      render: (body, ctx) => renderStep(body, ctx),
    });

    function stepsHeader(body) {
      const steps = el("div", "wizard-steps", body);
      STEP_LABELS.forEach((label, i) => {
        const n = i + 1;
        const cls = "wizard-step" + (n === step ? " active" : n < step ? " done" : "");
        const s = el("div", cls, steps);
        s.textContent = n + ". " + label;
      });
    }

    function removeWizardFoot(card) {
      const f = card && card.querySelector(".modal-foot");
      if (f) f.remove();
    }

    function footer(card, opts) {
      removeWizardFoot(card);
      const foot = el("div", "modal-foot wizard-foot", card);
      if (opts.onBack) {
        const b = el("button", "btn", foot);
        b.textContent = "Back";
        b.addEventListener("click", opts.onBack);
      }
      const spacer = el("div", "wizard-foot-spacer", foot);
      if (opts.onCancel) {
        const c = el("button", "btn ghost", foot);
        c.textContent = "Cancel";
        c.addEventListener("click", opts.onCancel);
      }
      if (opts.onNext) {
        const n = el("button", "btn primary", foot);
        n.textContent = opts.nextLabel || "Next";
        n.addEventListener("click", opts.onNext);
      }
    }

    function wizardCard(ctx) {
      return ctx && ctx.card ? ctx.card : handle.card;
    }

    function renderStep(body, ctx) {
      removeWizardFoot(wizardCard(ctx));
      body.innerHTML = "";
      const pane = el("div", "wizard-pane", body);
      stepsHeader(pane);
      if (step === 1) renderStep1(pane, ctx);
      else if (step === 2) renderStep2(pane, ctx);
      else if (step === 3) renderStep3(pane, ctx);
      else if (step === 4) renderStep4(pane, ctx);
      else renderStep5(pane, ctx);
    }

    function renderStep1(body, ctx) {
      const hint = el("div", "hint", body);
      hint.textContent = "Name your project and pick a starting point. Every choice in this wizard stays editable afterwards.";
      const r1 = row(body, "Project name");
      const nameInput = textField(r1, data.name);
      nameInput.addEventListener("input", () => {
        data.name = nameInput.value;
      });

      const block = el("div", "wizard-block", body);
      el("div", "wizard-block-label", block).textContent = "Starting point";
      const grid = el("div", "wizard-board-grid", block);
      [
        { id: "demo", title: "Demo dashboard", sub: "Home menu + a dashboard screen with sample metrics" },
        { id: "blank", title: "Blank", sub: "A single empty Home screen" },
      ].forEach((opt) => {
        const cell = el("button", "wizard-board-cell" + (data.template === opt.id ? " sel" : ""), grid);
        cell.setAttribute("aria-pressed", String(data.template === opt.id));
        el("span", "wizard-board-title", cell).textContent = opt.title;
        el("span", "wizard-board-sub", cell).textContent = opt.sub;
        cell.addEventListener("click", () => {
          data.template = opt.id;
          renderStep(handle.body);
        });
      });

      const modBlock = el("div", "wizard-block", body);
      el("div", "wizard-block-label", modBlock).textContent = "Module";
      const modGrid = el("div", "wizard-board-grid", modBlock);
      const moduleChoices = [{ id: "", title: "Custom", sub: "Pick the display, board and input in the next steps" }].concat(
        (window.LucarneModules ? window.LucarneModules.list() : []).map((m) => ({
          id: m.id,
          title: m.label,
          sub: "ESP32-S3 N16R8, ST7789 2.4 inch at 90 degrees, directional pad, SD on the shared SPI bus",
        }))
      );
      moduleChoices.forEach((opt) => {
        const cell = el("button", "wizard-board-cell" + (data.moduleId === opt.id ? " sel" : ""), modGrid);
        cell.setAttribute("aria-pressed", String(data.moduleId === opt.id));
        el("span", "wizard-board-title", cell).textContent = opt.title;
        el("span", "wizard-board-sub", cell).textContent = opt.sub;
        cell.addEventListener("click", () => {
          data.moduleId = opt.id;
          renderStep(handle.body);
        });
      });

      footer(wizardCard(ctx), {
        onCancel: () => handle.close(),
        onNext: () => {
          step = data.moduleId ? 5 : 2;
          renderStep(handle.body);
        },
      });
    }

    function renderStep2(body, ctx) {
      const hint = el("div", "hint", body);
      hint.textContent = "Pick the display panel wired to your board and its rotation. This sets the native resolution and default colors.";

      const byFamily = {};
      deviceIds.forEach((id) => {
        const d = S.DEVICES[id];
        const fam = d.family || "spi_rgb";
        (byFamily[fam] = byFamily[fam] || []).push(id);
      });

      const r1 = row(body, "Display panel");
      const sel = el("select", "field", r1);
      Object.keys(byFamily).forEach((fam) => {
        const group = document.createElement("optgroup");
        group.label = FAMILY_LABELS[fam] || fam;
        byFamily[fam].forEach((id) => {
          const dev = S.DEVICES[id];
          const supported = S.deviceFirmwareSupported(dev);
          const op = document.createElement("option");
          op.value = id;
          op.textContent = dev.label + (supported ? "" : " — firmware not implemented yet");
          if (!supported) op.disabled = true;
          if (id === data.deviceId) op.selected = true;
          group.appendChild(op);
        });
        sel.appendChild(group);
      });
      sel.addEventListener("change", () => {
        data.deviceId = sel.value;
        renderStep(handle.body);
      });

      const r2 = row(body, "Rotation");
      const rot = selectField(
        r2,
        [
          { value: "0", label: "0°" },
          { value: "1", label: "90°" },
          { value: "2", label: "180°" },
          { value: "3", label: "270°" },
        ],
        String(data.rotation)
      );
      rot.addEventListener("change", () => {
        data.rotation = parseInt(rot.value, 10) || 0;
        renderStep(handle.body);
      });

      const dev = S.DEVICES[data.deviceId];
      const rotated = data.rotation === 1 || data.rotation === 3;
      const w = rotated ? dev.h : dev.w;
      const h = rotated ? dev.w : dev.h;
      const preview = el("div", "hint", body);
      preview.textContent = "Effective resolution: " + w + " x " + h + " (" + (dev.driver || dev.family) + ")";

      if (!S.deviceFirmwareSupported(dev)) {
        const warn = el("div", "hint-bad", body);
        warn.textContent =
          "Lucarne has no display driver for this panel yet — Export will be blocked until you pick a spi_rgb panel or a MIPI panel driven by HX8394, ILI9881C, JD9365 or EK79007.";
      } else if (dev.touchIc && !S.deviceTouchFirmwareSupported(dev)) {
        const warn = el("div", "hint-warn", body);
        warn.textContent =
          "This panel ships with a " + dev.touchIc + " touch controller — only GT911, GT9271, GT928 and FT6336 are supported today, so touch input will not work on real hardware.";
      }

      footer(wizardCard(ctx), {
        onBack: () => {
          step = 1;
          renderStep(handle.body);
        },
        onNext: () => {
          step = 3;
          renderStep(handle.body);
        },
      });
    }

    function renderStep3(body, ctx) {
      if (!P || !boardIds.length) {
        const hint = el("div", "hint", body);
        hint.textContent = "Board catalog unavailable — you can assign the MCU and GPIOs later from Hardware.";
        footer(wizardCard(ctx), {
          onBack: () => {
            step = 2;
            renderStep(handle.body);
          },
          onNext: () => {
            step = 4;
            renderStep(handle.body);
          },
        });
        return;
      }
      const hint = el("div", "hint", body);
      hint.textContent =
        "Pick the devkit you're wiring. GPIOs for the display, touch, SD card and buttons/encoder will be auto-assigned for it on the last step.";
      const grid = el("div", "wizard-board-grid", body);
      boardIds.forEach((id) => {
        const info = P.get(id);
        const cell = el("button", "wizard-board-cell" + (id === data.boardId ? " sel" : ""), grid);
        cell.setAttribute("aria-pressed", String(id === data.boardId));
        el("span", "wizard-board-title", cell).textContent = info.label;
        el("span", "wizard-board-sub", cell).textContent =
          (B ? B.boardLabel(id) : id) + " - " + info.freePool.length + " free GPIOs curated";
        cell.addEventListener("click", () => {
          data.boardId = id;
          renderStep(handle.body);
        });
      });
      footer(wizardCard(ctx), {
        onBack: () => {
          step = 2;
          renderStep(handle.body);
        },
        onNext: () => {
          step = 4;
          renderStep(handle.body);
        },
      });
    }

    function renderStep4(body, ctx) {
      const hint = el("div", "hint", body);
      hint.textContent = "How will people interact with the UI on-device?";
      const grid = el("div", "wizard-board-grid", body);
      INPUT_CHOICES.forEach((opt) => {
        const cell = el("button", "wizard-board-cell" + (data.inputType === opt.id ? " sel" : ""), grid);
        cell.setAttribute("aria-pressed", String(data.inputType === opt.id));
        el("span", "wizard-board-title", cell).textContent = opt.title;
        el("span", "wizard-board-sub", cell).textContent = opt.sub;
        cell.addEventListener("click", () => {
          data.inputType = opt.id;
          renderStep(handle.body);
        });
      });

      if (data.inputType === "buttons" || data.inputType === "encoder") {
        toggleRow(
          body,
          "Buttons wired active-low (to GND, need internal pull-up)",
          data.activeLow,
          (v) => (data.activeLow = v)
        );
        toggleRow(
          body,
          "Virtual keyboard for text fields",
          data.virtualKeyboard,
          (v) => (data.virtualKeyboard = v)
        );
      } else {
        const dev = S.DEVICES[data.deviceId];
        const note = el("div", "hint", body);
        note.textContent =
          "A generic I2C touch controller is assumed unless the display panel already has one built in (e.g. MIPI-DSI panels).";
        if (dev.touchIc && !S.deviceTouchFirmwareSupported(dev)) {
          const warn = el("div", "hint-warn", body);
          warn.textContent =
            "The selected panel's " + dev.touchIc + " touch controller has no driver in Lucarne yet — only GT911, GT9271, GT928 and FT6336 work on real hardware today.";
        }
      }

      toggleRow(body, "SD card present", data.sdEnabled, (v) => (data.sdEnabled = v));
      const sdHint = el("div", "hint", body);
      sdHint.textContent = "Used to store larger images/fonts and can serve exported assets on-device.";

      footer(wizardCard(ctx), {
        onBack: () => {
          step = 3;
          renderStep(handle.body);
        },
        onNext: () => {
          step = 5;
          renderStep(handle.body);
        },
      });
    }

    function renderStep5(body, ctx) {
      const project = buildProject();
      const hw = H ? H.get(project) : null;
      const dev = S.device(project);

      const hint = el("div", "hint", body);
      hint.textContent = "Review your setup. Creating the project is one step and can be undone with Ctrl+Z.";

      const list = el("div", "section subcard", body);
      addSummaryRow(list, "Name", data.name || "MyProject");
      addSummaryRow(list, "Template", data.template === "blank" ? "Blank" : "Demo dashboard");
      addSummaryRow(list, "Display", dev.label + " · rotation " + (project.rotation | 0) * 90 + "°");
      const effectiveBoard = hw ? hw.board.target : data.boardId;
      addSummaryRow(
        list,
        "Board",
        P && boardIds.length && P.get(effectiveBoard) ? P.get(effectiveBoard).label : "Not set (configure later)"
      );
      addSummaryRow(
        list,
        "Input",
        INPUT_CHOICES.find((o) => o.id === data.inputType).title +
          (data.inputType !== "touch" ? (data.activeLow ? " · active-low" : " · active-high") : "") +
          (data.virtualKeyboard && data.inputType !== "touch" ? " · virtual keyboard" : "")
      );
      addSummaryRow(list, "SD card", hw && hw.sd && hw.sd.enabled !== false ? "Enabled" : "Disabled");
      if (project.moduleId && window.LucarneModules) {
        window.LucarneModules.summary(project).forEach((line) => {
          const note = el("div", "hint", body);
          note.textContent = line;
        });
      }

      if (!S.deviceFirmwareSupported(dev)) {
        const warn = el("div", "hint hint-bad", body);
        warn.textContent =
          "This display family has no firmware driver yet — the project will be created, but Export will refuse to generate a sketch until you switch to a supported panel (Hardware > Display).";
      } else if (data.inputType === "touch" && dev.touchIc && !S.deviceTouchFirmwareSupported(dev)) {
        const warn = el("div", "hint hint-warn", body);
        warn.textContent =
          "This panel's " + dev.touchIc + " touch controller has no firmware driver yet — touch will not respond on real hardware until a panel with GT911/GT9271/GT928/FT6336 is used instead.";
      }

      if (!project.moduleId && P && boardIds.length && hw) {
        const effectiveBoardId = hw.board.target;
        const suggestion = P.suggest(effectiveBoardId, project, hw);
        const roles = Object.keys(suggestion.assignments);
        if (roles.length) {
          const pinHint = el("div", "hint", body);
          pinHint.textContent = "Auto-assigned GPIOs for " + (P.get(effectiveBoardId) || P.get(data.boardId)).label + ":";
          const table = el("table", "wizard-pin-table", body);
          const tbody = el("tbody", "", table);
          roles.forEach((role) => {
            const tr = el("tr", "", tbody);
            el("td", "", tr).textContent = suggestion.roleLabels[role] || role;
            el("td", "", tr).textContent = "GPIO " + suggestion.assignments[role];
          });
        }
        if (suggestion.warnings.length) {
          const warn = el("div", "hint hint-warn", body);
          warn.textContent = suggestion.warnings.join(" ");
        }
      }

      footer(wizardCard(ctx), {
        onBack: () => {
          step = data.moduleId ? 1 : 4;
          renderStep(handle.body);
        },
        onNext: () => {
          create();
        },
        nextLabel: "Create project",
      });
    }

    function addSummaryRow(parent, label, value) {
      const r = el("div", "row-between wizard-summary-row", parent);
      const l = el("span", "muted", r);
      l.textContent = label;
      const v = el("strong", "", r);
      v.textContent = value;
    }

    function buildProject() {
      const base = data.template === "blank" ? blankProject(S, data.deviceId) : S.defaultProject();
      base.name = data.name || "MyProject";
      base.deviceId = data.deviceId;
      const dev = S.DEVICES[data.deviceId];
      base.panelWidth = dev.w;
      base.panelHeight = dev.h;
      base.rotation = data.rotation;
      base.input = base.input || S.defaultInput();
      base.input.type = data.inputType;
      base.input.activeLow = data.activeLow;
      base.input.virtualKeyboard = data.virtualKeyboard;

      if (H) {
        H.migrate(base);
        const hw = H.get(base);
        hw.board.target = data.boardId;
        hw.sd.enabled = data.sdEnabled;
        if (B) {
          const list = B.schemeList(data.boardId);
          if (list.length && !B.getScheme(data.boardId, hw.board.schemeId)) hw.board.schemeId = list[0].id;
          const rp = B.isRpBoard ? B.isRpBoard(data.boardId) : false;
          if (data.boardId === "esp32p4" && (!hw.board.psramMb || hw.board.psramMb < 8)) hw.board.psramMb = 32;
          if (rp) {
            hw.board.psramMb = 0;
            hw.board.sramKb = B.defaultSramKb(data.boardId);
          }
        }
        if (data.inputType === "touch") {
          hw.touch.enabled = true;
          if (!hw.touch.kind || hw.touch.kind === "none") {
            hw.touch.kind = dev.family === "mipi_dsi" ? "dsi" : "i2c_ft6336";
          }
        }
        H.applyDeviceDefaults(base, dev);
        if (data.moduleId && window.LucarneModules) {
          window.LucarneModules.apply(base, data.moduleId);
        } else if (P) {
          const suggestion = P.suggest(hw.board.target, base, hw);
          P.applyAssignments(base, hw, suggestion.assignments);
        }
      }
      return base;
    }

    function create() {
      const project = buildProject();
      handle.close();
      if (LE.createProject) LE.createProject(project);
      if (LE.toast) LE.toast("Project created: " + (project.name || "MyProject"), "success");
    }
  }

  window.LucarneNewProjectWizard = { open, blankProject };
})();
