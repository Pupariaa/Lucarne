(function () {
  "use strict";

  function defaultHardware() {
    return {
      spi: { mosi: 15, miso: 3, sclk: 18 },
      i2c: { sda: 21, scl: 22, hz: 400000 },
      display: {
        cs: 19,
        dc: 20,
        rst: 14,
        bl: -1,
        spiHz: 27000000,
        spiMode: 3,
        invert: true,
        colorOrder: "RGB",
        blActiveLow: false,
      },
      oled: {
        addr: 0x3c,
        rst: -1,
        invert: false,
        flipVertical: false,
        panelVariant: "white",
      },
      matrix: {
        rs: 27,
        en: 14,
        d4: 12,
        d5: 13,
        d6: 26,
        d7: 25,
        rw: -1,
        bl: -1,
        cols: 16,
        rows: 2,
      },
      mipi: {
        laneCount: 2,
        laneMbps: 700,
        dpiClockMhz: 58,
        hsync: 20,
        vsync: 4,
        hbp: 20,
        hfp: 40,
        vbp: 10,
        vfp: 24,
        i2cSda: 7,
        i2cScl: 8,
        blI2cAddr: 0x45,
      },
      touch: {
        enabled: false,
        kind: "none",
        i2cAddr: 0x38,
        intPin: -1,
        rstPin: -1,
        swapXY: false,
        invertX: false,
        invertY: false,
      },
      keyboard: {
        enabled: false,
        layout: "compact",
        dock: "bottom",
      },
      sd: {
        enabled: true,
        cs: 2,
        spiHz: 4000000,
        assetsDir: "/assets",
      },
      volume: {
        enabled: false,
        fs: "fat",
        partition: "ffat",
        assetsDir: "/assets",
      },
      board: {
        target: "esp32s3",
        schemeId: "app3M_fat9M_16MB",
        psramMb: 8,
        sramKb: 512,
      },
      hal: {
        backend: "auto",
        uiProfile: "auto",
        stripeLines: 0,
        allowRichTransitions: true,
        preferRichTransitions: false,
        preferHwRotate: true,
        jpegDecodeHw: false,
        bufferMode: "auto",
      },
    };
  }

  const UI_PROFILES = ["Tiny", "LowRam", "Psram", "MipiHighRes"];
  const BUFFER_MODES = ["None", "Partial", "Full"];

  const PROFILE_DOC_FR = {
    Tiny:
      "Tiny : microcontrôleurs à très peu de SRAM (ESP32-C3, CH32V, ATmega). Pas de framebuffer complet : l'écran est rendu par bandes de quelques lignes (mode Partial) ou directement (mode None). Seules les transitions None et Fade sont exportées ; les animations de glissement sont remplacées par un changement instantané.",
    LowRam:
      "LowRam : SRAM interne confortable mais sans PSRAM (ESP32 classique, S2, C5/C6, RP2040/RP2350, STM32 F1/F4). Le framebuffer complet n'est utilisé que s'il tient dans le budget ; sinon rendu par bandes. Fade et Slide passent par le moteur de bandes (deux bandes en RAM, jamais deux écrans) ; Push et Cover deviennent None.",
    Psram:
      "Psram : carte avec PSRAM (ESP32-S3 N8R8, STM32H7, CH32H avec LTDC). Framebuffer complet en PSRAM, rafraîchissement par zones modifiées uniquement. Toutes les transitions sont disponibles en bandes ; le chemin riche (deux captures plein écran) n'est utilisé que si vous l'activez explicitement.",
    MipiHighRes:
      "MipiHighRes : ESP32-P4 avec dalle MIPI-DSI haute résolution. Framebuffer en PSRAM plus tampon natif de rotation ; flush par rectangles et bandes de 50 lignes. Toutes les transitions sont disponibles (16 bandes) ; le chemin riche reste optionnel car il consomme deux framebuffers supplémentaires.",
  };

  const BUFFER_DOC_FR = {
    Full: "Full : framebuffer complet (largeur x hauteur x 2 octets). Rendu le plus fluide, coût RAM maximal.",
    Partial:
      "Partial : seulement une bande de N lignes en RAM ; chaque zone modifiée est redessinée bande par bande. Idéal quand le framebuffer ne tient pas en SRAM.",
    None: "None : aucun tampon couleur. Utilisé par les OLED (page buffer 1 bpp interne) et les LCD caractères HD44780.",
  };

  function targetOf(hw) {
    return String((hw.board && hw.board.target) || "esp32s3").toLowerCase();
  }

  function logicalDims(project) {
    const dev = deviceDef(project);
    let w = project.panelWidth > 0 ? project.panelWidth : dev.w || 240;
    let h = project.panelHeight > 0 ? project.panelHeight : dev.h || 280;
    if ((project.rotation | 0) & 1) {
      const t = w;
      w = h;
      h = t;
    }
    return { w, h };
  }

  function has(target, key) {
    return target.indexOf(key) >= 0;
  }

  function chipOf(target) {
    if (target === "arduino_nano_esp32") return "esp32s3";
    if (has(target, "esp32p4")) return "esp32p4";
    if (has(target, "esp32s31")) return "esp32s3";
    if (has(target, "esp32s3")) return "esp32s3";
    if (has(target, "esp32s2")) return "esp32s2";
    if (has(target, "esp32c3")) return "esp32c3";
    if (has(target, "esp32c5")) return "esp32c5";
    if (has(target, "esp32c6")) return "esp32c6";
    if (has(target, "esp32h4")) return "esp32h4";
    if (has(target, "rp2350")) return "rp2350";
    if (has(target, "rp2040")) return "rp2040";
    if (has(target, "stm32h7")) return "stm32h7";
    if (has(target, "stm32")) return "stm32";
    if (has(target, "ch32v")) return "ch32v";
    if (has(target, "ch32h")) return "ch32h";
    if (has(target, "atmega") || has(target, "32u4")) return "avr";
    if (has(target, "esp32")) return "esp32";
    return target;
  }

  function autoUiProfile(chip, family, psramMb, sramKb) {
    if (family === "mipi_dsi") return "MipiHighRes";
    switch (chip) {
      case "esp32p4":
      case "esp32s3":
        return psramMb > 0 ? "Psram" : "LowRam";
      case "esp32c3":
      case "ch32v":
      case "avr":
        return "Tiny";
      case "esp32":
      case "esp32s2":
      case "esp32c5":
      case "esp32c6":
      case "esp32h4":
        return sramKb >= 320 ? "LowRam" : "Tiny";
      case "rp2040":
      case "rp2350":
      case "stm32":
        return "LowRam";
      case "stm32h7":
      case "ch32h":
        return "Psram";
      default:
        return "LowRam";
    }
  }

  function frameBudgetBytes(chip, uiProfile, psramMb, sramKb) {
    if (psramMb > 0 && (uiProfile === "Psram" || uiProfile === "MipiHighRes")) {
      return Math.floor(psramMb * 1048576 * 0.5);
    }
    const sram = Math.max(2, sramKb | 0) * 1024;
    if (chip === "avr") return Math.floor(sram * 0.4);
    if (uiProfile === "Tiny") return Math.floor(sram * 0.25);
    return Math.floor(sram * 0.4);
  }

  function boardMemory(hw) {
    const board = hw.board || {};
    const target = board.target || "esp32s3";
    const B = window.LucarneBoards;
    if (B && B.profile) {
      const prof = B.profile(hw);
      return { psramMb: Math.max(0, prof.psramMb | 0), sramKb: Math.max(0, prof.sramKb | 0) };
    }
    const rp = B && B.isRpBoard ? B.isRpBoard(target) : false;
    const sramKb = rp && B.defaultSramKb ? B.defaultSramKb(target) : board.sramKb != null ? board.sramKb | 0 : 512;
    return { psramMb: rp ? 0 : Math.max(0, board.psramMb | 0), sramKb: Math.max(0, sramKb) };
  }

  function resolveHalProfile(project, familyOverride) {
    const hw = get(project);
    const family = familyOverride || displayFamily(project);
    const hal = hw.hal || {};
    const target = targetOf(hw);
    const chip = chipOf(target);
    const mem = boardMemory(hw);
    const psramMb = mem.psramMb;
    const sramKb = mem.sramKb;
    const dims = logicalDims(project);
    const fullBytes = dims.w * dims.h * 2;
    const isAvr = chip === "avr";
    const noColorBuffer = family === "oled_mono" || family === "matrix_lcd";

    const backend = hal.backend || "auto";
    let uiProfile = hal.uiProfile && hal.uiProfile !== "auto" ? hal.uiProfile : autoUiProfile(chip, family, psramMb, sramKb);
    if (UI_PROFILES.indexOf(uiProfile) < 0) uiProfile = "LowRam";
    const requestedProfile = uiProfile;
    const psramDowngraded = (uiProfile === "Psram" || uiProfile === "MipiHighRes") && psramMb === 0;
    if (psramDowngraded) uiProfile = "LowRam";

    const budget = frameBudgetBytes(chip, uiProfile, psramMb, sramKb);
    const richCapable = uiProfile === "Psram" || uiProfile === "MipiHighRes";
    let allowRichTransitions = hal.allowRichTransitions !== undefined ? !!hal.allowRichTransitions : richCapable;
    if (!richCapable) allowRichTransitions = false;
    let preferRichTransitions = !!hal.preferRichTransitions && allowRichTransitions;
    const preferHwRotate = hal.preferHwRotate !== undefined ? !!hal.preferHwRotate : true;
    const jpegDecodeHw = !!hal.jpegDecodeHw;

    let autoMode;
    if (noColorBuffer) autoMode = "None";
    else if (uiProfile === "MipiHighRes") autoMode = "Full";
    else if (uiProfile === "Psram") autoMode = fullBytes <= budget ? "Full" : "Partial";
    else if (uiProfile === "Tiny") autoMode = "Partial";
    else if (chip === "esp32s3" || chip === "stm32") autoMode = fullBytes <= budget ? "Full" : "Partial";
    else autoMode = "Partial";

    let bufferMode = autoMode;
    const reqMode = String(hal.bufferMode || "auto");
    if (!noColorBuffer && reqMode !== "auto") {
      const norm = reqMode.charAt(0).toUpperCase() + reqMode.slice(1).toLowerCase();
      if (BUFFER_MODES.indexOf(norm) >= 0) bufferMode = norm;
    }

    let stripeLines = hal.stripeLines | 0;
    if (stripeLines <= 0) {
      if (uiProfile === "MipiHighRes") stripeLines = 50;
      else if (isAvr) {
        const fit = Math.floor(budget / Math.max(1, Math.max(dims.w, dims.h) * 2));
        stripeLines = Math.max(4, Math.min(8, fit));
      } else if (uiProfile === "Tiny") stripeLines = Math.max(10, Math.min(16, Math.floor(dims.h / 10)));
      else stripeLines = Math.max(10, Math.floor(dims.h / 10));
    }
    const asyncFlush = chip === "rp2040" || chip === "rp2350" || chip.indexOf("esp32") === 0;
    const stripeCount = asyncFlush ? 2 : 1;
    const stripeBytes = stripeLines * Math.max(dims.w, dims.h) * 2 * stripeCount;
    if (isAvr && bufferMode === "Partial" && 4 * Math.max(dims.w, dims.h) * 2 > budget) bufferMode = "None";

    if (bufferMode !== "Full") preferRichTransitions = false;

    const fullOverBudget = bufferMode === "Full" && fullBytes > budget;

    return {
      backend,
      uiProfile,
      requestedProfile,
      psramDowngraded,
      sramKb,
      psramMb,
      stripeLines,
      allowRichTransitions,
      preferRichTransitions,
      preferHwRotate,
      jpegDecodeHw,
      bufferMode,
      autoBufferMode: autoMode,
      partialLineCount: bufferMode === "Partial" ? stripeLines : 0,
      maxBytes: noColorBuffer ? 0 : budget,
      fullBytes,
      stripeBytes,
      stripeCount,
      budget,
      fullOverBudget,
      psram: psramMb > 0,
      width: dims.w,
      height: dims.h,
    };
  }

  function resolveTransitionName(project, name) {
    let t = String(name || "Inherit");
    if (t === "Inherit") {
      const def = project && project.transition ? project.transition.default : "";
      t = def && def !== "Inherit" ? String(def) : "None";
    }
    return t;
  }

  function transitionSupport(project, name, opts) {
    const inherit = !name || name === "Inherit";
    const t = opts && opts.resolveInherit ? resolveTransitionName(project, name) : String(name || "None");
    if (t === "None" || t === "Inherit") return { ok: true, effective: t, reason: "", inherited: inherit };
    const res = transitionRules(project, t);
    res.inherited = inherit;
    return res;
  }

  function transitionRules(project, t) {
    const family = displayFamily(project);
    if (family === "oled_mono" || family === "matrix_lcd") {
      return { ok: false, effective: "None", reason: "No color buffer on this display: transitions are disabled." };
    }
    const prof = resolveHalProfile(project, family);
    if (prof.bufferMode === "None") {
      return { ok: false, effective: "None", reason: "Buffer mode None: transitions are disabled." };
    }
    const slide = t.indexOf("Slide") === 0;
    const pushCover = t === "Push" || t === "Cover";
    if (prof.uiProfile === "Tiny") {
      if (t === "Fade") return { ok: true, effective: t, reason: "" };
      return { ok: false, effective: "None", reason: "Tiny profile: only None and Fade are supported." };
    }
    if (prof.uiProfile === "LowRam") {
      if (pushCover) return { ok: false, effective: "None", reason: "LowRam profile: Push and Cover become None." };
      if (slide || t === "Fade") return { ok: true, effective: t, reason: "" };
    }
    return { ok: true, effective: t, reason: "" };
  }

  function effectiveTransition(project, name) {
    return transitionSupport(project, name).effective;
  }

  function runtimeTransition(project, name) {
    return transitionSupport(project, name, { resolveInherit: true }).effective;
  }

  function displayFamily(project) {
    if (window.LucarneState && window.LucarneState.deviceFamily) {
      return window.LucarneState.deviceFamily(project);
    }
    return "spi_rgb";
  }

  function deviceDef(project) {
    if (window.LucarneState && window.LucarneState.device) {
      return window.LucarneState.device(project);
    }
    return { family: "spi_rgb" };
  }

  function needsSpiBus(project) {
    const family = displayFamily(project);
    const dev = deviceDef(project);
    if (family === "spi_rgb") return true;
    if (family === "oled_mono" && dev.bus === "spi") return true;
    if (get(project).sd.enabled) return true;
    return false;
  }

  function applyDeviceDefaults(project, dev) {
    if (!project || !dev) return;
    const hw = get(project);
    const family = dev.family || "spi_rgb";
    if (family === "mipi_dsi" && hw.mipi) hw.mipi.deviceId = project.deviceId || "";
    if (family === "matrix_lcd") {
      hw.matrix.cols = dev.cols || hw.matrix.cols;
      hw.matrix.rows = dev.rows || hw.matrix.rows;
    }
    if (dev.i2cAddr !== undefined && hw.oled) hw.oled.addr = dev.i2cAddr;
    if (hw.oled && dev.defaultOledPanelVariant) hw.oled.panelVariant = dev.defaultOledPanelVariant;
    if (family === "mipi_dsi") {
      if (dev.defaultBoard) hw.board.target = dev.defaultBoard;
      if (hw.mipi) {
        if (dev.lanes) hw.mipi.laneCount = dev.lanes;
        if (dev.laneMbps) hw.mipi.laneMbps = dev.laneMbps;
        if (dev.dpiClockMhz) hw.mipi.dpiClockMhz = dev.dpiClockMhz;
        if (dev.hsync) hw.mipi.hsync = dev.hsync;
        if (dev.vsync) hw.mipi.vsync = dev.vsync;
        if (dev.hbp) hw.mipi.hbp = dev.hbp;
        if (dev.hfp) hw.mipi.hfp = dev.hfp;
        if (dev.vbp) hw.mipi.vbp = dev.vbp;
        if (dev.vfp) hw.mipi.vfp = dev.vfp;
        if (dev.i2cSda != null) hw.mipi.i2cSda = dev.i2cSda;
        if (dev.i2cScl != null) hw.mipi.i2cScl = dev.i2cScl;
        if (dev.blI2cAddr != null) hw.mipi.blI2cAddr = dev.blI2cAddr;
      }
      const touchKind = dev.touchDriver || dev.defaultTouch;
      if (touchKind && touchKind !== "none") {
        hw.touch.enabled = true;
        hw.touch.kind = touchKind;
      }
      if (dev.touchI2cAddr !== undefined) hw.touch.i2cAddr = dev.touchI2cAddr;
      if (hw.board.target === "esp32p4" && (!hw.board.psramMb || hw.board.psramMb < 8)) {
        hw.board.psramMb = 32;
      }
      if (!project.input) project.input = window.LucarneState.defaultInput();
      project.input.type = "touch";
    }
    if (dev.colorOrder && hw.display) hw.display.colorOrder = dev.colorOrder;
    if (dev.invert !== undefined && hw.display) hw.display.invert = dev.invert;
  }

  function get(project) {
    if (!project.hardware) project.hardware = defaultHardware();
    return project.hardware;
  }

  function migrate(project) {
    if (!project) return project;
    const base = defaultHardware();
    const hw = project.hardware || base;
    if (!hw.spi) hw.spi = base.spi;
    if (!hw.i2c) hw.i2c = base.i2c;
    if (!hw.display) hw.display = base.display;
    if (hw.display.blActiveLow === undefined) hw.display.blActiveLow = false;
    if (!hw.oled) hw.oled = base.oled;
    if (!hw.oled.panelVariant) {
      const dev = deviceDef(project);
      hw.oled.panelVariant = (dev && dev.defaultOledPanelVariant) || "white";
    }
    if (!hw.matrix) hw.matrix = base.matrix;
    if (!hw.mipi) hw.mipi = base.mipi;
    if (!hw.touch) hw.touch = base.touch;
    if (!hw.keyboard) hw.keyboard = base.keyboard;
    if (!hw.sd) hw.sd = base.sd;
    if (!hw.volume) hw.volume = base.volume;
    if (!hw.board) hw.board = base.board;
    if (!hw.board.target) hw.board.target = "esp32s3";
    if (!hw.board.schemeId) hw.board.schemeId = "app3M_fat9M_16MB";
    if (!hw.board.psramMb) hw.board.psramMb = 0;
    const B = window.LucarneBoards;
    if (B && B.isRpBoard && B.isRpBoard(hw.board.target)) {
      hw.board.psramMb = 0;
      hw.board.sramKb = B.defaultSramKb(hw.board.target);
    } else if (hw.board.sramKb == null) {
      hw.board.sramKb = 512;
    }
    if (!hw.hal) hw.hal = base.hal;
    if (hw.hal.preferRichTransitions === undefined) hw.hal.preferRichTransitions = false;
    if (!hw.hal.bufferMode) hw.hal.bufferMode = "auto";
    if (hw.touch.enabled === undefined) hw.touch.enabled = hw.touch.kind && hw.touch.kind !== "none";
    if (hw.keyboard && hw.keyboard.layout === "qwerty") hw.keyboard.layout = "compact";
    if (hw.keyboard && hw.keyboard.layout === "azerty") hw.keyboard.layout = "compact_azerty";
    if (window.LucarneBoards && window.LucarneHardware.syncVolumeFromScheme) {
      const scheme = window.LucarneBoards.getScheme(hw.board.target, hw.board.schemeId);
      if (scheme) window.LucarneHardware.syncVolumeFromScheme(hw, scheme);
    }
    const dev = deviceDef(project);
    if (dev.cols && hw.matrix) hw.matrix.cols = dev.cols;
    if (dev.rows && hw.matrix) hw.matrix.rows = dev.rows;
    project.hardware = hw;
    if (dev && dev.family === "mipi_dsi" && hw.mipi.deviceId !== (project.deviceId || "")) {
      applyDeviceDefaults(project, dev);
    }
    return project;
  }

  function touchBusEnum(kind) {
    if (kind === "dsi") return "lucarne::TouchBus::Dsi";
    if (
      kind === "i2c_ft6336" ||
      kind === "i2c_gt911" ||
      kind === "i2c_gt9271" ||
      kind === "i2c_gt928" ||
      kind === "i2c"
    )
      return "lucarne::TouchBus::I2c";
    return "lucarne::TouchBus::None";
  }

  function displayBusEnum(family) {
    if (family === "oled_mono") return "lucarne::DisplayBus::OledMono";
    if (family === "matrix_lcd") return "lucarne::DisplayBus::MatrixCharacter";
    if (family === "mipi_dsi") return "lucarne::DisplayBus::MipiDsi";
    return "lucarne::DisplayBus::SpiRgb565";
  }

  const MIPI_PANEL_DRIVER_ENUM = {
    HX8394: "lucarne::MipiPanelDriver::Ws5DsiTouchA_Hx8394",
    ILI9881C: "lucarne::MipiPanelDriver::Ili9881c",
    JD9365: "lucarne::MipiPanelDriver::Jd9365",
    EK79007: "lucarne::MipiPanelDriver::Ek79007",
  };

  function mipiPanelDriverEnum(dev) {
    const ic = dev && dev.lcdIc;
    return MIPI_PANEL_DRIVER_ENUM[ic] || "lucarne::MipiPanelDriver::Ws5DsiTouchA_Hx8394";
  }

  const MIPI_TOUCH_CLASS_ENUM = {
    GT911: "lucarne::GT911Touch",
    GT9271: "lucarne::GT9271Touch",
    GT928: "lucarne::GT928Touch",
    FT6336: "lucarne::FT6336Touch",
  };

  function mipiTouchClass(dev) {
    const ic = dev && dev.touchIc;
    return MIPI_TOUCH_CLASS_ENUM[ic] || "lucarne::GT911Touch";
  }

  function normalizeDir(dir) {
    let d = String(dir || "/assets").trim() || "/assets";
    if (!d.startsWith("/")) d = "/" + d;
    while (d.length > 1 && d.endsWith("/")) d = d.slice(0, -1);
    return d;
  }

  function ident(s) {
    return String(s || "").replace(/[^a-zA-Z0-9_]/g, "_");
  }

  function iconRefKey(ref) {
    const safe = ident(String(ref || "").replace(/:/g, "_"));
    if (safe.indexOf("emoji_") === 0) return safe.slice(6);
    return safe;
  }

  function iconRefDir(ref) {
    return "icons/" + iconRefKey(ref);
  }

  function iconFramePath(project, ref, frameIndex, assetsKind) {
    const hw = get(project);
    const root = assetsKind === "volume" ? hw.volume : hw.sd;
    const dir = normalizeDir(root.assetsDir);
    const folder = iconRefDir(ref);
    if (frameIndex === undefined || frameIndex === null) {
      return dir + "/" + folder + "/s";
    }
    const idx = String(frameIndex).padStart(2, "0");
    return dir + "/" + folder + "/f" + idx;
  }

  function sdDevicePath(project, imageId, currentSource) {
    const src = String(currentSource || "").trim();
    if (src) return src;
    const dir = normalizeDir(get(project).sd.assetsDir);
    return dir + "/" + ident(imageId) + ".rgb565";
  }

  function sdExportRelPath(project, imageId) {
    const full = sdDevicePath(project, imageId, "");
    return full.replace(/^\//, "");
  }

  function sdIconStaticPath(project, ref) {
    return iconFramePath(project, ref, null, "sd");
  }

  function sdIconAnimFramePath(project, ref, frameIndex) {
    return iconFramePath(project, ref, frameIndex, "sd");
  }

  function sdIconRgbDevicePath(project, ref, frameIndex) {
    if (frameIndex === undefined || frameIndex === null) return sdIconStaticPath(project, ref) + ".rgb565";
    return sdIconAnimFramePath(project, ref, frameIndex) + ".rgb565";
  }

  function sdIconRgbExportRel(project, ref, frameIndex) {
    return sdIconRgbDevicePath(project, ref, frameIndex).replace(/^\//, "");
  }

  function sdIconAlphaDevicePath(rgbDevicePath) {
    if (!rgbDevicePath) return "";
    if (rgbDevicePath.endsWith(".rgb565")) return rgbDevicePath.slice(0, -7) + ".alpha";
    return rgbDevicePath + ".alpha";
  }

  function sdIconAlphaExportRel(rgbExportRel) {
    if (!rgbExportRel) return "";
    if (rgbExportRel.endsWith(".rgb565")) return rgbExportRel.slice(0, -7) + ".alpha";
    return rgbExportRel + ".alpha";
  }

  function sdManifest(project, sdFiles) {
    const hw = get(project);
    const family = displayFamily(project);
    const lines = [
      "Lucarne SD export",
      "=================",
      "",
      "Copy these files to the SD card (FAT32), keeping paths from the card root:",
      "",
    ];
    (sdFiles || []).forEach((f) => {
      lines.push("  /" + f.name.replace(/\\/g, "/"));
    });
    lines.push("");
    if (family === "spi_rgb" || (family === "oled_mono" && deviceDef(project).bus === "spi")) {
      lines.push("SPI (shared with display): MOSI=" + hw.spi.mosi + " MISO=" + hw.spi.miso + " SCLK=" + hw.spi.sclk);
    } else if (needsSpiBus(project)) {
      lines.push("SPI (SD only): MOSI=" + hw.spi.mosi + " MISO=" + hw.spi.miso + " SCLK=" + hw.spi.sclk);
    }
    lines.push("SD CS=" + hw.sd.cs + " @ " + hw.sd.spiHz + " Hz");
    lines.push("Image assets folder on card: " + normalizeDir(hw.sd.assetsDir));
    if (project.uiSource && project.uiSource.mode === "sd" && project.uiSource.sdPath) {
      lines.push("UI JSON path: " + project.uiSource.sdPath);
    }
    lines.push("");
    lines.push("Use Projet_setup.h from Headers export for bus init and storage mount.");
    return lines.join("\n");
  }

  function volumeDevicePath(project, imageId, currentSource) {
    const src = String(currentSource || "").trim();
    if (src) return src;
    const dir = normalizeDir(get(project).volume.assetsDir);
    return dir + "/" + ident(imageId) + ".rgb565";
  }

  function volumeExportRelPath(project, imageId) {
    const full = volumeDevicePath(project, imageId, "");
    return full.replace(/^\//, "");
  }

  function volumeIconStaticPath(project, ref) {
    return iconFramePath(project, ref, null, "volume");
  }

  function volumeIconAnimFramePath(project, ref, frameIndex) {
    return iconFramePath(project, ref, frameIndex, "volume");
  }

  function volumeIconRgbDevicePath(project, ref, frameIndex) {
    if (frameIndex === undefined || frameIndex === null) return volumeIconStaticPath(project, ref) + ".rgb565";
    return volumeIconAnimFramePath(project, ref, frameIndex) + ".rgb565";
  }

  function volumeIconRgbExportRel(project, ref, frameIndex) {
    return volumeIconRgbDevicePath(project, ref, frameIndex).replace(/^\//, "");
  }

  function volumeIconAlphaExportRel(rgbExportRel) {
    return sdIconAlphaExportRel(rgbExportRel);
  }

  function volumeManifest(project, volFiles) {
    const hw = get(project);
    const vol = hw.volume || {};
    const lines = [
      "Lucarne volume export",
      "=====================",
      "",
      "Upload these files to the internal partition (data/ folder for FFat upload tool):",
      "",
    ];
    (volFiles || []).forEach((f) => {
      lines.push("  /" + f.name.replace(/\\/g, "/"));
    });
    lines.push("");
    lines.push("Filesystem: " + (vol.fs || "fat"));
    lines.push("Partition label: " + (vol.partition || "ffat"));
    if (project.hardware && project.hardware.board && window.LucarneBoards) {
      const prof = window.LucarneBoards.profile(project.hardware);
      lines.push("Arduino partition scheme: " + (prof.schemeLabel || prof.schemeId || ""));
    }
    lines.push("");
    lines.push("1. Tools → Partition Scheme must match Studio (FAT/FFat for nested /assets/ paths).");
    lines.push("2. Copy ONLY the assets/ folder into sketch data/ (do not copy this manifest file).");
    lines.push("3. Upload sketch, then Upload FFAT.");
    lines.push("4. Arduino pack log may show dir_d /spiflash/... — normal; device mounts FFat at /ffat.");
    if ((vol.fs || "fat") === "spiffs") {
      lines.push("WARNING: SPIFFS does not support nested directories — use a FAT partition.");
    }
    lines.push("Assets folder on volume: " + normalizeDir(vol.assetsDir));
    lines.push("");
    lines.push("Use Projet_setup.h for mountVolume() / initStorage().");
    return lines.join("\n");
  }

  function volumeFsKindC(fs) {
    if (fs === "littlefs") return "lucarne::VolumeFsKind::LittleFs";
    if (fs === "spiffs") return "lucarne::VolumeFsKind::Spiffs";
    return "lucarne::VolumeFsKind::Fat";
  }

  function syncVolumeFromScheme(hw, scheme) {
    if (!hw.volume) hw.volume = defaultHardware().volume;
    if (!scheme || !scheme.dataMax) return;
    const label = scheme.dataLabel || "";
    if (!label) return;
    const parts = label.split("/");
    const partName = parts[0] || "ffat";
    const sub = parts[1] || "fat";
    hw.volume.partition = partName;
    if (sub === "fat") hw.volume.fs = "fat";
    else if (sub === "littlefs") hw.volume.fs = "littlefs";
    else if (sub === "spiffs") hw.volume.fs = "spiffs";
    hw.volume.enabled = scheme.dataMax > 0;
  }

  function volumeUploadWarning(hw, scheme) {
    const vol = hw.volume || {};
    const label = scheme && scheme.dataLabel ? scheme.dataLabel : "";
    if (!vol.enabled || !label) return "";
    if (label.indexOf("ffat") >= 0 || label.indexOf("/fat") >= 0) {
      return (
        "Partition uses FAT (" +
        label +
        "). In Arduino IDE use the matching Partition Scheme and Upload FFAT — not SPIFFS data upload (paths like /spiflash/ will fail)."
      );
    }
    if (label.indexOf("spiffs") >= 0) {
      return "SPIFFS cannot create nested folders (/assets/icons/). Use a FAT partition scheme for animated icon exports.";
    }
    return "";
  }

  function colorOrderEnum(v) {
    return v === "BGR" ? "lucarne::ColorOrder::BGR" : "lucarne::ColorOrder::RGB";
  }

  window.LucarneHardware = {
    defaultHardware,
    get,
    migrate,
    resolveHalProfile,
    transitionSupport,
    effectiveTransition,
    runtimeTransition,
    resolveTransitionName,
    boardMemory,
    UI_PROFILES,
    BUFFER_MODES,
    PROFILE_DOC_FR,
    BUFFER_DOC_FR,
    displayFamily,
    deviceDef,
    needsSpiBus,
    applyDeviceDefaults,
    touchBusEnum,
    displayBusEnum,
    mipiPanelDriverEnum,
    mipiTouchClass,
    normalizeDir,
    sdDevicePath,
    sdExportRelPath,
    sdIconStaticPath,
    sdIconAnimFramePath,
    sdIconRgbDevicePath,
    sdIconRgbExportRel,
    sdIconAlphaDevicePath,
    sdIconAlphaExportRel,
    sdManifest,
    volumeFsKindC,
    volumeDevicePath,
    volumeExportRelPath,
    volumeIconStaticPath,
    volumeIconAnimFramePath,
    volumeIconRgbDevicePath,
    volumeIconRgbExportRel,
    volumeIconAlphaExportRel,
    volumeManifest,
    syncVolumeFromScheme,
    volumeUploadWarning,
    colorOrderEnum,
  };
})();
