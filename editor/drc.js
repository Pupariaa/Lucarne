(function () {
  "use strict";

  // Widget property names that hold a reference to a project key (besides
  // the generic "key" field used by metric/switch/textfield/battery/etc).
  const KEY_FIELDS = [
    "key",
    "chargingKey",
    "hourKey",
    "minuteKey",
    "secondKey",
    "dayKey",
    "monthKey",
    "yearKey",
    "wifiKey",
    "rssiKey",
    "bluetoothKey",
    "pathKey",
    "bindKey",
  ];

  // role -> getter/setter against {project, hw} so pin checks share the same
  // role table the GPIO wizard (board-pinouts.js) already uses.
  const ROLE_PIN = {
    spiSclk: (project, hw) => hw.spi.sclk,
    spiMosi: (project, hw) => hw.spi.mosi,
    spiMiso: (project, hw) => hw.spi.miso,
    dispCs: (project, hw) => hw.display.cs,
    dispDc: (project, hw) => hw.display.dc,
    dispRst: (project, hw) =>
      window.LucarneHardware && window.LucarneHardware.displayFamily(project) === "oled_mono" && hw.oled
        ? hw.oled.rst
        : hw.display.rst,
    dispBl: (project, hw) => hw.display.bl,
    i2cSda: (project, hw) => hw.i2c.sda,
    i2cScl: (project, hw) => hw.i2c.scl,
    touchInt: (project, hw) => hw.touch.intPin,
    touchRst: (project, hw) => hw.touch.rstPin,
    sdCs: (project, hw) => hw.sd.cs,
    btnUp: (project) => project.input && project.input.buttons && project.input.buttons.up,
    btnDown: (project) => project.input && project.input.buttons && project.input.buttons.down,
    btnLeft: (project) => project.input && project.input.buttons && project.input.buttons.left,
    btnRight: (project) => project.input && project.input.buttons && project.input.buttons.right,
    btnOk: (project) => project.input && project.input.buttons && project.input.buttons.ok,
    btnBack: (project) => project.input && project.input.buttons && project.input.buttons.back,
    encA: (project) => project.input && project.input.encoder && project.input.encoder.a,
    encB: (project) => project.input && project.input.encoder && project.input.encoder.b,
    encBtn: (project) => project.input && project.input.encoder && project.input.encoder.btn,
    lcdRs: (project, hw) => hw.matrix && hw.matrix.rs,
    lcdEn: (project, hw) => hw.matrix && hw.matrix.en,
    lcdD4: (project, hw) => hw.matrix && hw.matrix.d4,
    lcdD5: (project, hw) => hw.matrix && hw.matrix.d5,
    lcdD6: (project, hw) => hw.matrix && hw.matrix.d6,
    lcdD7: (project, hw) => hw.matrix && hw.matrix.d7,
    lcdRw: (project, hw) => hw.matrix && hw.matrix.rw,
    lcdBl: (project, hw) => hw.matrix && hw.matrix.bl,
  };

  function pushIssue(list, level, group, message) {
    list.push({ level, group, message });
  }

  function checkBoardFeasibility(LE, issues) {
    const M = window.LucarneMemory;
    const H = window.LucarneHardware;
    if (!M || !H || !LE.project.hardware) return;
    const hw = H.get(LE.project);
    const fr = M.boardFeasibility(LE, hw.board.target, hw.board.schemeId);
    if (!fr.ok) {
      fr.reasons.forEach((r) => pushIssue(issues, "error", "Board / memory", r));
    }
  }

  function checkGpio(LE, issues) {
    const H = window.LucarneHardware;
    const P = window.LucarneBoardPinouts;
    if (!H || !LE.project.hardware) return;
    const project = LE.project;
    const hw = H.get(project);
    const boardId = hw.board.target;

    const roles = P ? P.neededRoles(project, hw) : Object.keys(ROLE_PIN);
    const used = new Map(); // pin -> [role, ...]
    roles.forEach((role) => {
      const getter = ROLE_PIN[role];
      if (!getter) return;
      const pin = getter(project, hw);
      if (pin === undefined || pin === null || pin < 0) return;
      if (!used.has(pin)) used.set(pin, []);
      used.get(pin).push(role);
    });

    const labels = (P && P.ROLE_LABELS) || {};
    used.forEach((roleList, pin) => {
      if (roleList.length > 1) {
        pushIssue(
          issues,
          "error",
          "GPIO",
          "GPIO " + pin + " is assigned to more than one role at once: " + roleList.map((r) => labels[r] || r).join(", ") + "."
        );
      }
    });

    if (P) {
      const data = P.get(boardId);
      const outputRoles = P.OUTPUT_ROLES || new Set();
      if (data) {
        used.forEach((roleList, pin) => {
          const cls = P.classify(boardId, pin);
          const roleLabel = roleList.map((r) => labels[r] || r).join(", ");
          if (cls.kind === "reserved") {
            pushIssue(issues, "error", "GPIO", "GPIO " + pin + " (" + roleLabel + ") is reserved on " + data.label + ": " + cls.reason);
          } else if (cls.kind === "inputOnly" && roleList.some((r) => outputRoles.has(r))) {
            pushIssue(
              issues,
              "error",
              "GPIO",
              "GPIO " + pin + " (" + roleLabel + ") is input-only on " + data.label + " and can't drive an output signal."
            );
          } else if (cls.kind === "unknown") {
            pushIssue(
              issues,
              "warning",
              "GPIO",
              "GPIO " + pin + " (" + roleLabel + ") isn't in the curated pinout for " + data.label + " - double-check it against your board's datasheet."
            );
          }
        });
      }
    }
  }

  function checkAssetStorage(LE, issues) {
    const H = window.LucarneHardware;
    const B = window.LucarneBoards;
    const A = window.LucarneAssets;
    const X = window.LucarneExport;
    if (!H || !B) return;
    const project = LE.project;
    const hw = H.get(project);
    const psramMb = B.profile(project.hardware).psramMb;
    const usage = A && A.collectImageUsage ? A.collectImageUsage(project) : {};

    Object.keys(project.images || {}).forEach((id) => {
      const img = project.images[id];
      if (!img || !usage[id]) return;
      const name = img.name || id;
      if (img.storage === "web") {
        pushIssue(
          issues,
          "error",
          "Storage",
          'Image "' + name + '" is set to Web server storage, which has no HTTP loader in the firmware — switch it to Flash, SD or External RAM.'
        );
      } else if (img.storage === "psram" && !psramMb) {
        pushIssue(issues, "error", "Storage", 'Image "' + name + '" is set to External RAM storage but the selected board has no PSRAM.');
      } else if (img.storage === "sd" && !(hw.sd && hw.sd.enabled)) {
        pushIssue(issues, "warning", "Storage", 'Image "' + name + '" is set to SD card storage but SD is disabled in Hardware — export falls back to flash.');
      } else if (img.storage === "volume" && !(hw.volume && hw.volume.enabled)) {
        pushIssue(issues, "warning", "Storage", 'Image "' + name + '" is set to internal partition storage but the volume is disabled in Hardware — export falls back to flash.');
      }
    });

    const jobs = X && X.collectIconJobs ? X.collectIconJobs(project) : [];
    jobs.forEach((j) => {
      const st = j.storage || project.iconExportStorage || "flash";
      if (st === "sd" && !(hw.sd && hw.sd.enabled)) {
        pushIssue(issues, "warning", "Storage", 'Icon "' + j.ref + '" is set to SD card storage but SD is disabled in Hardware — export falls back to flash.');
      } else if (st === "volume" && !(hw.volume && hw.volume.enabled)) {
        pushIssue(issues, "warning", "Storage", 'Icon "' + j.ref + '" is set to internal partition storage but the volume is disabled in Hardware — export falls back to flash.');
      }
    });
  }

  function checkDisplaySupport(LE, issues) {
    const S = window.LucarneState;
    const H = window.LucarneHardware;
    if (!S) return;
    const project = LE.project;
    const dev = S.device(project);
    if (!S.deviceFirmwareSupported(dev)) {
      pushIssue(
        issues,
        "error",
        "Hardware",
        'Display "' + dev.label + '" (' + (dev.family || "?") + ') has no driver in the Lucarne firmware yet — Export will produce a sketch that cannot draw to this panel. Pick a spi_rgb panel, an SSD1306 / SSD1315 / SH1106 OLED, an HD44780 character LCD, or a MIPI panel driven by HX8394, ILI9881C, JD9365 or EK79007.'
      );
    }
    if (dev.touchIc && !S.deviceTouchFirmwareSupported(dev)) {
      const hw = H ? H.get(project) : null;
      const touchEnabled = !!(hw && hw.touch && hw.touch.enabled);
      pushIssue(
        issues,
        touchEnabled ? "error" : "warning",
        "Hardware",
        'Display "' + dev.label + '" ships with a ' + dev.touchIc + ' touch controller — only GT911, GT9271, GT928 and FT6336 have a driver in the firmware today, so touch input will not work on real hardware.'
      );
    }
  }

  function checkCalcKeys(LE, issues) {
    const CK = window.LucarneCalcKeys;
    if (!CK) return;
    const r = CK.validateProject(LE.project);
    r.errors.forEach((e) => pushIssue(issues, "error", "Data keys", 'Key "' + e.name + '": ' + e.message));
  }

  function checkKeyReferences(LE, issues) {
    const project = LE.project;
    const keyNames = new Set((project.keys || []).map((k) => k.name));
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        KEY_FIELDS.forEach((field) => {
          const v = w[field];
          if (v && !keyNames.has(v)) {
            pushIssue(
              issues,
              "error",
              "Data keys",
              'Screen "' + (s.name || s.id) + '", widget "' + (w.id || w.type) + '" (' + field + ') references unknown key "' + v + '".'
            );
          }
        });
        if (Array.isArray(w.keys)) {
          w.keys.forEach((v) => {
            if (v && !keyNames.has(v)) {
              pushIssue(
                issues,
                "error",
                "Data keys",
                'Screen "' + (s.name || s.id) + '", widget "' + (w.id || w.type) + '" (series key) references unknown key "' + v + '".'
              );
            }
          });
        }
        if (w.type === "menu" && Array.isArray(w.items)) {
          w.items.forEach((it) => {
            if (it.action === "navigate" && it.target && !project.screens.some((sc) => sc.id === it.target)) {
              pushIssue(
                issues,
                "error",
                "Navigation",
                'Screen "' + (s.name || s.id) + '", menu item "' + (it.label || it.id) + '" targets a screen that no longer exists.'
              );
            }
          });
        }
        if ((w.type === "button" || w.type === "shape") && w.action === "navigate" && w.target && !project.screens.some((sc) => sc.id === w.target)) {
          pushIssue(
            issues,
            "error",
            "Navigation",
            'Screen "' + (s.name || s.id) + '", widget "' + (w.id || w.type) + '" targets a screen that no longer exists.'
          );
        }
      });
    });
  }

  function checkNavigation(LE, issues) {
    const project = LE.project;
    const ids = new Set((project.screens || []).map((s) => s.id));
    if (!project.startScreen || !ids.has(project.startScreen)) {
      pushIssue(issues, "error", "Navigation", "Start screen is not set to a valid screen.");
    }
    const reachable = new Set([project.startScreen]);
    (project.screens || []).forEach((s) => {
      if (s.splash && s.splash.enabled && s.splash.nextScreen) reachable.add(s.splash.nextScreen);
      (s.widgets || []).forEach((w) => {
        if (w.type === "menu" && Array.isArray(w.items)) {
          w.items.forEach((it) => {
            if (it.action === "navigate" && it.target) reachable.add(it.target);
          });
        }
        if ((w.type === "button" || w.type === "shape") && w.action === "navigate" && w.target) reachable.add(w.target);
      });
    });
    (project.screens || []).forEach((s) => {
      if (!reachable.has(s.id)) {
        pushIssue(issues, "warning", "Navigation", 'Screen "' + (s.name || s.id) + '" is never targeted by any menu/button/shape or splash - it may be unreachable at runtime.');
      }
    });
  }

  function run(LE) {
    const issues = [];
    checkBoardFeasibility(LE, issues);
    checkGpio(LE, issues);
    checkDisplaySupport(LE, issues);
    checkAssetStorage(LE, issues);
    checkCalcKeys(LE, issues);
    checkKeyReferences(LE, issues);
    checkNavigation(LE, issues);
    return {
      issues,
      errorCount: issues.filter((i) => i.level === "error").length,
      warningCount: issues.filter((i) => i.level === "warning").length,
      ok: issues.every((i) => i.level !== "error"),
    };
  }

  window.LucarneDrc = { run };
})();
