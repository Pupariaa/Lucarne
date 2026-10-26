(function () {
  "use strict";

  const FW_BASE = "firmware-bin/";
  const USB_FILTERS = [
    { usbVendorId: 0x303a },
    { usbVendorId: 0x2e8a },
    { usbVendorId: 0x2341 },
    { usbVendorId: 0x1a86 },
    { usbVendorId: 0x10c4 },
  ];

  // Chip families the wizard can talk about. Only families with at least one
  // precompiled preset in manifest.json are actually flashable today — the
  // rest are listed (disabled) so it's clear the receiver already knows
  // about them and will light up as soon as a build is added, instead of
  // silently pretending only one chip exists.
  const CHIP_FAMILIES = [
    { id: "esp32s3", label: "ESP32-S3", note: "Dual-core, USB-CDC, optional OPI PSRAM" },
    { id: "esp32p4", label: "ESP32-P4", note: "Compile examples/LucarnePreview for your panel (MIPI or SPI)" },
    { id: "esp32", label: "ESP32 (classic)", note: "Compile LucarnePreview.ino for your board" },
    { id: "esp32c3", label: "ESP32-C3", note: "Compile LucarnePreview.ino (USB-CDC board option)" },
    { id: "esp32c6", label: "ESP32-C6", note: "No precompiled receiver yet" },
    { id: "rp2040", label: "RP2040 / RP2350", note: "Compile LucarnePreview.ino with TinyUSB Serial" },
    { id: "avr", label: "ATmega32U4 / AVR USB", note: "Low bandwidth — use Safe Live speed, small panels" },
  ];

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function badge(parent, text) {
    const b = el("span", "wizard-badge", parent);
    b.textContent = text;
    return b;
  }

  let manifestPromise = null;
  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(FW_BASE + "manifest.json?t=" + Date.now()).then((r) => {
        if (!r.ok) throw new Error("Firmware catalog fetch failed (" + r.status + ")");
        return r.json();
      });
    }
    return manifestPromise;
  }

  async function fetchBin(relPath) {
    const res = await fetch(FW_BASE + relPath + "?t=" + Date.now());
    if (!res.ok) throw new Error("Missing firmware file: " + relPath);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function buildFileArray(preset, manifest) {
    const [bootloader, partitions, app, bootApp0] = await Promise.all([
      fetchBin(preset.files.bootloader),
      fetchBin(preset.files.partitions),
      fetchBin(preset.files.app),
      fetchBin(manifest.sharedFiles.bootApp0),
    ]);
    return [
      { data: bootloader, address: parseInt(preset.offsets.bootloader, 16) },
      { data: partitions, address: parseInt(preset.offsets.partitions, 16) },
      { data: bootApp0, address: parseInt(preset.offsets.bootApp0, 16) },
      { data: app, address: parseInt(preset.offsets.app, 16) },
    ];
  }

  // Lists pins where the project's Hardware tab differs from the preset's
  // flashed fallback defaults. This is informational only, not a blocker:
  // the receiver now accepts a HWCONFIG packet at runtime (any time after
  // boot) and re-runs Display::begin() with the project's actual pins the
  // moment Studio's "Live" button connects — so the board just needs to be
  // wired to match the Hardware tab, regardless of what's baked into this
  // preset.
  function pinMismatches(preset, hw) {
    const out = [];
    const d = hw.display || {};
    const spi = hw.spi || {};
    const checks = [
      ["CS", d.cs, preset.pins.cs],
      ["DC", d.dc, preset.pins.dc],
      ["RST", d.rst, preset.pins.rst],
      ["MOSI", spi.mosi, preset.pins.mosi],
      ["SCLK", spi.sclk, preset.pins.sclk],
    ];
    if (preset.pins.miso !== undefined) checks.push(["MISO", spi.miso, preset.pins.miso]);
    checks.forEach((c) => {
      const label = c[0], cur = c[1], want = c[2];
      if (cur !== undefined && want !== undefined && cur !== want) out.push(label + " " + cur + "\u2192" + want);
    });
    return out;
  }

  async function pickPort() {
    if (!("serial" in navigator)) throw new Error("Web Serial not supported \u2014 use Chrome or Edge on desktop");
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      throw new Error("Web Serial needs HTTPS or localhost");
    }
    try {
      return await navigator.serial.requestPort({ filters: USB_FILTERS });
    } catch (e) {
      if (e && e.name === "NotFoundError") throw new Error("No port selected");
      try {
        return await navigator.serial.requestPort();
      } catch (e2) {
        if (e2 && e2.name === "NotFoundError") throw new Error("No port selected");
        throw e2;
      }
    }
  }

  function makeTerminal(onLog) {
    return {
      clean() {},
      write(s) {
        if (onLog) onLog(s, false);
      },
      writeLine(s) {
        if (onLog) onLog(s, true);
      },
    };
  }

  async function flashPreset(preset, manifest, handlers) {
    const ET = window.LucarneEsptool;
    if (!ET) throw new Error("esptool-js failed to load");
    handlers = handlers || {};
    handlers.onLog && handlers.onLog("Fetching firmware\u2026", true);
    const fileArray = await buildFileArray(preset, manifest);
    handlers.onLog && handlers.onLog("Requesting serial port\u2026", true);
    const port = await pickPort();
    const transport = new ET.Transport(port, false);
    const loader = new ET.ESPLoader({
      transport,
      baudrate: 921600,
      romBaudrate: 115200,
      terminal: makeTerminal(handlers.onLog),
    });
    try {
      await loader.main();
      await loader.writeFlash({
        fileArray,
        flashMode: "keep",
        flashFreq: "keep",
        flashSize: "keep",
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex, written, total) => {
          if (handlers.onProgress) handlers.onProgress(fileIndex, written, total, fileArray.length);
        },
      });
      await loader.after("hard_reset");
    } finally {
      try {
        await transport.disconnect();
      } catch (e) {}
    }
  }

  function openWizard(LE) {
    const DLG = window.LucarneDialog;
    const H = window.LucarneHardware;
    if (!DLG) return;

    let step = 1;
    let manifest = null;
    let chipId = "esp32s3";
    let presetId = null;
    let busy = false;

    const handle = DLG.open({
      size: "lg",
      title: "Flash receiver firmware",
      render: (body) => renderLoading(body),
    });

    const STEP_LABELS = ["Chip", "Display", "Review", "Flash"];

    function renderLoading(body) {
      body.innerHTML = "";
      el("div", "hint", body).textContent = "Loading firmware catalog\u2026";
      loadManifest()
        .then((m) => {
          manifest = m;
          if (!manifest.presets || !manifest.presets.length) throw new Error("No presets in catalog");
          const LR = window.LucarneLiveReceivers;
          const match = LR && LE.project ? LR.matchPreset(manifest.presets, LE.project) : null;
          if (match) {
            chipId = match.chip;
            presetId = match.id;
          } else {
            const firstAvailable = CHIP_FAMILIES.find((f) => manifest.presets.some((p) => p.chip === f.id));
            chipId = firstAvailable ? firstAvailable.id : chipId;
            presetId = (manifest.presets.find((p) => p.chip === chipId) || manifest.presets[0]).id;
          }
          step = 1;
          renderStep(handle.body);
        })
        .catch((e) => {
          handle.body.innerHTML = "";
          const err = el("div", "hint hint-bad", handle.body);
          err.textContent = "Could not load firmware catalog: " + (e && e.message ? e.message : e);
        });
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
        n.disabled = !!opts.nextDisabled;
        n.addEventListener("click", opts.onNext);
      }
      return foot;
    }

    function renderStep(body) {
      body.innerHTML = "";
      const steps = el("div", "wizard-steps", body);
      STEP_LABELS.forEach((label, i) => {
        const n = i + 1;
        const cls = "wizard-step" + (n === step ? " active" : n < step ? " done" : "");
        el("div", cls, steps).textContent = n + ". " + label;
      });
      if (step === 1) renderStepChip(body);
      else if (step === 2) renderStepDisplay(body);
      else if (step === 3) renderStepReview(body);
      else renderStepFlash(body);
    }

    function renderStepChip(body) {
      el("div", "hint", body).textContent =
        "Flashes the generic LucarneLivePreview receiver sketch used by the \u201cLive\u201d button \u2014 a blank board that just displays whatever you design. It does not touch your exported project firmware.";
      const grid = el("div", "wizard-board-grid", body);
      CHIP_FAMILIES.forEach((f) => {
        const presetsForChip = manifest.presets.filter((p) => p.chip === f.id);
        const available = presetsForChip.length > 0;
        const prebuiltCount = presetsForChip.filter((p) => p.prebuilt && p.files).length;
        const cell = el("button", "wizard-board-cell" + (f.id === chipId ? " sel" : "") + (!available ? " disabled" : ""), grid);
        cell.setAttribute("aria-pressed", String(f.id === chipId));
        cell.type = "button";
        cell.disabled = !available;
        el("span", "wizard-board-title", cell).textContent = f.label;
        el("span", "wizard-board-sub", cell).textContent = f.note;
        if (!available) badge(cell, "No preset");
        else if (prebuiltCount === 0) badge(cell, "Compile in IDE");
        else if (prebuiltCount < presetsForChip.length) badge(cell, prebuiltCount + " web flash");
        if (available) {
          cell.addEventListener("click", () => {
            chipId = f.id;
            const firstPreset = manifest.presets.find((p) => p.chip === chipId);
            if (firstPreset) presetId = firstPreset.id;
            renderStep(handle.body);
          });
        }
      });
      footer(body, {
        onNext: () => {
          step = 2;
          renderStep(handle.body);
        },
      });
    }

    function presetSubtitle(p) {
      const LR = window.LucarneLiveReceivers;
      const kind = LR ? LR.displayKindLabel(p.displayKind || "spi_rgb") : "SPI RGB565 TFT";
      const iface = p.interface ? p.interface + " \u00b7 " : "";
      return iface + kind + " \u00b7 " + p.panelWidth + "\u00d7" + p.panelHeight;
    }

    function renderStepDisplay(body) {
      const presets = manifest.presets.filter((p) => p.chip === chipId);
      el("div", "hint", body).textContent =
        "Pick the receiver matching your panel on " + chipLabel(chipId) + ". HWCONFIG applies your Hardware tab at Live connect.";
      const grid = el("div", "wizard-board-grid", body);
      presets.forEach((p) => {
        const cell = el("button", "wizard-board-cell" + (p.id === presetId ? " sel" : ""), grid);
        cell.setAttribute("aria-pressed", String(p.id === presetId));
        cell.type = "button";
        el("span", "wizard-board-title", cell).textContent = p.label || p.driver;
        el("span", "wizard-board-sub", cell).textContent = presetSubtitle(p);
        const badges = el("div", "wizard-badge-row", cell);
        badge(badges, (p.baud / 1000000).toFixed(p.baud >= 1000000 ? 1 : 2).replace(/\.0$/, "") + " Mbaud");
        if (p.prebuilt && p.files) badge(badges, "Web flash");
        else badge(badges, "Arduino IDE");
        if (p.psram === "opi") badge(badges, "OPI PSRAM");
        cell.addEventListener("click", () => {
          presetId = p.id;
          renderStep(handle.body);
        });
      });
      footer(body, {
        onBack: () => {
          step = 1;
          renderStep(handle.body);
        },
        onNext: () => {
          step = 3;
          renderStep(handle.body);
        },
        nextDisabled: !presetId,
      });
    }

    function renderStepReview(body) {
      const preset = manifest.presets.find((p) => p.id === presetId);
      el("div", "hint", body).textContent =
        "This exact combination \u2014 " + chipLabel(chipId) + " + " + preset.driver + " \u2014 will be flashed. Review the pins it boots with below.";

      const table = el("table", "wizard-pin-table", body);
      const thead = el("thead", "", table);
      const htr = el("tr", "", thead);
      ["Signal", "Flashed default", "Your Hardware tab"].forEach((t) => el("th", "", htr).textContent = t);
      const tbody = el("tbody", "", table);
      let hw = null;
      if (H && LE.project) {
        H.migrate(LE.project);
        hw = H.get(LE.project);
      }
      const rows = [];
      if (preset.displayKind === "oled_mono" && hw) {
        rows.push(["SDA", preset.pins && preset.pins.sda !== undefined ? preset.pins.sda : "\u2014", hw.i2c.sda]);
        rows.push(["SCL", preset.pins && preset.pins.scl !== undefined ? preset.pins.scl : "\u2014", hw.i2c.scl]);
        rows.push(["RST", preset.pins && preset.pins.rst !== undefined ? preset.pins.rst : "\u2014", hw.oled.rst]);
      } else if (preset.displayKind === "matrix_lcd" && hw) {
        rows.push(["RS", preset.pins && preset.pins.rs !== undefined ? preset.pins.rs : "\u2014", hw.matrix.rs]);
        rows.push(["EN", preset.pins && preset.pins.en !== undefined ? preset.pins.en : "\u2014", hw.matrix.en]);
      } else if (preset.pins) {
        rows.push(["CS", preset.pins.cs, hw ? hw.display.cs : "\u2014"]);
        rows.push(["DC", preset.pins.dc, hw ? hw.display.dc : "\u2014"]);
        rows.push(["RST", preset.pins.rst, hw ? hw.display.rst : "\u2014"]);
        rows.push(["MOSI", preset.pins.mosi, hw ? hw.spi.mosi : "\u2014"]);
        rows.push(["SCLK", preset.pins.sclk, hw ? hw.spi.sclk : "\u2014"]);
        if (preset.pins.miso !== undefined) rows.push(["MISO", preset.pins.miso, hw ? hw.spi.miso : "\u2014"]);
      }
      rows.forEach((r) => {
        const tr = el("tr", "", tbody);
        const mismatch = hw && r[1] !== r[2];
        el("td", "", tr).textContent = r[0];
        el("td", "", tr).textContent = String(r[1]);
        const cell = el("td", mismatch ? "hint-warn" : "", tr);
        cell.textContent = String(r[2]);
      });

      if (hw && preset.pins && preset.displayKind === "spi_rgb") {
        const mism = pinMismatches(preset, hw);
        if (mism.length) {
          const warn = el("div", "hint hint-warn", body);
          warn.textContent =
            "Wiring differs from this preset's flashed fallback pins (" +
            mism.join(", ") +
            "). That's fine \u2014 wire the board to your project's Hardware tab pins; once you click Live, Studio sends them over serial and the receiver reconfigures itself automatically.";
        } else {
          const ok = el("div", "hint hint-good", body);
          ok.textContent = "Matches your project's Hardware tab \u2014 no rewiring needed.";
        }
      }

      const meta = el("div", "wizard-badge-row", body);
      badge(meta, preset.baud / 1000000 + " Mbaud USB");
      badge(meta, preset.psram === "disabled" ? "No PSRAM needed" : "Needs OPI PSRAM board");
      badge(meta, preset.panelWidth + "\u00d7" + preset.panelHeight);

      footer(body, {
        onBack: () => {
          step = 2;
          renderStep(handle.body);
        },
        onNext: () => {
          step = 4;
          renderStep(handle.body);
        },
        nextLabel: "Connect \u0026 flash",
      });
    }

    function renderBuildInstructions(body, preset) {
      el("div", "hint", body).textContent =
        "No precompiled binary for this target yet. Compile and upload with the Arduino IDE (or arduino-cli), then use Live.";
      const pre = el("pre", "wizard-flash-log", body);
      let lines = "Sketch: " + (preset.sketch || "examples/LucarnePreview") + "\n";
      if (preset.buildFqbn) lines += "Board: " + preset.buildFqbn + "\n";
      if (preset.buildDefines) {
        lines += "Defines:\n";
        Object.keys(preset.buildDefines).forEach((k) => {
          lines += "  -D" + k + "=" + preset.buildDefines[k] + "\n";
        });
      }
      lines += "Serial.begin(" + (preset.baud || 2000000) + ") must match Live speed in Studio.\n";
      lines += "ESP32: USB CDC On Boot enabled. No Serial.print in the sketch.";
      pre.textContent = lines;
      footer(body, {
        onBack: () => {
          step = 3;
          renderStep(handle.body);
        },
      });
    }

    function renderStepFlash(body) {
      const preset = manifest.presets.find((p) => p.id === presetId);
      if (!preset.prebuilt || !preset.files) {
        renderBuildInstructions(body, preset);
        return;
      }
      el("div", "hint", body).textContent = "Connect the board over USB, then click Flash. Keep this tab focused and don't unplug the board while flashing.";
      if (LE.live && LE.live.isConnected()) {
        const warn = el("div", "hint hint-warn", body);
        warn.textContent = "Live is connected on a port \u2014 disconnect it first so the flasher can open the port.";
      }
      const progressWrap = el("div", "wizard-flash-progress", body);
      const progressBar = el("div", "wizard-flash-progress-bar", progressWrap);
      const log = el("pre", "wizard-flash-log", body);
      const flashBtn = el("button", "btn primary wizard-flash-btn", body);
      flashBtn.textContent = "Connect \u0026 flash " + chipLabel(chipId) + " + " + (preset.label || preset.driver);
      flashBtn.addEventListener("click", async () => {
        if (busy) return;
        if (LE.live && LE.live.isConnected()) {
          if (LE.toast) LE.toast("Disconnect Live first", "warn");
          return;
        }
        busy = true;
        flashBtn.disabled = true;
        log.textContent = "";
        progressBar.style.width = "0%";
        try {
          await flashPreset(preset, manifest, {
            onLog: (s) => {
              log.textContent += s + "\n";
              log.scrollTop = log.scrollHeight;
            },
            onProgress: (fileIndex, written, total, count) => {
              const overall = ((fileIndex + (total ? written / total : 0)) / count) * 100;
              progressBar.style.width = Math.min(100, Math.max(0, overall)) + "%";
            },
          });
          progressBar.style.width = "100%";
          log.textContent += "Done \u2014 board rebooted into the receiver. Click Live to connect.\n";
          if (LE.toast) LE.toast("Flashed " + chipLabel(chipId) + " + " + preset.driver, "success");
        } catch (e) {
          log.textContent += "Failed: " + (e && e.message ? e.message : e) + "\n";
          if (LE.toast) LE.toast("Flash failed: " + (e && e.message ? e.message : "error"), "error");
        } finally {
          busy = false;
          flashBtn.disabled = false;
        }
      });
      footer(body, {
        onBack: () => {
          step = 3;
          renderStep(handle.body);
        },
      });
    }

    function chipLabel(id) {
      const f = CHIP_FAMILIES.find((x) => x.id === id);
      return f ? f.label : id;
    }
  }

  window.LucarneFlash = { open: openWizard };
})();
