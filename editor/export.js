(function () {
  "use strict";

  const R = window.LucarneRender;
  const TS = window.LucarneTextStyle;

  function isTransparentColor(v) {
    return TS && TS.isTransparentColor(v);
  }

  function hexRGB(hex) {
    const h = hex.replace("#", "");
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  }

  function col(hex) {
    const [r, g, b] = hexRGB(hex);
    return "color565(" + r + ", " + g + ", " + b + ")";
  }

  function floatLit(x) {
    let s = String(Number(x) || 0);
    if (!/[.eE]/.test(s)) s += ".0";
    return s + "f";
  }

  function ident(s) {
    return s.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  function cstr(s) {
    return '"' + String(s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }

  function alignEnum(a) {
    if (a === "center") return "TextAlign::Center";
    if (a === "right") return "TextAlign::Right";
    return "TextAlign::Left";
  }

  function clockFormatEnum(f) {
    if (f === "hms") return "lucarne::ClockFormat::Hms";
    if (f === "hm12") return "lucarne::ClockFormat::hm12";
    return "lucarne::ClockFormat::Hm";
  }

  function dateFormatEnum(f) {
    if (f === "ymd") return "lucarne::DateFormat::YmdDash";
    if (f === "mdy") return "lucarne::DateFormat::MdySlash";
    if (f === "dmy_dot") return "lucarne::DateFormat::DmyDot";
    return "lucarne::DateFormat::DmySlash";
  }

  function imageScaleModeEnum(m) {
    if (m === "native") return "lucarne::ImageScaleMode::Native";
    return "lucarne::ImageScaleMode::Fit";
  }

  function dynamicImageStorageEnum(st) {
    if (st === "volume") return "lucarne::ImageStorage::Volume";
    if (st === "flash") return "lucarne::ImageStorage::Flash";
    if (st === "web") return "lucarne::ImageStorage::Web";
    return "lucarne::ImageStorage::Sd";
  }

  function textFieldKindEnum(kind) {
    const k = String(kind || "text");
    if (k === "numeric") return "TextField::Kind::Numeric";
    if (k === "integer") return "TextField::Kind::Integer";
    if (k === "hex") return "TextField::Kind::Hex";
    if (k === "password") return "TextField::Kind::Password";
    return "TextField::Kind::Text";
  }

  function halBackendEnum(id) {
    const k = String(id || "auto").toLowerCase();
    if (k === "espidf" || k === "esp_idf") return "lucarne::HalBackend::EspIdf";
    if (k === "stm32cube" || k === "stm32") return "lucarne::HalBackend::Stm32Cube";
    if (k === "wch") return "lucarne::HalBackend::Wch";
    if (k === "arduino") return "lucarne::HalBackend::Arduino";
    return "lucarne::HalBackend::Auto";
  }

  function uiProfileEnum(id) {
    const k = String(id || "lowram").toLowerCase();
    if (k === "tiny") return "lucarne::UiProfile::Tiny";
    if (k === "psram") return "lucarne::UiProfile::Psram";
    if (k === "mipihighres") return "lucarne::UiProfile::MipiHighRes";
    return "lucarne::UiProfile::LowRam";
  }

  function resolvedHal(project, family) {
    if (window.LucarneHardware && window.LucarneHardware.resolveHalProfile) {
      return window.LucarneHardware.resolveHalProfile(project, family);
    }
    return {
      backend: "auto",
      uiProfile: "LowRam",
      stripeLines: 10,
      allowRichTransitions: false,
      preferRichTransitions: false,
      preferHwRotate: true,
      jpegDecodeHw: false,
      bufferMode: family === "oled_mono" || family === "matrix_lcd" ? "None" : "Partial",
      partialLineCount: 10,
      maxBytes: 0,
      psram: false,
    };
  }

  function emitHalProfile(p, project, family) {
    const prof = resolvedHal(project, family);
    p("inline lucarne::HalProfile halProfile() {");
    p("    lucarne::HalProfile h;");
    p("    h.backend = " + halBackendEnum(prof.backend) + ";");
    p("    h.uiProfile = " + uiProfileEnum(prof.uiProfile) + ";");
    p("    h.stripeLines = " + (prof.stripeLines | 0) + ";");
    p("    h.allowRichTransitions = " + (prof.allowRichTransitions ? "true" : "false") + ";");
    p("    h.preferRichTransitions = " + (prof.preferRichTransitions ? "true" : "false") + ";");
    p("    h.preferHwRotate = " + (prof.preferHwRotate ? "true" : "false") + ";");
    p("    h.jpegDecodeHw = " + (prof.jpegDecodeHw ? "true" : "false") + ";");
    p("    return h;");
    p("}");
    p("");
  }

  function bufferModeEnum(mode) {
    if (mode === "None") return "lucarne::BufferMode::None";
    if (mode === "Partial") return "lucarne::BufferMode::Partial";
    return "lucarne::BufferMode::Full";
  }

  function emitDisplayBufferOptions(p, project, family) {
    const prof = resolvedHal(project, family);
    p("inline lucarne::BufferOptions displayBufferOptions() {");
    p("    lucarne::BufferOptions buffer;");
    p("    buffer.mode = " + bufferModeEnum(prof.bufferMode) + ";");
    if (family === "mipi_dsi" || prof.psram) {
      p("    buffer.memory = lucarne::BufferMemory::Psram;");
    } else {
      p("    buffer.memory = lucarne::BufferMemory::Internal;");
    }
    if (prof.maxBytes > 0) p("    buffer.maxBytes = " + (prof.maxBytes >>> 0) + "UL;");
    if (prof.bufferMode === "Partial") p("    buffer.partialLineCount = " + (prof.partialLineCount | 0) + ";");
    p("    buffer.hal = halProfile();");
    p("    return buffer;");
    p("}");
    p("");
  }

  function kbLayoutEnum(id) {
    const norm = window.LucarneKeyboard ? window.LucarneKeyboard.normalizeLayout(id) : id || "compact";
    const map = {
      full: "lucarne::KeyboardLayout::Full",
      compact: "lucarne::KeyboardLayout::Compact",
      minimal: "lucarne::KeyboardLayout::Minimal",
      full_azerty: "lucarne::KeyboardLayout::FullAzerty",
      compact_azerty: "lucarne::KeyboardLayout::CompactAzerty",
      minimal_azerty: "lucarne::KeyboardLayout::MinimalAzerty",
      numeric: "lucarne::KeyboardLayout::Numeric",
      hex: "lucarne::KeyboardLayout::Hex",
    };
    return map[norm] || "lucarne::KeyboardLayout::Compact";
  }

  function collectInitKeys(project) {
    const map = new Map();
    (project.keys || []).forEach((k) => {
      if (k && k.name) map.set(k.name, k);
    });
    const add = (name, type, value) => {
      if (!name || map.has(name)) return;
      map.set(name, { name, type, value });
    };
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type === "battery") {
          add(w.key || "battery", "float", 72);
          if (w.chargingKey) add(w.chargingKey, "bool", false);
        } else if (w.type === "clock") {
          if (w.timeKey) add(w.timeKey, "string", "14:30");
          else {
            add(w.hourKey || "hour", "int", 14);
            add(w.minuteKey || "minute", "int", 30);
            if (w.format === "hms" || w.secondKey) add(w.secondKey || "second", "int", 0);
          }
        } else if (w.type === "date") {
          if (w.dateKey) add(w.dateKey, "string", "29/07/2026");
          else {
            add(w.dayKey || "day", "int", 29);
            add(w.monthKey || "month", "int", 7);
            add(w.yearKey || "year", "int", 2026);
          }
        } else if (w.type === "status") {
          if (w.wifiKey) add(w.wifiKey, "bool", true);
          if (w.rssiKey) add(w.rssiKey, "int", -58);
          if (w.bluetoothKey) add(w.bluetoothKey, "bool", false);
        } else if (w.type === "dynamicimage") {
          add(w.pathKey || "img_path", "string", "/assets/cover.rgb565");
        } else if (w.type === "graph") {
          if ((w.mode || "stream") === "stream" && w.key) add(w.key, "float", 50);
          else if (w.mode === "keys" && w.keys) {
            w.keys.forEach((key, i) => {
              if (key) add(key, "float", 20 + i * 8);
            });
          }
        } else if (w.type === "chart" && w.keys) {
          w.keys.forEach((key, i) => {
            if (key) add(key, "float", 20 + i * 8);
          });
        }
      });
    });
    return Array.from(map.values());
  }

  function styleFontCName(LE, theme, fontId) {
    if (!fontId || fontId === "body") return fontCName(LE, theme.fontBodyId);
    if (fontId === "title") return fontCName(LE, theme.fontTitleId);
    return fontCName(LE, fontId);
  }

  function styleHas(style) {
    return window.LucarneTextStyle && window.LucarneTextStyle.has(style);
  }

  function emitStyleBlock(p, v, idx, style, LE, theme, method, exportMap) {
    if (!styleHas(style)) return;
    p("    {");
    p("        TextStyle st;");
    const fn = fontForStyle(exportMap, LE, theme, style);
    if (fn) {
      p("        st.font = &" + fn + ";");
      p("        st.hasFont = true;");
    }
    if (isTransparentColor(style.color)) {
      p("        st.transparent = true;");
    } else if (style.color) {
      p("        st.color = " + col(style.color) + ";");
      p("        st.hasColor = true;");
    }
    if (style.textSize !== undefined && style.textSize !== "") {
      p("        st.size = " + style.textSize + ";");
      p("        st.hasSize = true;");
    }
    if (style.spacing !== undefined && style.spacing !== "") {
      p("        st.spacing = " + style.spacing + ";");
      p("        st.hasSpacing = true;");
    }
    p("        " + v + "." + method + "(" + idx + ", st);");
    p("    }");
  }

  function emitZoneStyle(p, v, prefix, style, LE, theme, exportMap) {
    if (!styleHas(style)) return;
    const fn = fontForStyle(exportMap, LE, theme, style);
    if (fn) p("    " + v + "." + prefix + "Font(&" + fn + ");");
    if (isTransparentColor(style.color)) p("    " + v + "." + prefix + "Transparent(true);");
    else if (style.color) p("    " + v + "." + prefix + "Color(" + col(style.color) + ");");
    if (style.textSize !== undefined && style.textSize !== "") p("    " + v + "." + prefix + "Size(" + style.textSize + ");");
    if (style.spacing !== undefined && style.spacing !== "") p("    " + v + "." + prefix + "Spacing(" + style.spacing + ");");
  }

  function emitLabelStyle(p, v, style, LE, theme, exportMap) {
    if (!styleHas(style)) return;
    const fn = fontForStyle(exportMap, LE, theme, style);
    if (fn) p("    " + v + ".setFont(&" + fn + ");");
    if (isTransparentColor(style.color)) p("    " + v + ".setTextTransparent(true);");
    else if (style.color) p("    " + v + ".setColor(" + col(style.color) + ");");
    if (style.textSize !== undefined && style.textSize !== "") p("    " + v + ".setSize(" + style.textSize + ");");
    if (style.spacing !== undefined && style.spacing !== "") p("    " + v + ".setSpacing(" + style.spacing + ");");
  }

  function fontForStyle(exportMap, LE, theme, style) {
    const TS = window.LucarneTextStyle;
    if (TS && !TS.styleHasFont(style)) return null;
    if (TS && exportMap) {
      const name = TS.exportFontCName(LE, theme, style, exportMap);
      if (name) return name;
    }
    if (style && style.fontId) return styleFontCName(LE, theme, style.fontId);
    return null;
  }

  function transEnum(t, project) {
    let name = t && t !== "Inherit" ? t : "Inherit";
    const H = window.LucarneHardware;
    if (project && name !== "Inherit" && H && H.effectiveTransition) name = H.effectiveTransition(project, name);
    return "Transition::" + name;
  }

  function resolvedTheme(project, screen) {
    if (!screen || !screen.theme) return project.theme;
    return Object.assign({}, project.theme, screen.theme);
  }

  function emitMakeTheme(p, fnName, theme, LE) {
    const bodyFont = fontCName(LE, theme.fontBodyId);
    const titleFont = fontCName(LE, theme.fontTitleId);
    p("inline Theme " + fnName + "() {");
    p("    Theme t;");
    p("    t.background = " + col(theme.background) + ";");
    p("    t.surface = " + col(theme.surface) + ";");
    p("    t.surfaceEdge = " + col(theme.surfaceEdge) + ";");
    p("    t.text = " + col(theme.text) + ";");
    p("    t.textDim = " + col(theme.textDim) + ";");
    p("    t.primary = " + col(theme.primary) + ";");
    p("    t.success = " + col(theme.success) + ";");
    p("    t.warning = " + col(theme.warning) + ";");
    p("    t.danger = " + col(theme.danger) + ";");
    p("    t.radius = " + theme.radius + ";");
    p("    t.padding = " + theme.padding + ";");
    p("    t.rowHeight = " + theme.rowHeight + ";");
    p("    t.textSize = " + theme.textSize + ";");
    if (bodyFont) p("    t.font = &" + bodyFont + ";");
    if (titleFont) p("    t.fontTitle = &" + titleFont + ";");
    p("    return t;");
    p("}");
  }

  function fontCName(LE, id) {
    const f = LE.project.fonts[id];
    if (!f) return null;
    return f.builtin ? f.cName : "Font_" + ident(id);
  }

  function collectUsedCodepoints(project) {
    const U = window.LucarneUtf8;
    if (U) return U.collectProjectCodepoints(project);
    const set = new Set();
    for (let c = 32; c <= 126; c++) set.add(c);
    return set;
  }

  function fontExportLast(used) {
    const U = window.LucarneUtf8;
    if (U) return U.fontExportLast(used);
    let last = 126;
    used.forEach((c) => {
      if (c > last && c <= 255) last = c;
    });
    return last;
  }

  function bakeExportFont(family, sizePx, weight, exportLast) {
    return window.LucarneFonts.bake(family, sizePx, weight || 400, 32, exportLast);
  }

  function buildFontsHeader(LE) {
    const project = LE.project;
    const theme = project.theme;
    const used = collectUsedCodepoints(project);
    const exportLast = fontExportLast(used);
    let body = "";
    let count = 0;
    let flashFonts = 0;
    const emitted = new Set();
    Object.keys(project.fonts).forEach((id) => {
      const f = project.fonts[id];
      if (f.builtin) return;
      const family = f.googleName || f.family;
      if (!family) return;
      const atlas = bakeExportFont(family, f.sizePx, f.weight, exportLast);
      body += "// Font: " + (f.label || id) + " (" + family + " " + f.sizePx + "px, 32-" + exportLast + ")\n";
      body += window.LucarneFonts.toC("Font_" + ident(id), atlas);
      if (window.LucarneAssets && window.LucarneAssets.flashBytesFont) flashFonts += window.LucarneAssets.flashBytesFont(atlas);
      emitted.add(family + "|" + f.sizePx + "|" + (f.weight || 400));
      count++;
    });
    if (TS) {
      const specs = TS.collectExportSpecs(LE, theme);
      specs.forEach((entry) => {
        if (entry.builtin) return;
        const key = entry.spec.family + "|" + entry.spec.sizePx + "|" + entry.spec.weight;
        if (emitted.has(key)) return;
        if (!entry.spec.family) return;
        const atlas = bakeExportFont(entry.spec.family, entry.spec.sizePx, entry.spec.weight, exportLast);
        body +=
          "// Style font: " +
          entry.spec.family +
          " " +
          entry.spec.sizePx +
          "px w" +
          entry.spec.weight +
          " (32-" +
          exportLast +
          ")\n";
        body += window.LucarneFonts.toC(entry.cName, atlas);
        if (window.LucarneAssets && window.LucarneAssets.flashBytesFont) flashFonts += window.LucarneAssets.flashBytesFont(atlas);
        emitted.add(key);
        count++;
      });
    }
    if (!count) return null;
    let h = "#ifndef PROJET_FONTS_H\n#define PROJET_FONTS_H\n\n";
    h += "#include <Lucarne.h>\n\n";
    h += "namespace lucarne {\n\n";
    h += body;
    h += "}\n\n#endif\n";
    return { content: h, flashBytes: flashFonts, fontCount: count, exportLast: exportLast };
  }

  function buildImagesHeader(LE) {
    const project = LE.project;
    if (!project.images) return null;
    const A = window.LucarneAssets;
    const usage = A && A.collectImageUsage ? A.collectImageUsage(project) : {};
    let body = "";
    let count = 0;
    let flashImages = 0;
    Object.keys(project.images).forEach((id) => {
      const img = project.images[id];
      if (!img) return;
      const st = img.storage || "flash";
      const exportBase = A && A.imageForExport ? A.imageForExport(project, id, usage) : img;
      if (!exportBase) return;
      if (!exportBase.pixels && st !== "sd" && st !== "volume" && st !== "web") return;
      let exportImg = exportBase;
      if (st === "sd" && window.LucarneHardware) {
        exportImg = Object.assign({}, exportBase, {
          source: window.LucarneHardware.sdDevicePath(project, id, exportBase.source),
        });
      } else if (st === "volume" && window.LucarneHardware) {
        exportImg = Object.assign({}, exportBase, {
          source: window.LucarneHardware.volumeDevicePath(project, id, exportBase.source),
        });
      }
      const used = usage[id];
      body += "// Image: " + (img.label || id);
      body += " source " + img.w + "x" + img.h;
      if (used && exportBase.pixels && (exportBase.w !== img.w || exportBase.h !== img.h)) {
        if (used.hasNative && used.cropW > 0) {
          body += " crop export " + exportBase.w + "x" + exportBase.h;
        } else {
          body += " export " + exportBase.w + "x" + exportBase.h;
        }
      }
      body += " (" + st + ")\n";
      body += A.toC("Img_" + ident(id), exportImg);
      if (st === "flash" && exportBase.pixels) {
        flashImages += A.flashBytesImage ? A.flashBytesImage(exportBase) : exportBase.w * exportBase.h * 2;
      }
      count++;
    });
    if (!count) return null;
    let h = "#ifndef PROJET_IMAGES_H\n#define PROJET_IMAGES_H\n\n";
    h += "#include <Lucarne.h>\n\n";
    h += "namespace lucarne {\n\n";
    h += body;
    h += "}\n\n#endif\n";
    return { content: h, flashBytes: flashImages, imageCount: count };
  }

  function buildStorageConfigHeader(LE) {
    const hw = window.LucarneHardware ? window.LucarneHardware.get(LE.project) : null;
    if (!hw) return null;
    const sdOn = hw.sd && hw.sd.enabled;
    const vol = hw.volume || {};
    const volOn = vol.enabled;
    const volFs = vol.fs || "fat";
    const lines = [];
    const p = (s) => lines.push(s);
    p("#ifndef LUCARNE_USER_CONFIG_H");
    p("#define LUCARNE_USER_CONFIG_H");
    p("");
    p("#define LUCARNE_ENABLE_SD " + (sdOn ? "1" : "0"));
    p("#define LUCARNE_ENABLE_VOLUME_FAT " + (volOn && volFs === "fat" ? "1" : "0"));
    p("#define LUCARNE_ENABLE_VOLUME_LITTLEFS " + (volOn && volFs === "littlefs" ? "1" : "0"));
    p("#define LUCARNE_ENABLE_VOLUME_SPIFFS " + (volOn && volFs === "spiffs" ? "1" : "0"));
    const volAny = volOn && (volFs === "fat" || volFs === "littlefs" || volFs === "spiffs");
    p("#define LUCARNE_ENABLE_VOLUME " + (volAny ? "1" : "0"));
    p("");
    p("#endif");
    return lines.join("\n");
  }

  function buildSetupHeader(LE) {
    const project = LE.project;
    const H = window.LucarneHardware;
    const hw = H ? H.get(project) : null;
    if (!hw) return null;
    const dev = window.LucarneState ? window.LucarneState.device(project) : { driver: "ST7789", family: "spi_rgb" };
    const family = H.displayFamily ? H.displayFamily(project) : "spi_rgb";
    const spi = hw.spi;
    const d = hw.display;
    const sd = hw.sd;
    const vol = hw.volume || {};
    const i2c = hw.i2c || {};
    const oled = hw.oled || {};
    const matrix = hw.matrix || {};
    const mipi = hw.mipi || {};
    const touch = hw.touch || {};
    const kb = hw.keyboard || {};
    const pw = project.panelWidth > 0 ? project.panelWidth : dev.w || 240;
    const ph = project.panelHeight > 0 ? project.panelHeight : dev.h || 280;
    const pin = (v) => (v === undefined || v === null || v === "" ? -1 : v | 0);
    const co = H.colorOrderEnum(d.colorOrder);
    const busEnum = H.displayBusEnum ? H.displayBusEnum(family) : "lucarne::DisplayBus::SpiRgb565";
    const lines = [];
    const p = (s) => lines.push(s);
    const needsSpi = H.needsSpiBus ? H.needsSpiBus(project) : true;

    p("#ifndef PROJET_SETUP_H");
    p("#define PROJET_SETUP_H");
    p("");
    p('#include "LucarneUserConfig.h"');
    p("#include <LucarneStorageConfig.h>");
    if (needsSpi) p("#include <SPI.h>");
    if (family === "oled_mono" && dev.bus !== "spi") p("#include <Wire.h>");
    if (sd.enabled) p("#if LUCARNE_ENABLE_SD");
    if (sd.enabled) p("#include <SD.h>");
    if (sd.enabled) p("#endif");
    p("#include <Lucarne.h>");
    p("");
    p("namespace projet {");
    p("");
    if (family === "mipi_dsi" && dev.panelId) {
      p("// Waveshare panel: " + dev.panelId);
      if (dev.lcdIc) p("// LCD controller: " + dev.lcdIc);
      if (dev.touchIc) p("// Touch controller: " + dev.touchIc + " (I2C)");
      if (dev.idfDriver) p("// ESP-IDF: idf.py add-dependency \"waveshare/" + dev.idfDriver + "\"");
      if (dev.p4Rev === "v3.x") p("// ESP32-P4 chip revision v3.0+ required");
      p("");
    }

    const isRpTarget = window.LucarneBoards && window.LucarneBoards.isRpBoard && window.LucarneBoards.isRpBoard(hw.board && hw.board.target);
    if (needsSpi) {
      p("inline void initSpiBus() {");
      if (isRpTarget) {
        p("    SPI.setSCK(" + pin(spi.sclk) + ");");
        p("    SPI.setTX(" + pin(spi.mosi) + ");");
        if (pin(spi.miso) >= 0) p("    SPI.setRX(" + pin(spi.miso) + ");");
        p("    SPI.begin();");
      } else {
        p("    SPI.end();");
        p("    delay(10);");
        p(
          "    SPI.begin(" +
            pin(spi.sclk) +
            ", " +
            pin(spi.miso) +
            ", " +
            pin(spi.mosi) +
            ", " +
            (sd.enabled ? pin(sd.cs) : -1) +
            ");"
        );
      }
      p("}");
      p("");
    }

    emitHalProfile(p, project, family);

    if (family === "oled_mono" && dev.bus !== "spi") {
      p("inline void initI2cBus() {");
      if (isRpTarget) {
        p("    Wire.setSDA(" + (i2c.sda | 0) + ");");
        p("    Wire.setSCL(" + (i2c.scl | 0) + ");");
        p("    Wire.begin();");
        p("    Wire.setClock(" + (i2c.hz || 400000) + ");");
      } else {
        p("    Wire.begin(" + (i2c.sda | 0) + ", " + (i2c.scl | 0) + ", " + (i2c.hz || 400000) + ");");
      }
      p("}");
      p("");
      p("inline lucarne::I2cDisplayPins oledPins() {");
      p("    lucarne::I2cDisplayPins pins;");
      p("    pins.sda = " + (i2c.sda | 0) + ";");
      p("    pins.scl = " + (i2c.scl | 0) + ";");
      p("    pins.rst = " + pin(oled.rst) + ";");
      p("    pins.addr = 0x" + ((oled.addr || 0x3c) >>> 0).toString(16) + ";");
      p("    return pins;");
      p("}");
      p("");
    } else if (family === "matrix_lcd") {
      p("inline lucarne::MatrixDisplayPins matrixPins() {");
      p("    lucarne::MatrixDisplayPins pins;");
      p("    pins.rs = " + pin(matrix.rs) + ";");
      p("    pins.en = " + pin(matrix.en) + ";");
      p("    pins.d4 = " + pin(matrix.d4) + ";");
      p("    pins.d5 = " + pin(matrix.d5) + ";");
      p("    pins.d6 = " + pin(matrix.d6) + ";");
      p("    pins.d7 = " + pin(matrix.d7) + ";");
      p("    pins.rw = " + pin(matrix.rw) + ";");
      p("    pins.bl = " + pin(matrix.bl) + ";");
      p("    return pins;");
      p("}");
      p("");
      p("inline lucarne::MatrixDisplayOptions matrixOptions() {");
      p("    lucarne::MatrixDisplayOptions options;");
      p("    options.cols = " + (matrix.cols || dev.cols || 16) + ";");
      p("    options.rows = " + (matrix.rows || dev.rows || 2) + ";");
      p("    options.charWidth = " + (dev.charW || 8) + ";");
      p("    options.charHeight = " + (dev.charH || 8) + ";");
      p("    return options;");
      p("}");
      p("");
    } else if (family === "mipi_dsi") {
      const driverEnum =
        H.mipiPanelDriverEnum && dev.lcdIc
          ? H.mipiPanelDriverEnum(dev)
          : "lucarne::MipiPanelDriver::Ws5DsiTouchA_Hx8394";
      const MIPI_DEV_KEY = { laneCount: "lanes" };
      const mipiVal = (key, fallback) => {
        if (mipi && mipi[key] != null && mipi[key] !== "") return mipi[key];
        const devKey = MIPI_DEV_KEY[key] || key;
        if (dev && dev[devKey] != null) return dev[devKey];
        return fallback;
      };
      p("inline lucarne::MipiDisplayConfig mipiConfig() {");
      p("    lucarne::MipiDisplayConfig cfg;");
      p("    cfg.panelWidth = " + pw + ";");
      p("    cfg.panelHeight = " + ph + ";");
      p("    cfg.driver = " + driverEnum + ";");
      p("    cfg.laneCount = " + (mipiVal("laneCount", 2) | 0) + ";");
      p("    cfg.laneMbps = " + (mipiVal("laneMbps", 700) | 0) + ";");
      p("    cfg.dpiClockMhz = " + (mipiVal("dpiClockMhz", 58) | 0) + ";");
      p("    cfg.hsync = " + (mipiVal("hsync", 20) | 0) + ";");
      p("    cfg.hbp = " + (mipiVal("hbp", 20) | 0) + ";");
      p("    cfg.hfp = " + (mipiVal("hfp", 40) | 0) + ";");
      p("    cfg.vsync = " + (mipiVal("vsync", 4) | 0) + ";");
      p("    cfg.vbp = " + (mipiVal("vbp", 10) | 0) + ";");
      p("    cfg.vfp = " + (mipiVal("vfp", 24) | 0) + ";");
      p("    cfg.i2cSda = " + (mipiVal("i2cSda", 7) | 0) + ";");
      p("    cfg.i2cScl = " + (mipiVal("i2cScl", 8) | 0) + ";");
      p("    cfg.blI2cAddr = 0x" + (mipiVal("blI2cAddr", 0x45) >>> 0).toString(16) + ";");
      p("    return cfg;");
      p("}");
      p("");
      emitDisplayBufferOptions(p, project, family);
    } else {
      p("inline lucarne::DisplayPins displayPins() {");
      p("    lucarne::DisplayPins pins;");
      p("    pins.cs = " + pin(d.cs) + ";");
      p("    pins.dc = " + pin(d.dc) + ";");
      p("    pins.rst = " + pin(d.rst) + ";");
      p("    pins.mosi = " + pin(spi.mosi) + ";");
      p("    pins.miso = " + pin(spi.miso) + ";");
      p("    pins.sclk = " + pin(spi.sclk) + ";");
      p("    pins.bl = " + pin(d.bl) + ";");
      p("    return pins;");
      p("}");
      p("");
      emitDisplayBufferOptions(p, project, family);
    }

    p("inline lucarne::DisplayOptions displayOptions() {");
    p("    lucarne::DisplayOptions options;");
    p("    options.panelWidth = " + pw + ";");
    p("    options.panelHeight = " + ph + ";");
    const rotOut = family === "oled_mono" && oled.flipVertical ? ((project.rotation | 0) ^ 2) & 3 : project.rotation | 0;
    p("    options.rotation = " + rotOut + ";");
    p("    options.bus = " + busEnum + ";");
    if (family === "spi_rgb" || (family === "oled_mono" && dev.bus === "spi")) {
      p("    options.spiHz = " + (d.spiHz | 0) + ";");
      p("    options.spiMode = " + (d.spiMode | 0) + ";");
      p("    options.colorOrder = " + co + ";");
    }
    if (family === "oled_mono") {
      p("    options.invert = " + (oled.invert ? "true" : "false") + ";");
    } else if (family === "spi_rgb") {
      p("    options.invert = " + (d.invert ? "true" : "false") + ";");
    }
    p("    options.blActiveLow = " + (d.blActiveLow ? "true" : "false") + ";");
    p("    return options;");
    p("}");
    p("");

    if (touch.enabled && touch.kind && touch.kind !== "none") {
      const touchBus = H.touchBusEnum ? H.touchBusEnum(touch.kind) : "lucarne::TouchBus::None";
      const rot = project.rotation | 0;
      let touchSwapXY = touch.swapXY;
      let touchInvertX = touch.invertX;
      let touchInvertY = touch.invertY;
      if (family === "mipi_dsi" && (rot === 1 || rot === 3)) {
        touchSwapXY = true;
        if (rot === 3) {
          touchInvertX = true;
          touchInvertY = true;
        }
      }
      p("inline lucarne::TouchConfig touchConfig() {");
      p("    lucarne::TouchConfig cfg;");
      p("    cfg.bus = " + touchBus + ";");
      p("    cfg.i2cAddr = " + (touch.i2cAddr || 0x38) + ";");
      p("    cfg.intPin = " + pin(touch.intPin) + ";");
      p("    cfg.rstPin = " + pin(touch.rstPin) + ";");
      p("    cfg.swapXY = " + (touchSwapXY ? "true" : "false") + ";");
      p("    cfg.invertX = " + (touchInvertX ? "true" : "false") + ";");
      p("    cfg.invertY = " + (touchInvertY ? "true" : "false") + ";");
      p("    return cfg;");
      p("}");
      p("");
      const MIPI_TOUCH_KIND_TO_IC = {
        i2c_gt911: "GT911",
        i2c_gt9271: "GT9271",
        i2c_gt928: "GT928",
        i2c_ft6336: "FT6336",
      };
      const mipiTouchIc = MIPI_TOUCH_KIND_TO_IC[touch.kind] || dev.touchIc;
      const mipiTouchClass =
        family === "mipi_dsi" && mipiTouchIc && H.mipiTouchClass
          ? H.mipiTouchClass({ touchIc: mipiTouchIc })
          : null;
      if (family === "mipi_dsi" && mipiTouchClass) {
        const varName = "s_" + mipiTouchIc.toLowerCase();
        p("#if defined(SOC_MIPI_DSI_SUPPORTED) && SOC_MIPI_DSI_SUPPORTED");
        p("static " + mipiTouchClass + " " + varName + ";");
        p("static bool s_touchReady = false;");
        p("");
        p("inline void panelToLogical(int16_t px, int16_t py, int16_t &lx, int16_t &ly) {");
        p("    const lucarne::DisplayOptions opts = displayOptions();");
        p("    const int16_t pw = opts.panelWidth;");
        p("    const int16_t ph = opts.panelHeight;");
        p("    switch (opts.rotation & 3) {");
        p("    case 1:");
        p("        lx = py;");
        p("        ly = (int16_t)(pw - 1 - px);");
        p("        break;");
        p("    case 2:");
        p("        lx = (int16_t)(pw - 1 - px);");
        p("        ly = (int16_t)(ph - 1 - py);");
        p("        break;");
        p("    case 3:");
        p("        lx = (int16_t)(ph - 1 - py);");
        p("        ly = px;");
        p("        break;");
        p("    default:");
        p("        lx = px;");
        p("        ly = py;");
        p("        break;");
        p("    }");
        p("}");
        p("");
        p("inline bool initTouch(lucarne::MipiDisplay &display) {");
        p("    const lucarne::MipiDisplayConfig panel = mipiConfig();");
        p("    lucarne::TouchConfig cfg = touchConfig();");
        p("    cfg.swapXY = false;");
        p("    s_touchReady = " + varName + ".begin(cfg, panel.panelWidth, panel.panelHeight,");
        p("        panel.i2cSda, panel.i2cScl, display.i2cBus());");
        p("    if (s_touchReady) Serial.println(F(\"Lucarne: " + mipiTouchIc + " touch ready\"));");
        p("    else Serial.println(F(\"Lucarne: " + mipiTouchIc + " touch init failed\"));");
        p("    return s_touchReady;");
        p("}");
        p("");
        p("inline " + mipiTouchClass + " &touchDevice() { return " + varName + "; }");
        p("#else");
        p("inline bool initTouch(lucarne::MipiDisplay &display) {");
        p("    (void)display;");
        p("    return false;");
        p("}");
        p("#endif");
        p("");
      } else {
        p("inline bool initTouch(lucarne::TouchInput &input) {");
        p("    (void)input;");
        p("    // " + touch.kind + " has no driver in Lucarne yet (GT911, GT9271, GT928 and");
        p("    // FT6336 are implemented, see src/input/LucarneTouch*.h) - this always");
        p("    // reports \"not ready\".");
        p("    return false;");
        p("}");
        p("");
      }
    }

    if (kb.enabled || (project.input && project.input.virtualKeyboard)) {
      p("inline lucarne::VirtualKeyboardOptions keyboardOptions() {");
      p("    lucarne::VirtualKeyboardOptions opts;");
      p("    opts.enabled = true;");
      p("    opts.dock = " + (kb.dock === "top" ? "1" : "0") + ";");
      p("    opts.layout = " + kbLayoutEnum(kb.layout) + ";");
      p("    return opts;");
      p("}");
      p("// Call once in setup(), after both Projet.h and Projet_setup.h are included:");
      p("//   ui.configureKeyboard(projet::keyboardOptions());");
      p("");
    }

    if (sd.enabled) {
      p("inline bool mountSdCard() {");
      p("#if LUCARNE_ENABLE_SD");
      p("    return SD.begin(" + (sd.cs | 0) + ", SPI, " + (sd.spiHz | 0) + ");");
      p("#else");
      p("    return false;");
      p("#endif");
      p("}");
      p("");
    }
    if (vol.enabled) {
      const kind =
        H && H.volumeFsKindC
          ? H.volumeFsKindC(vol.fs || "fat")
          : vol.fs === "littlefs"
            ? "lucarne::VolumeFsKind::LittleFs"
            : vol.fs === "spiffs"
              ? "lucarne::VolumeFsKind::Spiffs"
              : "lucarne::VolumeFsKind::Fat";
      const label = cstr(vol.partition || "ffat");
      p("inline bool mountVolume() {");
      p("    return lucarne::mountVolume(" + kind + ", " + label + ");");
      p("}");
      p("");
    }
    if (sd.enabled || vol.enabled) {
      p("inline bool initStorage() {");
      p("    bool ok = true;");
      if (needsSpi && sd.enabled) {
        p("    initSpiBus();");
      }
      if (sd.enabled) {
        p("#if LUCARNE_ENABLE_SD");
        p("    if (!mountSdCard()) {");
        p('        Serial.println(F("Lucarne: SD mount failed (check CS/wiring/FAT32)"));');
        p("        ok = false;");
        p("    } else {");
        p('        Serial.println(F("Lucarne: SD mounted"));');
        p("    }");
        p("#endif");
      }
      if (vol.enabled) {
        p("#if LUCARNE_ENABLE_VOLUME");
        p("    if (!mountVolume()) {");
        p("        ok = false;");
        p("    }");
        p("#endif");
      }
      p("    return ok;");
      p("}");
      p("");
    }
    p("}  // namespace projet");
    p("");
    p("#endif");
    return lines.join("\n");
  }

  function packFlashIcon(icon, ref) {
    if (window.LucarneAssets && window.LucarneAssets.packIconForFlash) {
      return window.LucarneAssets.packIconForFlash(icon, ref);
    }
    if (icon && icon.rows) return { rows: icon.rows };
    return icon;
  }

  function normIconStorage(st, project) {
    const d = project.iconExportStorage || "flash";
    const v = st || d;
    if (v === "ffat" || v === "internal") return "volume";
    return v;
  }

  function collectIconJobs(project) {
    const jobs = [];
    function push(ref, storage, key, opaqueBake) {
      if (!ref || ref === "none") return;
      jobs.push({
        ref: ref,
        storage: normIconStorage(storage, project),
        key: key,
        opaqueBake: !!opaqueBake,
      });
    }
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type === "icon") push(w.icon, w.iconStorage, w.id, w.opaqueBake);
        if (w.type === "button" && w.icon && w.icon !== "none") push(w.icon, w.iconStorage, w.id);
        if (w.type === "menu") {
          (w.items || []).forEach((it) => {
            push(it.icon, it.iconStorage, w.id + ":" + it.id);
            const ri = it.rightIcon;
            if (ri && ri !== "none" && ri !== "auto") push(ri, it.rightIconStorage, w.id + ":r:" + it.id);
          });
        }
      });
    });
    return jobs;
  }

  function assignIconExportRefs(jobs) {
    const exportRefs = {};
    const refStorages = {};
    const byGroup = {};
    jobs.forEach((j) => {
      if (!refStorages[j.ref]) refStorages[j.ref] = new Set();
      refStorages[j.ref].add(j.storage);
      const gk = j.ref + "|" + j.storage;
      if (!byGroup[gk]) byGroup[gk] = [];
      byGroup[gk].push(j);
    });
    jobs.forEach((j) => {
      const needSyn = refStorages[j.ref].size > 1 || byGroup[j.ref + "|" + j.storage].length > 1;
      j.exportRef = needSyn ? j.ref + "@w:" + j.key.replace(/:/g, "_") : j.ref;
      exportRefs[j.key] = j.exportRef;
    });
    return exportRefs;
  }

  function buildIconsHeader(LE) {
    const project = LE.project;
    const H = window.LucarneHardware;
    const A = window.LucarneAssets;
    const OB = window.LucarneOpaqueBake;
    let body = "";
    let count = 0;
    let flashIcons = 0;
    const sdFiles = [];
    const rowDispatch = [];
    const imgDispatch = [];
    const animDispatch = [];
    const widgetExportRefs = {};
    const animExportRefs = new Set();
    let bakeWarnings = OB ? OB.validateOpaqueBake(project, LE).warnings : [];
    const animUsage =
      window.LucarneFluentEmoji && window.LucarneFluentEmoji.collectAnimIconUsage
        ? window.LucarneFluentEmoji.collectAnimIconUsage(project)
        : {};
    const iconJobs = collectIconJobs(project);
    Object.assign(widgetExportRefs, assignIconExportRefs(iconJobs));

    function extOk(st) {
      if (st === "sd") return H && H.get(project).sd.enabled;
      if (st === "volume") return H && H.get(project).volume.enabled;
      return false;
    }

    function pushExtRaster(entry, rgbDevicePath, st) {
      const rgbRel = rgbDevicePath.replace(/^\//, "");
      const bin = A.exportRgb565Bin(entry);
      if (!bin) return;
      const volOk = st === "volume" && extOk("volume");
      const kind = volOk ? "volume" : "sd";
      sdFiles.push({ name: rgbRel, content: bin, binary: true, kind: kind });
      if (entry.alpha) {
        const alphaBin = A.exportAlphaBin(entry);
        if (alphaBin) {
          const alphaRel = volOk ? H.volumeIconAlphaExportRel(rgbRel) : H.sdIconAlphaExportRel(rgbRel);
          sdFiles.push({ name: alphaRel, content: alphaBin, binary: true, kind: kind });
        }
      }
    }

    function iconRgbPath(pathRef, frameIndex, st) {
      if (st === "volume" && extOk("volume")) return H.volumeIconRgbDevicePath(project, pathRef, frameIndex);
      return H.sdIconRgbDevicePath(project, pathRef, frameIndex);
    }

    function addIcon(exportRef, ref, icon, st) {
      if (!icon || animExportRefs.has(exportRef)) return;
      const safe = ident(exportRef.replace(/:/g, "_"));
      const packed = packFlashIcon(icon, ref);
      const sdOk = st === "sd" && extOk("sd");
      const volOk = st === "volume" && extOk("volume");
      const ext = sdOk || volOk;
      const fileSt = volOk ? "volume" : "sd";
      body += "// " + exportRef + (ext && packed && packed.pixels ? " (" + fileSt + ")" : "") + "\n";
      if (packed && packed.rows) {
        const cname = "Ico_" + safe;
        body += A.toIconC(cname, packed);
        rowDispatch.push({ key: exportRef, fn: cname });
        flashIcons += packed.rows.length * 2;
      } else if (packed && packed.pixels) {
        if (ext) {
          const rgbPath = iconRgbPath(exportRef, undefined, st);
          pushExtRaster({ w: packed.w, h: packed.h, pixels: packed.pixels, alpha: packed.alpha }, rgbPath, st);
          const cname = "Ico_" + safe + "_img";
          body += A.toSdC(cname, { w: packed.w, h: packed.h, source: rgbPath }, fileSt);
          imgDispatch.push({ key: exportRef, fn: cname });
        } else {
          const cname = "Ico_" + safe + "_img";
          body += A.toC(cname, {
            w: packed.w,
            h: packed.h,
            pixels: packed.pixels,
            alpha: packed.alpha,
            storage: "flash",
            source: "",
          });
          imgDispatch.push({ key: exportRef, fn: cname });
          flashIcons += (packed.w || 16) * (packed.h || 16) * 2;
          if (packed.alpha) flashIcons += (packed.w || 16) * (packed.h || 16);
        }
      } else if (icon.pixels) {
        if (ext) {
          const rgbPath = iconRgbPath(exportRef, undefined, st);
          pushExtRaster({ w: icon.w, h: icon.h, pixels: icon.pixels, alpha: icon.alpha }, rgbPath, st);
          const cname = "Ico_" + safe + "_img";
          body += A.toSdC(cname, { w: icon.w, h: icon.h, source: rgbPath }, fileSt);
          imgDispatch.push({ key: exportRef, fn: cname });
        } else {
          const cname = "Ico_" + safe + "_img";
          body += A.toC(cname, {
            w: icon.w,
            h: icon.h,
            pixels: icon.pixels,
            alpha: icon.alpha,
            storage: "flash",
            source: "",
          });
          imgDispatch.push({ key: exportRef, fn: cname });
          flashIcons += (icon.w || 16) * (icon.h || 16) * 2;
          if (icon.alpha) flashIcons += (icon.w || 16) * (icon.h || 16);
        }
      } else return;
      count++;
    }

    function addAnimIcon(exportRef, pack, st) {
      if (!pack || !pack.frames || !pack.frames.length) return;
      const safe = ident(exportRef.replace(/:/g, "_"));
      const cname = "Ico_" + safe + "_anim";
      const fw = pack.frames[0] && pack.frames[0].w ? pack.frames[0].w : pack.exportPx || pack.w;
      const fh = pack.frames[0] && pack.frames[0].h ? pack.frames[0].h : fw;
      const sdOk = st === "sd" && extOk("sd");
      const volOk = st === "volume" && extOk("volume");
      const ext = sdOk || volOk;
      const fileSt = volOk ? "volume" : "sd";
      if (ext) {
        const unique = [];
        const frameSources = [];
        for (let i = 0; i < pack.frames.length; i++) {
          const fr = pack.frames[i];
          let ui = -1;
          for (let j = 0; j < unique.length; j++) {
            if (A.framesEqual(fr, unique[j])) {
              ui = j;
              break;
            }
          }
          if (ui < 0) {
            ui = unique.length;
            unique.push(fr);
            const rgbPath = iconRgbPath(exportRef, ui, st);
            pushExtRaster({ w: fr.w || fw, h: fr.h || fh, pixels: fr.pixels, alpha: fr.alpha }, rgbPath, st);
            frameSources.push(rgbPath);
          }
        }
        body += "// " + exportRef + " (" + pack.frames.length + " frames, " + fw + "x" + fh + "px, " + fileSt + ")\n";
        body += A.toAnimIconSdC(cname, pack, frameSources, fileSt);
        flashIcons += A.flashBytesAnimHeader ? A.flashBytesAnimHeader(pack) : pack.frames.length * 14;
      } else {
        body += "// " + exportRef + " (" + pack.frames.length + " frames, " + fw + "x" + fh + "px)\n";
        body += A.toAnimIconC(cname, pack);
        flashIcons += A.flashBytesAnim(pack);
      }
      animDispatch.push({ key: exportRef, fn: cname });
      animExportRefs.add(exportRef);
      count++;
    }

    const resolved = new Set();

    async function resolveJob(job) {
      const exportRef = job.exportRef;
      const ref = job.ref;
      const st = job.storage;
      if (resolved.has(exportRef)) return;
      if (job.opaqueBake && ref.indexOf("emoji:") === 0) return;
      if (OB && OB.refFullyOpaqueBaked(project, LE, ref)) return;
      resolved.add(exportRef);
      if (ref.indexOf("c:") === 0) {
        const id = ref.slice(2);
        const ic = project.icons && project.icons[id];
        if (ic) addIcon(exportRef, ref, window.LucarneAssets.iconAtlas(ic) || ic, st);
        return;
      }
      if (ref.indexOf("emoji:") === 0 && window.LucarneFluentEmoji) {
        if (window.LucarneFluentEmoji.bakeForFlash) {
          const exportPx = animUsage[ref] || 0;
          const animOpts = window.LucarneFluentEmoji.resolveAnimExportOpts
            ? window.LucarneFluentEmoji.resolveAnimExportOpts(project, job.key)
            : {};
          const baked = await window.LucarneFluentEmoji.bakeForFlash(ref, exportPx, animOpts);
          if (baked && baked.frames && baked.frames.length > 1) {
            addAnimIcon(exportRef, baked, st);
            return;
          }
        }
        const ic = window.LucarneFluentEmoji.getIconByRef(ref);
        if (ic && ic.animated) return;
        if (ic) addIcon(exportRef, ref, ic, st);
        return;
      }
      if (window.LucarneIconPacks) {
        const ic = window.LucarneIconPacks.getIcon(ref);
        if (ic) {
          addIcon(exportRef, ref, ic, st);
          return;
        }
      }
      if (ref.indexOf("tabler:") === 0 && window.LucarneTabler) {
        const ic = window.LucarneTabler.getIcon(ref.slice(7));
        if (ic) addIcon(exportRef, ref, ic, st);
      }
    }

    async function resolveOpaquePlacements() {
      if (!OB) return;
      const bakePlacements = OB.collectOpaqueBakePlacements(project, LE);
      if (!bakePlacements.length) return;
      const doneWidgets = new Set();
      const doneSingleRefs = new Set();
      for (let i = 0; i < bakePlacements.length; i++) {
        const p = bakePlacements[i];
        if (doneWidgets.has(p.widgetId)) continue;
        const exportPx = animUsage[p.ref] || p.exportPx;
        const outside = OB.refUsedOutsideIconWidgets(project, p.ref);
        const sameRefCount = bakePlacements.filter((x) => x.ref === p.ref).length;
        const synthetic = outside || sameRefCount > 1;
        const exportRef = synthetic ? OB.bakedExportRef(p.ref, p.widgetId) : p.ref;
        if (!synthetic && doneSingleRefs.has(p.ref)) continue;
        const pack = await OB.bakePlacementOpaque(LE, p, exportPx);
        if (!pack) continue;
        if (synthetic) widgetExportRefs[p.widgetId] = exportRef;
        const w = (project.screens || [])
          .flatMap((s) => s.widgets || [])
          .find((x) => x.id === p.widgetId);
        const st = normIconStorage(w && w.iconStorage, project);
        addAnimIcon(exportRef, pack, st);
        doneWidgets.add(p.widgetId);
        if (!synthetic) doneSingleRefs.add(p.ref);
      }
    }

    const uniqueJobs = [];
    const seen = new Set();
    iconJobs.forEach((j) => {
      if (seen.has(j.exportRef)) return;
      seen.add(j.exportRef);
      uniqueJobs.push(j);
    });

    return Promise.all(uniqueJobs.map((j) => resolveJob(j)))
      .then(() => resolveOpaquePlacements())
      .then(() => {
      if (!count) return null;
      let h = "#ifndef PROJET_ICONS_H\n#define PROJET_ICONS_H\n\n";
      h += "#include <stdint.h>\n";
      h += "#include <Lucarne.h>\n";
      h += "#include <string.h>\n\n";
      h += "namespace projet {\n\n";
      h += body;
      h += "inline const uint16_t *iconRowsByRef(const char *name) {\n";
      h += "    if (!name) return nullptr;\n";
      rowDispatch.forEach((d) => {
        h += '    if (strcmp(name, "' + d.key + '") == 0) return ' + d.fn + "();\n";
      });
      h += "    return nullptr;\n";
      h += "}\n\n";
      h += "inline const lucarne::ImageAsset *iconImageByRef(const char *name) {\n";
      h += "    if (!name) return nullptr;\n";
      imgDispatch.forEach((d) => {
        h += '    if (strcmp(name, "' + d.key + '") == 0) return &' + d.fn + ";\n";
      });
      h += "    return nullptr;\n";
      h += "}\n\n";
      if (animDispatch.length) {
        h += "inline const lucarne::IconAnimAsset *iconAnimByRef(const char *name) {\n";
        h += "    if (!name) return nullptr;\n";
        animDispatch.forEach((d) => {
          h += '    if (strcmp(name, "' + d.key + '") == 0) return &' + d.fn + ";\n";
        });
        h += "    return nullptr;\n";
        h += "}\n\n";
      }
      h += "}  // namespace projet\n\n#endif\n";
      return {
        content: h,
        flashBytes: flashIcons,
        iconCount: count,
        animCount: animDispatch.length,
        sdFiles: sdFiles,
        widgetExportRefs: widgetExportRefs,
        bakeWarnings: bakeWarnings,
      };
    });
  }

  function iconRefExpr(name) {
    if (!name || name === "none") return "nullptr";
    return cstr(name);
  }

  function iconExpr(name) {
    return iconRefExpr(name);
  }

  function exportIconRef(exportRefs, key, fallback) {
    if (exportRefs && exportRefs[key]) return exportRefs[key];
    return fallback;
  }

  function menuItemOptsExpr(it, exportRefs, menuId) {
    const ri = it.rightIcon || "auto";
    const is = it.iconScale > 0 ? R.iconScaleExport(it.iconScale) : 0;
    const bs = it.rightIconScale > 0 ? R.iconScaleExport(it.rightIconScale) : 0;
    const autoRi = ri === "auto" || ri === "";
    const noRi = ri === "none";
    if (autoRi && !is && !bs) return "";
    let badgeArg = "nullptr";
    let hidden = "false";
    if (noRi) hidden = "true";
    else if (!autoRi) badgeArg = iconRefExpr(exportIconRef(exportRefs, menuId + ":r:" + it.id, ri));
    return ", MenuItemOpts{" + badgeArg + ", " + hidden + ", " + is + ", " + bs + "}";
  }

  function actionConst(id) {
    return "ACTION_" + ident(id).toUpperCase();
  }

  function collectCallbacks(project) {
    const map = new Map();
    project.screens.forEach((s) => {
      s.widgets.forEach((w) => {
        if (w.type === "menu") {
          (w.items || []).forEach((it) => {
            if (it.action === "callback" && it.callbackId) {
              const id = ident(it.callbackId);
              if (!map.has(id)) map.set(id, id);
            }
          });
        } else if (w.type === "button" && w.action === "callback" && w.callbackId) {
          const id = ident(w.callbackId);
          if (!map.has(id)) map.set(id, id);
        } else if (w.type === "shape" && w.action === "callback" && w.callbackId) {
          const id = ident(w.callbackId);
          if (!map.has(id)) map.set(id, id);
        }
      });
    });
    return map;
  }

  function widgetExportsCode(w) {
    return w && w.type !== "keyboard";
  }

  function buildHeader(LE, hasFonts, hasImages, hasIcons, hasIconAnim, hasSdAssets, widgetExportRefs) {
    const project = LE.project;
    const H = window.LucarneHardware;
    const dev = window.LucarneState ? window.LucarneState.device(project) : { driver: "ST7789", family: "spi_rgb" };
    const family = H && H.displayFamily ? H.displayFamily(project) : dev.family || "spi_rgb";
    const theme = project.theme;
    const lines = [];
    const p = (s) => lines.push(s);

    p("#ifndef PROJET_H");
    p("#define PROJET_H");
    p("");
    p("#include <Lucarne.h>");
    if (hasFonts) p('#include "Projet_fonts.h"');
    if (hasImages) p('#include "Projet_images.h"');
    if (hasIcons) p('#include "Projet_icons.h"');
    p('#include "Projet_setup.h"');
    p("");
    p("using namespace lucarne;");
    p("");

    const callbacks = collectCallbacks(project);
    const cbIds = Array.from(callbacks.keys());
    const cbMap = {};
    cbIds.forEach((id, i) => {
      cbMap[id] = i + 1;
    });
    if (cbIds.length > 0) {
      p("// Menu actions — read in loop() with ui.pollMenuAction() (constants below)");
      cbIds.forEach((id) => {
        p("static const uint8_t " + actionConst(id) + " = " + cbMap[id] + ";");
      });
      p("");
      p("inline uint8_t pollMenuAction(UI &ui) { return ui.pollMenuAction(); }");
      p("");
    }

    p("namespace projet {");
    p("");

    const bodyFont = fontCName(LE, theme.fontBodyId);
    const titleFont = fontCName(LE, theme.fontTitleId);
    const exportFontMap = window.LucarneTextStyle
      ? window.LucarneTextStyle.collectExportSpecs(LE, theme)
      : null;
    const A = window.LucarneAssets;
    const imgUsage = A && A.collectImageUsage ? A.collectImageUsage(project) : {};

    const varOf = {};
    let n = 0;
    project.screens.forEach((s) => {
      s.widgets.forEach((w) => {
        varOf[w.id] = "w" + n++;
      });
    });

    p("// ---- Widgets ----");
    function iconWidgetRef(w) {
      if (widgetExportRefs && widgetExportRefs[w.id]) return widgetExportRefs[w.id];
      return w.icon;
    }
    function menuItemIconRef(menuId, it) {
      return exportIconRef(widgetExportRefs, menuId + ":" + it.id, it.icon || "none");
    }
    project.screens.forEach((s) => {
      s.widgets.forEach((w) => {
        const v = varOf[w.id];
        if (w.type === "label") {
          p("Label " + v + "(" + w.x + ", " + w.y + ", " + cstr(w.text) + ", " + alignEnum(w.align) + ");");
        } else if (w.type === "metric") {
          p(
            "Metric " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ", " + cstr(w.label) + ", " + cstr(w.key) + ", " + cstr(w.unit || "") + ");"
          );
        } else if (w.type === "bar") {
          p(
            "Bar " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ", " + cstr(w.key) + ", " + floatLit(w.min || 0) + ", " + floatLit(w.max === undefined ? 1 : w.max) + ");"
          );
        } else if (w.type === "icon") {
          p("Icon " + v + "(" + w.x + ", " + w.y + ", " + iconExpr(iconWidgetRef(w)) + ", " + R.iconScaleExport(w.scale || 1) + ");");
        } else if (w.type === "image") {
          const asset = w.imageId ? "&Img_" + ident(w.imageId) : "nullptr";
          const rect =
            A && A.exportImageWidgetRect ? A.exportImageWidgetRect(w, project, imgUsage) : { x: w.x, y: w.y, w: w.w, h: w.h };
          p("Image " + v + "(" + rect.x + ", " + rect.y + ", " + rect.w + ", " + rect.h + ", " + asset + ");");
        } else if (w.type === "menu") {
          p("Menu " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ");");
        } else if (w.type === "button") {
          p("Button " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ", " + cstr(w.label || "Button") + ");");
        } else if (w.type === "shape") {
          p(
            "Shape " +
              v +
              "(" +
              w.x +
              ", " +
              w.y +
              ", " +
              w.w +
              ", " +
              w.h +
              ", " +
              R.shapeKindEnum(w.shape) +
              ");"
          );
        } else if (w.type === "switch") {
          p("Switch " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ", " + cstr(w.label || "") + ", " + cstr(w.key || "") + ");");
        } else if (w.type === "slider") {
          p(
            "Slider " +
              v +
              "(" +
              w.x +
              ", " +
              w.y +
              ", " +
              w.w +
              ", " +
              w.h +
              ", " +
              cstr(w.key || "") +
              ", " +
              floatLit(w.min || 0) +
              ", " +
              floatLit(w.max === undefined ? 100 : w.max) +
              ");"
          );
        } else if (w.type === "chart") {
          p("Chart " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ");");
        } else if (w.type === "graph") {
          p("Graph " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ");");
        } else if (w.type === "gauge") {
          p(
            "Gauge " +
              v +
              "(" +
              w.x +
              ", " +
              w.y +
              ", " +
              w.w +
              ", " +
              w.h +
              ", " +
              cstr(w.label || "") +
              ", " +
              cstr(w.key || "") +
              ", " +
              floatLit(w.min || 0) +
              ", " +
              floatLit(w.max === undefined ? 100 : w.max) +
              ");"
          );
        } else if (w.type === "list") {
          p("List " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ");");
        } else if (w.type === "battery") {
          p(
            "Battery " +
              v +
              "(" +
              w.x +
              ", " +
              w.y +
              ", " +
              w.w +
              ", " +
              w.h +
              ", " +
              cstr(w.key || "battery") +
              ", " +
              (w.showPercent !== false ? "true" : "false") +
              ");"
          );
        } else if (w.type === "clock") {
          p(
            "Clock " +
              v +
              "(" +
              w.x +
              ", " +
              w.y +
              ", " +
              w.w +
              ", " +
              w.h +
              ", " +
              cstr(w.hourKey || "hour") +
              ", " +
              cstr(w.minuteKey || "minute") +
              ", " +
              (w.secondKey ? cstr(w.secondKey) : "nullptr") +
              ", " +
              clockFormatEnum(w.format) +
              ");"
          );
        } else if (w.type === "date") {
          p(
            "Date " +
              v +
              "(" +
              w.x +
              ", " +
              w.y +
              ", " +
              w.w +
              ", " +
              w.h +
              ", " +
              cstr(w.dayKey || "day") +
              ", " +
              cstr(w.monthKey || "month") +
              ", " +
              cstr(w.yearKey || "year") +
              ", " +
              dateFormatEnum(w.format) +
              ");"
          );
        } else if (w.type === "status") {
          p(
            "Status " +
              v +
              "(" +
              w.x +
              ", " +
              w.y +
              ", " +
              w.w +
              ", " +
              w.h +
              ", " +
              cstr(w.wifiKey || "wifi") +
              ", " +
              cstr(w.rssiKey || "rssi") +
              ", " +
              cstr(w.bluetoothKey || "bt") +
              ");"
          );
        } else if (w.type === "dynamicimage") {
          p(
            "DynamicImage " +
              v +
              "(" +
              w.x +
              ", " +
              w.y +
              ", " +
              w.w +
              ", " +
              w.h +
              ", " +
              cstr(w.pathKey || "img_path") +
              ", " +
              dynamicImageStorageEnum(w.storage || "sd") +
              ", " +
              (w.imgW || w.w || 0) +
              ", " +
              (w.imgH || w.h || 0) +
              ");"
          );
        } else if (w.type === "textfield") {
          p("TextField " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ");");
        } else if (w.type === "keyboard") {
          p("// Keyboard " + v + " — touch input Phase 3");
          p("// bounds " + w.x + ", " + w.y + ", " + w.w + ", " + w.h + " layout=" + cstr(w.layout || "compact"));
        }
      });
    });
    p("");

    p("// ---- Screens ----");
    project.screens.forEach((s) => {
      p("Screen screen_" + ident(s.id) + "(" + cstr(s.name || s.id) + ");");
    });
    p("");

    project.screens.forEach((s) => {
      if (s.cornerRadius) {
        p("inline void setupScreen_" + ident(s.id) + "() {");
        p("    screen_" + ident(s.id) + ".setCornerRadius(" + s.cornerRadius + ");");
        p("}");
        p("");
      }
    });

    project.screens.forEach((s) => {
      if (!s.theme) return;
      emitMakeTheme(p, "makeTheme_" + ident(s.id), resolvedTheme(project, s), LE);
      p("");
    });

    emitMakeTheme(p, "makeTheme", project.theme, LE);
    p("");

    const inp = project.input || {};
    if (inp.type === "buttons") {
      p("ButtonInput input;");
    } else if (inp.type === "encoder") {
      p("EncoderInput input;");
    } else if (inp.type === "touch") {
      p("TouchInput input;");
    }
    p("");

    const uiSrc = project.uiSource;
    if (uiSrc && uiSrc.mode === "url" && uiSrc.url) {
      p("// UI source: web — " + uiSrc.url);
    } else if (uiSrc && uiSrc.mode === "sd" && uiSrc.sdPath) {
      p("// UI source: SD — " + uiSrc.sdPath);
    }
    p("");

    p("inline void build(UI &ui) {");
    p("    ui.setTheme(makeTheme());");
    p("    ui.setTransition(" + transEnum(project.transition.default, project) + ", " + (project.transition.durationMs || 220) + ");");
    if (hasIcons) {
      if (hasIconAnim) {
        p("    lucarne::setIconLookups(projet::iconRowsByRef, projet::iconImageByRef, projet::iconAnimByRef);");
      } else {
        p("    lucarne::setIconLookups(projet::iconRowsByRef, projet::iconImageByRef);");
      }
    }
    if (cbIds.length > 0) p("    // Menu callbacks are polled in loop() — see pollMenuAction() below");
    p("");

    project.screens.forEach((s) => {
      if (s.theme) {
        p("    screen_" + ident(s.id) + ".setTheme(makeTheme_" + ident(s.id) + "());");
      }
      const theme = resolvedTheme(project, s);
      s.widgets.forEach((w) => {
        const v = varOf[w.id];
        if (w.type === "label") {
          if (window.LucarneTextStyle) window.LucarneTextStyle.migrateLabelLegacy(w);
          if (w.w > 0 && w.h > 0) p("    " + v + ".setBounds(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ");");
          const labelStyle = window.LucarneTextStyle ? window.LucarneTextStyle.labelStyleForResolve(w) : w.textStyle;
          if (styleHas(labelStyle)) {
            emitLabelStyle(p, v, labelStyle, LE, theme, exportFontMap);
            if (labelStyle.align) p("    " + v + ".setAlign(" + alignEnum(labelStyle.align) + ");");
          } else {
            if (w.font === "title" && titleFont) p("    " + v + ".setFont(&" + titleFont + ");");
            if (isTransparentColor(w.color)) p("    " + v + ".setTextTransparent(true);");
            else if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
            if (w.size) p("    " + v + ".setSize(" + w.size + ");");
            if (w.align) p("    " + v + ".setAlign(" + alignEnum(w.align) + ");");
          }
        } else if (w.type === "metric") {
          if (w.decimals !== undefined) p("    " + v + ".setDecimals(" + w.decimals + ");");
          if (isTransparentColor(w.accent)) p("    " + v + ".clearAccent();");
          else if (w.accent) p("    " + v + ".setAccent(" + col(w.accent) + ");");
          emitZoneStyle(p, v, "setLabel", w.labelStyle, LE, theme, exportFontMap);
          emitZoneStyle(p, v, "setValue", w.valueStyle, LE, theme, exportFontMap);
        } else if (w.type === "bar") {
          if (w.showValue) p("    " + v + ".setShowValue(true);");
          if (isTransparentColor(w.color)) p("    " + v + ".clearColor();");
          else if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
          emitZoneStyle(p, v, "setValue", w.valueStyle, LE, theme, exportFontMap);
        } else if (w.type === "icon") {
          let iw = R.iconWidgetDisplaySize(w, project.icons).w;
          let ih = R.iconWidgetDisplaySize(w, project.icons).h;
          if (w.lockSize || w.scaleMode === "native") {
            if (w.w > 0) iw = w.w;
            if (w.h > 0) ih = w.h;
          }
          p("    " + v + ".setBounds(" + w.x + ", " + w.y + ", " + iw + ", " + ih + ");");
          if (isTransparentColor(w.color)) p("    " + v + ".setTransparent(true);");
          else if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
        } else if (w.type === "image") {
          if (w.scaleMode === "native") p("    " + v + ".setScaleMode(" + imageScaleModeEnum(w.scaleMode) + ");");
        } else if (w.type === "dynamicimage") {
          if (w.scaleMode === "native") p("    " + v + ".setScaleMode(" + imageScaleModeEnum(w.scaleMode) + ");");
        } else if (w.type === "menu") {
          if (w.iconScale && w.iconScale !== 1) p("    " + v + ".setIconScale(" + R.iconScaleExport(w.iconScale) + ");");
          if (w.badgeScale && w.badgeScale !== 1) p("    " + v + ".setBadgeScale(" + R.iconScaleExport(w.badgeScale) + ");");
          if (!isTransparentColor(w.activeFill) && w.activeFill) p("    " + v + ".setActiveFill(" + col(w.activeFill) + ");");
          if (!isTransparentColor(w.activeText) && w.activeText) p("    " + v + ".setActiveText(" + col(w.activeText) + ");");
          if (!isTransparentColor(w.inactiveFill) && w.inactiveFill) p("    " + v + ".setInactiveFill(" + col(w.inactiveFill) + ");");
          if (!isTransparentColor(w.inactiveText) && w.inactiveText) p("    " + v + ".setInactiveText(" + col(w.inactiveText) + ");");
          if (!isTransparentColor(w.inactiveEdge) && w.inactiveEdge) p("    " + v + ".setInactiveEdge(" + col(w.inactiveEdge) + ");");
          emitZoneStyle(p, v, "setText", w.textStyle, LE, theme, exportFontMap);
          let menuIdx = 0;
          (w.items || []).forEach((it) => {
            const opts = menuItemOptsExpr(it, widgetExportRefs, w.id);
            const leftIcon = menuItemIconRef(w.id, it);
            if (it.action === "callback" && it.callbackId) {
              const cid = ident(it.callbackId);
              p(
                "    " +
                  v +
                  ".addCallbackItem(" +
                  cstr(it.label) +
                  ", " +
                  iconExpr(leftIcon) +
                  ", " +
                  (cbMap[cid] || 0) +
                  opts +
                  ");"
              );
            } else {
              const target = it.target ? "&screen_" + ident(it.target) : "nullptr";
              p(
                "    " +
                  v +
                  ".addItem(" +
                  cstr(it.label) +
                  ", " +
                  iconExpr(leftIcon) +
                  ", " +
                  target +
                  ", " +
                  transEnum(it.transition, project) +
                  opts +
                  ");"
              );
            }
            emitStyleBlock(p, v, menuIdx, it.textStyle, LE, theme, "setItemStyle", exportFontMap);
            menuIdx++;
          });
        } else if (w.type === "button") {
          if (w.icon && w.icon !== "none") {
            const btnIcon = exportIconRef(widgetExportRefs, w.id, w.icon);
            p("    " + v + ".setIconRef(" + iconExpr(btnIcon) + ");");
          }
          if (!isTransparentColor(w.fill) && !isTransparentColor(w.textColor)) {
            if (w.fill && w.textColor) p("    " + v + ".setColor(" + col(w.fill) + ", " + col(w.textColor) + ");");
            else if (w.fill) p("    " + v + ".setColor(" + col(w.fill) + ", " + col(theme.background) + ");");
          }
          if (isTransparentColor(w.fill)) p("    " + v + ".setFillTransparent(true);");
          if (isTransparentColor(w.textColor)) p("    " + v + ".setTextColorTransparent(true);");
          emitZoneStyle(p, v, "setText", w.textStyle, LE, theme, exportFontMap);
          if (w.textStyle && w.textStyle.align) p("    " + v + ".setTextAlign(" + alignEnum(w.textStyle.align) + ");");
          if (w.action === "callback" && w.callbackId) {
            p("    " + v + ".setCallback(" + (cbMap[ident(w.callbackId)] || 0) + ");");
          } else if (w.target) {
            p("    " + v + ".setNavigate(&screen_" + ident(w.target) + ", " + transEnum(w.transition, project) + ");");
          }
        } else if (w.type === "shape") {
          if (!isTransparentColor(w.fill)) p("    " + v + ".setFill(" + col(w.fill) + ");");
          if (isTransparentColor(w.fill)) p("    " + v + ".setFillTransparent(true);");
          if (!isTransparentColor(w.stroke)) p("    " + v + ".setStroke(" + col(w.stroke) + ");");
          if (isTransparentColor(w.stroke)) p("    " + v + ".setStrokeTransparent(true);");
          if (w.strokeWidth !== undefined) p("    " + v + ".setStrokeWidth(" + (w.strokeWidth | 0) + ");");
          if (w.group) p("    " + v + ".setGroup(" + cstr(w.group) + ");");
          if (!isTransparentColor(w.activeFill)) p("    " + v + ".setActiveFill(" + col(w.activeFill) + ");");
          if (isTransparentColor(w.activeFill)) p("    " + v + ".clearActiveFill();");
          if (!isTransparentColor(w.activeStroke)) p("    " + v + ".setActiveStroke(" + col(w.activeStroke) + ");");
          if (isTransparentColor(w.activeStroke)) p("    " + v + ".clearActiveStroke();");
          if (!isTransparentColor(w.activeText)) p("    " + v + ".setActiveText(" + col(w.activeText) + ");");
          if (isTransparentColor(w.activeText)) p("    " + v + ".clearActiveText();");
          if (w.label) p("    " + v + ".setLabel(" + cstr(w.label) + ");");
          emitZoneStyle(p, v, "setText", w.textStyle, LE, theme, exportFontMap);
          if (w.action === "callback" && w.callbackId) {
            p("    " + v + ".setCallback(" + (cbMap[ident(w.callbackId)] || 0) + ");");
          } else if (w.target) {
            p("    " + v + ".setNavigate(&screen_" + ident(w.target) + ", " + transEnum(w.transition, project) + ");");
          }
        } else if (w.type === "switch") {
          emitZoneStyle(p, v, "setText", w.textStyle, LE, theme, exportFontMap);
        } else if (w.type === "textfield") {
          if (w.key) p("    " + v + ".setKey(" + cstr(w.key) + ");");
          if (w.label) p("    " + v + ".setLabel(" + cstr(w.label) + ");");
          if (w.placeholder) p("    " + v + ".setPlaceholder(" + cstr(w.placeholder) + ");");
          p("    " + v + ".setMaxLen(" + (w.maxLen || 32) + ");");
          p("    " + v + ".setInputKind(" + textFieldKindEnum(w.inputKind) + ");");
          emitZoneStyle(p, v, "setText", w.textStyle, LE, theme, exportFontMap);
        } else if (w.type === "slider") {
          if (isTransparentColor(w.color)) p("    " + v + ".clearColor();");
          else if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
        } else if (w.type === "chart") {
          (w.keys || []).forEach((key, idx) => {
            if (key) p("    " + v + ".setKey(" + idx + ", " + cstr(key) + ");");
          });
          p("    " + v + ".setRange(" + floatLit(w.min || 0) + ", " + floatLit(w.max === undefined ? 100 : w.max) + ");");
          if (isTransparentColor(w.color)) p("    " + v + ".clearColor();");
          else if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
        } else if (w.type === "graph") {
          p("    " + v + ".setType(" + R.graphTypeEnum(w.graphType || "line") + ");");
          p("    " + v + ".setMode(" + R.graphModeEnum(w.mode || "stream") + ");");
          p("    " + v + ".setRange(" + floatLit(w.min || 0) + ", " + floatLit(w.max === undefined ? 100 : w.max) + ");");
          if (isTransparentColor(w.color)) p("    " + v + ".clearColor();");
          else if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
          if (w.grid === false) p("    " + v + ".setGrid(false);");
          if ((w.mode || "stream") === "stream") {
            p("    " + v + ".setCapacity(" + (w.capacity || 32) + ");");
            if (w.key) {
              p("    " + v + ".setStreamKey(" + cstr(w.key) + ");");
              p("    // " + v + " samples " + cstr(w.key) + " automatically after ui.setFloat() (at most once per 50 ms).");
            }
          } else {
            (w.keys || []).forEach((key, idx) => {
              if (key) p("    " + v + ".setKey(" + idx + ", " + cstr(key) + ");");
            });
          }
        } else if (w.type === "gauge") {
          if (isTransparentColor(w.accent)) p("    " + v + ".clearAccent();");
          else if (w.accent) p("    " + v + ".setAccent(" + col(w.accent) + ");");
          emitZoneStyle(p, v, "setLabel", w.labelStyle, LE, theme, exportFontMap);
          emitZoneStyle(p, v, "setValue", w.valueStyle, LE, theme, exportFontMap);
        } else if (w.type === "battery") {
          if (w.chargingKey) p("    " + v + ".setChargingKey(" + cstr(w.chargingKey) + ");");
          if (w.lowThreshold !== undefined) p("    " + v + ".setLowThreshold(" + (w.lowThreshold | 0) + ");");
        } else if (w.type === "clock") {
          if (w.timeKey) p("    " + v + ".setTimeKey(" + cstr(w.timeKey) + ");");
          emitZoneStyle(p, v, "setText", w.textStyle, LE, theme, exportFontMap);
        } else if (w.type === "date") {
          if (w.dateKey) p("    " + v + ".setDateKey(" + cstr(w.dateKey) + ");");
          emitZoneStyle(p, v, "setText", w.textStyle, LE, theme, exportFontMap);
        } else if (w.type === "list") {
          emitZoneStyle(p, v, "setText", w.textStyle, LE, theme, exportFontMap);
          let listIdx = 0;
          (w.items || []).forEach((it) => {
            p("    " + v + ".addItem(" + cstr(typeof it === "string" ? it : it.label || "") + ");");
            emitStyleBlock(p, v, listIdx, typeof it === "object" ? it.textStyle : null, LE, theme, "setItemStyle", exportFontMap);
            listIdx++;
          });
        }
      });
    });
    p("");

    project.screens.forEach((s) => {
      const sv = "screen_" + ident(s.id);
      s.widgets.forEach((w) => {
        if (!widgetExportsCode(w)) return;
        p("    " + sv + ".add(&" + varOf[w.id] + ");");
      });
      if (s.cornerRadius) p("    setupScreen_" + ident(s.id) + "();");
    });
    p("");

    collectInitKeys(project).forEach((k) => {
      if (k.type === "float") p("    ui.setFloat(" + cstr(k.name) + ", " + floatLit(k.value || 0) + ");");
      else if (k.type === "int") p("    ui.setInt(" + cstr(k.name) + ", " + Math.trunc(k.value || 0) + ");");
      else if (k.type === "bool") p("    ui.setBool(" + cstr(k.name) + ", " + (k.value ? "true" : "false") + ");");
      else if (k.type === "string") p("    ui.setString(" + cstr(k.name) + ", " + cstr(k.value || "") + ");");
    });
    p("");

    let boundCount = 0;
    project.screens.forEach((s) => {
      s.widgets.forEach((w) => {
        if (w.type !== "label" || !w.bindKey || !widgetExportsCode(w)) return;
        const dec = w.bindDecimals === undefined ? 1 : Math.max(0, Math.min(6, w.bindDecimals | 0));
        const unit = w.bindUnit ? cstr(w.bindUnit) : "nullptr";
        p("    ui.bindValue(" + cstr(w.bindKey) + ", &" + varOf[w.id] + ", nullptr, " + dec + ", " + unit + ");");
        boundCount++;
      });
    });
    if (boundCount) p("");

    const start = project.startScreen || (project.screens[0] && project.screens[0].id);
    const startScreen = project.screens.find((s) => s.id === start);
    p("    ui.show(&screen_" + ident(start) + ");");
    if (startScreen && startScreen.splash && startScreen.splash.enabled && startScreen.splash.nextScreen) {
      p(
        "    ui.setSplash(&screen_" +
          ident(startScreen.splash.nextScreen) +
          ", " +
          (startScreen.splash.durationMs || 2000) +
          ", " +
          (startScreen.splash.showProgress !== false ? "true" : "false") +
          ");"
      );
    }
    p("}");
    p("");

    p("inline void attachInput(UI &ui) {");
    if (inp.type === "buttons") {
      const b = inp.buttons || {};
      p(
        "    input.begin(" +
          (b.up | 0) +
          ", " +
          (b.down | 0) +
          ", " +
          (b.ok | 0) +
          ", " +
          (b.back | 0) +
          ", " +
          (b.left === undefined || b.left === null ? -1 : b.left | 0) +
          ", " +
          (b.right === undefined || b.right === null ? -1 : b.right | 0) +
          ", " +
          (inp.activeLow ? "true" : "false") +
          ");"
      );
      p("    input.attach(&ui);");
    } else if (inp.type === "encoder") {
      const e = inp.encoder || {};
      p(
        "    input.begin(" + (e.a | 0) + ", " + (e.b | 0) + ", " + (e.btn | 0) + ", " + (inp.activeLow ? "true" : "false") + ");"
      );
      p("    input.attach(&ui);");
    } else if (inp.type === "touch") {
      p("    input.attach(&ui);");
      if (project.hardware && project.hardware.touch && project.hardware.touch.enabled) {
        if (family === "mipi_dsi") {
          p("    // Call projet::attachInput(ui, display) after display.begin()");
        } else {
          p("    projet::initTouch(input);");
        }
      } else {
        p("    // Call projet::input.feed(x, y, pressed) from your touch driver.");
      }
    } else {
      p("    (void)ui;");
    }
    p("}");
    p("");

    if (family === "mipi_dsi") {
      p("inline void attachInput(UI &ui, lucarne::MipiDisplay &display) {");
      p("    input.attach(&ui);");
      if (project.hardware && project.hardware.touch && project.hardware.touch.enabled) {
        p("    initTouch(display);");
      }
      p("}");
      p("");
    }

    const CK = window.LucarneCalcKeys;
    const calcKeys = CK ? CK.topoOrder(project) : [];
    if (calcKeys.length) {
      p("inline void recomputeCalcs(UI &ui) {");
      calcKeys.forEach((k) => {
        const parsed = CK.tryParse(k.formula || "0");
        const ast = parsed.ok ? parsed.ast : { op: "num", value: 0 };
        const cpp = CK.toCpp(ast, (name) => "ui.store().getFloat(" + cstr(name) + ", 0.0f)");
        p("    ui.setFloat(" + cstr(k.name) + ", " + cpp + ");");
      });
      p("}");
      p("");
    }

    const updateMipiTouchIc =
      (project.hardware &&
        project.hardware.touch &&
        {
          i2c_gt911: "GT911",
          i2c_gt9271: "GT9271",
          i2c_gt928: "GT928",
          i2c_ft6336: "FT6336",
        }[project.hardware.touch.kind]) ||
      dev.touchIc;
    const updateMipiTouchClass =
      updateMipiTouchIc && H.mipiTouchClass ? H.mipiTouchClass({ touchIc: updateMipiTouchIc }) : null;
    p("inline void update() {");
    if (inp.type === "buttons" || inp.type === "encoder") {
      p("    input.update();");
    } else if (
      inp.type === "touch" &&
      family === "mipi_dsi" &&
      project.hardware &&
      project.hardware.touch &&
      project.hardware.touch.enabled &&
      updateMipiTouchClass
    ) {
      p("#if defined(SOC_MIPI_DSI_SUPPORTED) && SOC_MIPI_DSI_SUPPORTED");
      p("    if (s_touchReady) {");
      p("        int16_t px = 0, py = 0;");
      p("        bool pressed = false;");
      p("        if (touchDevice().poll(px, py, pressed)) {");
      p("            int16_t x = 0, y = 0;");
      p("            panelToLogical(px, py, x, y);");
      p("            if (pressed) {");
      p("                Serial.print(F(\"touch x=\"));");
      p("                Serial.print(x);");
      p("                Serial.print(F(\" y=\"));");
      p("                Serial.println(y);");
      p("            }");
      p("            input.feed(x, y, pressed);");
      p("        }");
      p("    }");
      p("#endif");
    } else {
      p("    // Touch input is driven by feed(); nothing to poll.");
    }
    p("}");
    p("");
    if (calcKeys.length) {
      p("// In loop(), before ui.update(), so calc keys reflect this frame's inputs:");
      p("//   projet::recomputeCalcs(ui);");
      p("");
    }
    if (cbIds.length > 0) {
      p("// In loop(), after projet::update() and ui.update():");
      p("//   switch (ui.pollMenuAction()) {");
      cbIds.forEach((id) => {
        p("//     case " + actionConst(id) + ": /* your code */ break;");
      });
      p("//   }");
      p("");
    }

    p("}  // namespace projet");
    p("");
    p("// Usage in your sketch:");
    p("//   #include \"Projet_setup.h\"");
    const devDriver = family === "mipi_dsi" ? "MipiDisplay" : dev.driver || "ST7789";
    p("//   " + devDriver + " display;");
    p("//   UI ui(display);");
    if (family === "oled_mono" && dev.bus !== "spi") {
      p("//   projet::initI2cBus();");
      if (hasSdAssets) p("//   projet::initStorage();  // SPI bus for SD");
      p("//   display.begin(projet::oledPins(), projet::displayOptions());");
    } else if (family === "oled_mono") {
      p("//   projet::initSpiBus();");
      if (hasSdAssets) p("//   projet::initStorage();");
      p("//   display.begin(projet::displayPins(), projet::displayOptions(), &SPI);");
    } else if (family === "matrix_lcd") {
      if (hasSdAssets) p("//   projet::initStorage();");
      p("//   display.begin(projet::matrixPins(), projet::matrixOptions(), projet::displayOptions());");
    } else if (family === "mipi_dsi") {
      if (hasSdAssets) p("//   projet::initStorage();");
      p("//   display.begin(projet::mipiConfig(), projet::displayBufferOptions(), projet::displayOptions().rotation);");
    } else {
      p("//   projet::initSpiBus();");
      if (hasSdAssets) p("//   projet::initStorage();  // before display.begin()");
      p("//   display.begin(projet::displayPins(), projet::displayOptions(), projet::displayBufferOptions(), &SPI);");
    }
    p("//   ui.setHalProfile(projet::halProfile());");
    p("//   projet::build(ui);");
    if (family === "mipi_dsi") {
      p("//   projet::attachInput(ui, display);");
    } else {
      p("//   projet::attachInput(ui);");
    }
    p("//   ui.begin();");
    p("//   void loop() { projet::update(); ui.update(); }");
    p("");
    p("#endif");

    return lines.join("\n");
  }

  function buildInoSketch(LE, hasSdAssets) {
    const project = LE.project;
    const H = window.LucarneHardware;
    if (!H || !project.hardware) return null;
    const dev = window.LucarneState ? window.LucarneState.device(project) : { driver: "ST7789", family: "spi_rgb" };
    const family = H.displayFamily ? H.displayFamily(project) : dev.family || "spi_rgb";
    if (family !== "spi_rgb" && family !== "mipi_dsi" && family !== "oled_mono" && family !== "matrix_lcd") return null;
    const S = window.LucarneState;
    if (S && !S.deviceFirmwareSupported(dev)) return null;

    const CK = window.LucarneCalcKeys;
    const calcKeys = CK ? CK.topoOrder(project) : [];
    const cbIds = Array.from(collectCallbacks(project).keys());
    const kb = (project.hardware.keyboard || {}).enabled || (project.input && project.input.virtualKeyboard);
    const hw = H.get(project);
    const board = hw.board || {};
    const isP4 = family === "mipi_dsi" && board.target === "esp32p4";

    const lines = [];
    const p = (s) => lines.push(s);

    p("// Auto-generated by Lucarne Studio - Export tab.");
    p("// This file only wires the display/UI plumbing described by your project's");
    p("// Hardware tab; your own logic (sensors, callbacks, calc keys) is a TODO below.");
    p("//");
    p("// Rename this file (and its containing sketch folder) to match your project");
    p("// name, e.g. " + (ident(project.name) || "MyProject") + "/" + (ident(project.name) || "MyProject") + ".ino - the Arduino IDE");
    p("// requires the .ino file and its parent folder to share the same name.");
    if (project.moduleId === "phase-zero-s3-24") {
      p("// Board module: Phase Zero S3-24.");
      p("// Arduino IDE: ESP32-S3, PSRAM OPI, flash 16 MB, USB CDC on boot.");
    }
    p("");
    p("#include <Lucarne.h>");
    p('#include "Projet.h"');
    p('#include "Projet_setup.h"');
    p("");
    p("using namespace lucarne;");
    p("");
    if (isP4) {
      p("#ifndef BOARD_HAS_PSRAM");
      p('#error "Enable PSRAM in Tools -> PSRAM before compiling (ESP32-P4 MIPI panels need it for the framebuffer)."');
      p("#endif");
      p("");
    }

    const displayClass = family === "mipi_dsi" ? "MipiDisplay" : dev.driver || "ST7789";
    p(displayClass + " display;");
    p("UI ui(display);");
    p("");
    p("void setup() {");
    p("    Serial.begin(115200);");
    p("    delay(500);");
    p("");
    if (family === "mipi_dsi") {
      if (hasSdAssets) {
        p("    if (!projet::initStorage()) {");
        p('        Serial.println(F("Lucarne: storage mount failed - assets referenced from SD/volume won\'t load"));');
        p("    }");
        p("");
      }
      p("    if (!display.begin(projet::mipiConfig(), projet::displayBufferOptions(), projet::displayOptions().rotation)) {");
      p('        Serial.println(F("Lucarne: display.begin() failed - check MIPI wiring / PSRAM"));');
      p("        while (true) delay(1000);");
      p("    }");
    } else if (family === "oled_mono" && dev.bus !== "spi") {
      p("    projet::initI2cBus();");
      if (hasSdAssets) {
        p("    projet::initStorage();  // SPI bus, only used for SD here");
        p("");
      }
      p("    if (!display.begin(projet::oledPins(), projet::displayOptions())) {");
      p('        Serial.println(F("Lucarne: display.begin() failed - check I2C wiring/address"));');
      p("        while (true) delay(1000);");
      p("    }");
    } else if (family === "oled_mono") {
      p("    projet::initSpiBus();");
      if (hasSdAssets) {
        p("    projet::initStorage();");
        p("");
      }
      p("    if (!display.begin(projet::displayPins(), projet::displayOptions(), &SPI)) {");
      p('        Serial.println(F("Lucarne: display.begin() failed - check SPI wiring"));');
      p("        while (true) delay(1000);");
      p("    }");
    } else if (family === "matrix_lcd") {
      if (hasSdAssets) {
        p("    projet::initStorage();");
        p("");
      }
      p("    if (!display.begin(projet::matrixPins(), projet::matrixOptions(), projet::displayOptions())) {");
      p('        Serial.println(F("Lucarne: display.begin() failed - check HD44780 RS/EN/D4-D7 pins"));');
      p("        while (true) delay(1000);");
      p("    }");
    } else {
      p("    projet::initSpiBus();");
      if (hasSdAssets) {
        p("    projet::initStorage();  // before display.begin() so assets are ready");
        p("");
      }
      p("    if (!display.begin(projet::displayPins(), projet::displayOptions(), projet::displayBufferOptions(), &SPI)) {");
      p('        Serial.println(F("Lucarne: display.begin() failed - check display wiring"));');
      p("        while (true) delay(1000);");
      p("    }");
    }
    p("");
    p("    ui.setHalProfile(projet::halProfile());");
    p("    projet::build(ui);");
    if (family === "mipi_dsi") {
      p("    projet::attachInput(ui, display);");
    } else {
      p("    projet::attachInput(ui);");
    }
    if (kb) {
      p("    ui.configureKeyboard(projet::keyboardOptions());");
    }
    p("    ui.begin();");
    p("");
    p("    // TODO: your own setup code (sensors, Wi-Fi, callbacks registration...)");
    p("}");
    p("");
    p("void loop() {");
    p("    projet::update();");
    if (calcKeys.length) {
      p("    projet::recomputeCalcs(ui);");
    }
    if (cbIds.length) {
      p("    switch (ui.pollMenuAction()) {");
      cbIds.forEach((id) => {
        p("    case " + actionConst(id) + ":");
        p("        // TODO: handle this menu action");
        p("        break;");
      });
      p("    default:");
      p("        break;");
      p("    }");
    }
    p("    ui.update();");
    p("");
    p("    // TODO: your own loop code (poll sensors, push graph samples, update keys...)");
    p("}");
    p("");
    return lines.join("\n");
  }

  async function buildAll(LE) {
    const fonts = buildFontsHeader(LE);
    const images = buildImagesHeader(LE);
    const icons = await buildIconsHeader(LE);
    const setup = buildSetupHeader(LE);
    const storageConfig = buildStorageConfigHeader(LE);
    let extFileCount = 0;
    if (icons && icons.sdFiles) extFileCount += icons.sdFiles.length;
    if (LE.project.images) {
      Object.keys(LE.project.images).forEach((id) => {
        const img = LE.project.images[id];
        if (img && (img.storage === "sd" || img.storage === "volume") && img.pixels) extFileCount++;
      });
    }
    const hasSdAssets = extFileCount > 0;
    const widgetExportRefs = icons && icons.widgetExportRefs ? icons.widgetExportRefs : null;
    const bakeWarnings = icons && icons.bakeWarnings ? icons.bakeWarnings : [];
    const main = buildHeader(LE, !!fonts, !!images, !!icons, icons && icons.animCount > 0, hasSdAssets, widgetExportRefs);
    const files = [{ name: "Projet.h", content: main, kind: "header" }];
    const inoName = (ident(LE.project.name) || "Sketch") + ".ino";
    const ino = buildInoSketch(LE, hasSdAssets);
    if (ino) {
      files.unshift({ name: inoName, content: ino, kind: "header" });
    }
    if (storageConfig) {
      files.push({ name: "LucarneUserConfig.h", content: storageConfig, kind: "header" });
    }
    let flashProjet = 0;
    if (setup) {
      files.push({ name: "Projet_setup.h", content: setup, kind: "header" });
    }
    if (fonts) {
      files.push({ name: "Projet_fonts.h", content: fonts.content, kind: "header" });
      flashProjet += fonts.flashBytes || 0;
    }
    if (images) {
      files.push({ name: "Projet_images.h", content: images.content, kind: "header" });
      flashProjet += images.flashBytes || 0;
    }
    if (icons) {
      files.push({ name: "Projet_icons.h", content: icons.content, kind: "header" });
      flashProjet += icons.flashBytes || 0;
    }
    const sdBinFiles = [];
    const volBinFiles = [];
    if (icons && icons.sdFiles && icons.sdFiles.length) {
      icons.sdFiles.forEach((entry) => {
        files.push(entry);
        if (entry.kind === "volume") volBinFiles.push(entry);
        else sdBinFiles.push(entry);
      });
    }
    if (LE.project.images) {
      const usage =
        window.LucarneAssets && window.LucarneAssets.collectImageUsage
          ? window.LucarneAssets.collectImageUsage(LE.project)
          : {};
      const H = window.LucarneHardware;
      const A = window.LucarneAssets;
      Object.keys(LE.project.images).forEach((id) => {
        const img = LE.project.images[id];
        if (!img || !img.pixels) return;
        const st = img.storage || "flash";
        if (st !== "sd" && st !== "volume") return;
        const exportImg = A && A.imageForExport ? A.imageForExport(LE.project, id, usage) : img;
        if (!exportImg || !exportImg.pixels) return;
        const bin = A.exportRgb565Bin(exportImg);
        if (!bin) return;
        const vol = st === "volume";
        const rel = vol
          ? H && H.volumeExportRelPath
            ? H.volumeExportRelPath(LE.project, id)
            : "assets/" + ident(id) + ".rgb565"
          : H && H.sdExportRelPath
            ? H.sdExportRelPath(LE.project, id)
            : "assets/" + ident(id) + ".rgb565";
        const kind = vol ? "volume" : "sd";
        const entry = { name: rel, content: bin, binary: true, kind: kind };
        files.push(entry);
        if (vol) volBinFiles.push(entry);
        else sdBinFiles.push(entry);
        if (exportImg.alpha && H) {
          const alphaBin = A.exportAlphaBin(exportImg);
          if (alphaBin) {
            const devicePath = vol
              ? H.volumeDevicePath(LE.project, id, exportImg.source)
              : H.sdDevicePath(LE.project, id, exportImg.source);
            const alphaRel = vol
              ? H.volumeIconAlphaExportRel(devicePath.replace(/^\//, ""))
              : H.sdIconAlphaExportRel(devicePath.replace(/^\//, ""));
            const alphaEntry = { name: alphaRel, content: alphaBin, binary: true, kind: kind };
            files.push(alphaEntry);
            if (vol) volBinFiles.push(alphaEntry);
            else sdBinFiles.push(alphaEntry);
          }
        }
      });
    }
    if (sdBinFiles.length && window.LucarneHardware) {
      files.push({
        name: "SD_MANIFEST.txt",
        content: window.LucarneHardware.sdManifest(LE.project, sdBinFiles),
        kind: "sd",
      });
    }
    if (volBinFiles.length && window.LucarneHardware) {
      files.push({
        name: "VOLUME_MANIFEST.txt",
        content: window.LucarneHardware.volumeManifest(LE.project, volBinFiles),
        kind: "manifest",
      });
    }

    const volRawBytes = volBinFiles.reduce((s, f) => s + (f.content ? f.content.length : 0), 0);
    const volFatBytes =
      window.LucarneMemory && window.LucarneMemory.fatOnDiskBytes
        ? window.LucarneMemory.fatOnDiskBytes(volBinFiles)
        : volRawBytes;
    const dataProf = window.LucarneBoards && LE.project.hardware ? window.LucarneBoards.profile(LE.project.hardware) : null;
    const dataMax = dataProf ? dataProf.dataMax : 0;
    if (volBinFiles.length && dataMax && volFatBytes > dataMax) {
      const fmt = window.LucarneMemory ? window.LucarneMemory.formatBytes : String;
      bakeWarnings.unshift(
        "Volume FAT needs ~" +
          fmt(volFatBytes) +
          " (" +
          volBinFiles.length +
          " files) but partition allows " +
          fmt(dataMax) +
          ". Lower icon scale, enable opaque bake per icon, or remove animations."
      );
    } else if (volBinFiles.length && dataMax && volFatBytes > dataMax * 0.85) {
      const fmt = window.LucarneMemory ? window.LucarneMemory.formatBytes : String;
      bakeWarnings.unshift("Volume FAT near limit: ~" + fmt(volFatBytes) + " / " + fmt(dataMax));
    }

    const libEstimate = window.LucarneMemory ? window.LucarneMemory.LUCARNE_LIB_FLASH : 518000;
    const appPartition = window.LucarneMemory ? window.LucarneMemory.APP_PARTITION : 3145728;
    return {
      files,
      flash: {
        projetBytes: flashProjet,
        libEstimate,
        totalEstimate: flashProjet + libEstimate,
        appPartition,
        iconCount: icons ? icons.iconCount : 0,
        animCount: icons ? icons.animCount : 0,
        fontCount: fonts ? fonts.fontCount : 0,
        exportLast: fonts ? fonts.exportLast : 126,
        sdFileCount: sdBinFiles.length + volBinFiles.length,
        volRawBytes,
        volFatBytes,
        dataMax,
        bakeWarnings,
        inoGenerated: !!ino,
        inoName,
      },
    };
  }

  window.LucarneExport = { buildAll, collectIconJobs, normIconStorage };
})();
