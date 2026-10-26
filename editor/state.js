(function () {
  "use strict";

  const STORAGE_KEY = "lucarne_project_v2";

  const DEVICE_FAMILIES = {
    spi_rgb: {
      color: true,
      mono: false,
      livePreview: "rgb565",
      transitions: true,
      images: true,
      widgets: "full",
    },
    oled_mono: {
      color: false,
      mono: true,
      livePreview: "mono",
      transitions: false,
      images: false,
      widgets: "basic",
    },
    matrix_lcd: {
      color: false,
      mono: true,
      livePreview: "none",
      transitions: false,
      images: false,
      widgets: "char",
    },
    mipi_dsi: {
      color: true,
      mono: false,
      livePreview: "rgb565",
      transitions: true,
      images: true,
      widgets: "full",
      video: true,
    },
  };

  const DEVICE_ALIASES = {
    mipi_800x480: "ws_7_dsi_lcd",
    mipi_1024x600: "ws_7_dsi_touch_c",
  };

  // Per-panel-IC DPI bus defaults (lane bit rate + hsync/vsync porches), taken
  // from Espressif's own reference DPI configs for each controller (see
  // esp_lcd_<ic>.h's *_PANEL_60HZ_*_CONFIG macros — laneMbps and the six
  // porch/pulse values are IC/reference-board specific, not resolution
  // specific). dpiClockMhz below is then re-derived per catalog entry to hit
  // ~60Hz at that entry's actual resolution using these same porches
  // (refresh = dpiClockMhz*1e6 / ((w+hsync+hbp+hfp) * (h+vsync+vbp+vfp))).
  // Third-party modules can still need their own vendor-tuned porches if the
  // picture rolls/tears — this is a verified starting point, not a guarantee.
  const MIPI_IC_DPI_BASE = {
    HX8394: { laneMbps: 700, hsync: 20, hbp: 20, hfp: 40, vsync: 4, vbp: 10, vfp: 24 },
    ILI9881C: { laneMbps: 1000, hsync: 40, hbp: 140, hfp: 40, vsync: 4, vbp: 16, vfp: 16 },
    JD9365: { laneMbps: 1500, hsync: 20, hbp: 20, hfp: 40, vsync: 4, vbp: 12, vfp: 30 },
    EK79007: { laneMbps: 900, hsync: 10, hbp: 160, hfp: 160, vsync: 1, vbp: 23, vfp: 12 },
  };

  function mipiDpiClockForRes(w, h, base) {
    const hTotal = w + base.hsync + base.hbp + base.hfp;
    const vTotal = h + base.vsync + base.vbp + base.vfp;
    return Math.round((60 * hTotal * vTotal) / 1e6);
  }

  function mipiDev(o) {
    const base = MIPI_IC_DPI_BASE[o.lcdIc] || MIPI_IC_DPI_BASE.HX8394;
    const w = o.w || 720;
    const h = o.h || 1280;
    return Object.assign(
      {
        driver: "MipiDsi",
        family: "mipi_dsi",
        defaultBoard: "esp32p4",
        boards: ["esp32p4"],
        lanes: 2,
        laneMbps: base.laneMbps,
        dpiClockMhz: mipiDpiClockForRes(w, h, base),
        hsync: base.hsync,
        hbp: base.hbp,
        hfp: base.hfp,
        vsync: base.vsync,
        vbp: base.vbp,
        vfp: base.vfp,
        i2cSda: 7,
        i2cScl: 8,
        blI2cAddr: 0x45,
        p4Rev: "v1.3+",
        touchDriver: "i2c_gt911",
        touchI2cAddr: 0x5d,
      },
      o
    );
  }

  const DEVICES = {
    st7789_169: {
      label: 'ST7789 1.69" 240x280',
      driver: "ST7789",
      family: "spi_rgb",
      w: 240,
      h: 280,
      inch: 1.69,
      colorOrder: "RGB",
      invert: true,
    },
    st7789_13: {
      label: 'ST7789 1.3" 240x240',
      driver: "ST7789",
      family: "spi_rgb",
      w: 240,
      h: 240,
      inch: 1.3,
      colorOrder: "RGB",
      invert: true,
    },
    st7789_24: {
      label: 'ST7789 2.4" 240x320',
      driver: "ST7789",
      family: "spi_rgb",
      w: 240,
      h: 320,
      inch: 2.4,
      colorOrder: "RGB",
      invert: true,
    },
    st7789_24_land: {
      label: 'ST7789 2.4" 320x240',
      driver: "ST7789",
      family: "spi_rgb",
      w: 320,
      h: 240,
      inch: 2.4,
      colorOrder: "RGB",
      invert: true,
    },
    st7796_35: {
      label: 'ST7796 3.5" 320x480',
      driver: "ST7796",
      family: "spi_rgb",
      w: 320,
      h: 480,
      inch: 3.5,
      colorOrder: "BGR",
      invert: false,
    },
    ili9342_20: {
      label: 'ILI9342C 2.0" 240x320',
      driver: "ILI9342",
      family: "spi_rgb",
      w: 240,
      h: 320,
      inch: 2.0,
      colorOrder: "BGR",
      invert: false,
    },
    ili9342_22: {
      label: 'ILI9342C 2.2" 240x320',
      driver: "ILI9342",
      family: "spi_rgb",
      w: 240,
      h: 320,
      inch: 2.2,
      colorOrder: "BGR",
      invert: false,
    },
    ili9342_24: {
      label: 'ILI9342C 2.4" 240x320',
      driver: "ILI9342",
      family: "spi_rgb",
      w: 240,
      h: 320,
      inch: 2.4,
      colorOrder: "BGR",
      invert: false,
    },
    ili9342_28: {
      label: 'ILI9342C 2.8" 240x320',
      driver: "ILI9342",
      family: "spi_rgb",
      w: 240,
      h: 320,
      inch: 2.8,
      colorOrder: "BGR",
      invert: false,
    },
    ili9342_32: {
      label: 'ILI9342C 3.2" 240x320',
      driver: "ILI9342",
      family: "spi_rgb",
      w: 240,
      h: 320,
      inch: 3.2,
      colorOrder: "BGR",
      invert: false,
    },
    ili9342_28_land: {
      label: 'ILI9342C 2.8" 320x240',
      driver: "ILI9342",
      family: "spi_rgb",
      w: 320,
      h: 240,
      inch: 2.8,
      colorOrder: "BGR",
      invert: false,
    },
    ili9342_24_land: {
      label: 'ILI9342C 2.4" 320x240',
      driver: "ILI9342",
      family: "spi_rgb",
      w: 320,
      h: 240,
      inch: 2.4,
      colorOrder: "BGR",
      invert: false,
    },
    st7735_18: {
      label: 'ST7735S 1.8" 160x128',
      driver: "ST7735S",
      family: "spi_rgb",
      w: 160,
      h: 128,
      inch: 1.8,
    },
    st7735_144: {
      label: 'ST7735S 1.44" 128x128',
      driver: "ST7735S",
      family: "spi_rgb",
      w: 128,
      h: 128,
      inch: 1.44,
    },
    ssd1306_096_i2c: {
      label: 'SSD1306 0.96" 128x64 I2C',
      driver: "SSD1306",
      family: "oled_mono",
      bus: "i2c",
      w: 128,
      h: 64,
      inch: 0.96,
      i2cAddr: 0x3c,
    },
    sh1106_096_i2c: {
      label: 'SH1106 0.96" 128x64 I2C',
      driver: "SH1106",
      family: "oled_mono",
      bus: "i2c",
      w: 128,
      h: 64,
      inch: 0.96,
      i2cAddr: 0x3c,
    },
    ssd1315_096_i2c: {
      label: 'SSD1315 0.96" 128x64 I2C',
      driver: "SSD1315",
      family: "oled_mono",
      bus: "i2c",
      w: 128,
      h: 64,
      inch: 0.96,
      i2cAddr: 0x3c,
      defaultOledPanelVariant: "yellow_blue_16_48",
      oledPanelVariants: ["white", "blue", "yellow_blue_16_48", "yellow_blue_32_32"],
      flashReceiverPreset: "esp32s3-ssd1315-i2c",
    },
    ssd1306_096_spi: {
      label: 'SSD1306 0.96" 128x64 SPI',
      driver: "SSD1306",
      family: "oled_mono",
      bus: "spi",
      w: 128,
      h: 64,
      inch: 0.96,
    },
    hd44780_16x2: {
      label: "HD44780 16x2",
      driver: "HD44780",
      family: "matrix_lcd",
      cols: 16,
      rows: 2,
      charW: 8,
      charH: 8,
      w: 128,
      h: 16,
    },
    hd44780_20x4: {
      label: "HD44780 20x4",
      driver: "HD44780",
      family: "matrix_lcd",
      cols: 20,
      rows: 4,
      charW: 8,
      charH: 8,
      w: 160,
      h: 32,
    },
    ws_34_dsi_touch_c: mipiDev({
      label: 'WS 3.4" DSI-TOUCH-C 800×800',
      panelId: "3.4-DSI-TOUCH-C",
      w: 800,
      h: 800,
      inch: 3.4,
      lcdIc: "JD9365",
      idfDriver: "esp_lcd_jd9365",
      touchIc: "GT928",
      touchDriver: "i2c_gt928",
      touchI2cAddr: 0x14,
      orientation: "portrait",
    }),
    ws_4_dsi_touch_c: mipiDev({
      label: 'WS 4" DSI-TOUCH-C 720×720',
      panelId: "4-DSI-TOUCH-C",
      w: 720,
      h: 720,
      inch: 4,
      lcdIc: "JD9365",
      idfDriver: "esp_lcd_jd9365",
      touchIc: "GT928",
      touchDriver: "i2c_gt928",
      touchI2cAddr: 0x14,
      orientation: "portrait",
    }),
    ws_4_dsi_touch_a: mipiDev({
      label: 'WS 4" DSI-TOUCH-A 480×800',
      panelId: "4-DSI-TOUCH-A",
      w: 480,
      h: 800,
      inch: 4,
      lcdIc: "HX8394",
      idfDriver: "esp_lcd_hx8394",
      touchIc: "GT911",
      orientation: "portrait",
    }),
    ws_43_dsi_touch_a: mipiDev({
      label: 'WS 4.3" DSI-TOUCH-A 480×800',
      panelId: "4.3-DSI-TOUCH-A",
      w: 480,
      h: 800,
      inch: 4.3,
      lcdIc: "HX8394",
      idfDriver: "esp_lcd_hx8394",
      touchIc: "GT911",
      orientation: "portrait",
    }),
    ws_5_dsi_touch_a: mipiDev({
      label: 'WS 5" DSI-TOUCH-A 720×1280',
      panelId: "5-DSI-TOUCH-A",
      w: 720,
      h: 1280,
      inch: 5,
      lcdIc: "HX8394",
      idfDriver: "esp_lcd_hx8394",
      touchIc: "GT911",
      orientation: "portrait",
    }),
    ws_7_dsi_touch_a: mipiDev({
      label: 'WS 7" DSI-TOUCH-A 720×1280',
      panelId: "7-DSI-TOUCH-A",
      w: 720,
      h: 1280,
      inch: 7,
      lcdIc: "ILI9881C",
      idfDriver: "esp_lcd_ili9881c",
      touchIc: "GT9271",
      touchDriver: "i2c_gt9271",
      orientation: "portrait",
    }),
    ws_7_dsi_touch_c: mipiDev({
      label: 'WS 7" DSI-TOUCH-C 1024×600',
      panelId: "7-DSI-TOUCH-C",
      w: 1024,
      h: 600,
      inch: 7,
      lcdIc: "EK79007",
      idfDriver: "esp_lcd_ek79007",
      touchIc: "GT911",
      orientation: "landscape",
      // Matches the official ESP32-P4-Function-EV-Board panel exactly —
      // dpiClockMhz taken straight from esp_lcd_ek79007's tested reference.
      dpiClockMhz: 52,
    }),
    ws_8_dsi_touch_a: mipiDev({
      label: 'WS 8" DSI-TOUCH-A 800×1280',
      panelId: "8-DSI-TOUCH-A",
      w: 800,
      h: 1280,
      inch: 8,
      lcdIc: "JD9365",
      idfDriver: "esp_lcd_jd9365",
      touchIc: "GT9271",
      touchDriver: "i2c_gt9271",
      orientation: "portrait",
      // Matches esp_lcd_jd9365's 800x1280 reference resolution exactly —
      // dpiClockMhz taken straight from its tested reference config.
      dpiClockMhz: 80,
    }),
    ws_88_dsi_touch_a: mipiDev({
      label: 'WS 8.8" DSI-TOUCH-A 480×1920',
      panelId: "8.8-DSI-TOUCH-A",
      w: 480,
      h: 1920,
      inch: 8.8,
      lcdIc: "OTA7290B",
      idfDriver: "esp_lcd_ota7290b",
      touchIc: "GT9271",
      touchDriver: "i2c_gt9271",
      orientation: "portrait",
    }),
    ws_9_dsi_touch_b: mipiDev({
      label: 'WS 9" DSI-TOUCH-B 720×1280',
      panelId: "9-DSI-TOUCH-B",
      w: 720,
      h: 1280,
      inch: 9,
      lcdIc: "JD9365",
      idfDriver: "esp_lcd_jd9365",
      touchIc: "GT9271",
      touchDriver: "i2c_gt9271",
      orientation: "portrait",
    }),
    ws_101_dsi_touch_a: mipiDev({
      label: 'WS 10.1" DSI-TOUCH-A 800×1280',
      panelId: "10.1-DSI-TOUCH-A",
      w: 800,
      h: 1280,
      inch: 10.1,
      lcdIc: "JD9365",
      idfDriver: "esp_lcd_jd9365",
      touchIc: "GT9271",
      touchDriver: "i2c_gt9271",
      orientation: "portrait",
      // Matches esp_lcd_jd9365's 800x1280 reference resolution exactly —
      // dpiClockMhz taken straight from its tested reference config.
      dpiClockMhz: 80,
    }),
    ws_101_dsi_touch_b: mipiDev({
      label: 'WS 10.1" DSI-TOUCH-B 720×1280',
      panelId: "10.1-DSI-TOUCH-B",
      w: 720,
      h: 1280,
      inch: 10.1,
      lcdIc: "JD9365",
      idfDriver: "esp_lcd_jd9365",
      touchIc: "GT9271",
      touchDriver: "i2c_gt9271",
      orientation: "portrait",
    }),
    ws_101m: mipiDev({
      label: 'WS 101M-8001280 (10.1" legacy)',
      panelId: "101M-8001280-IPS-CT-K",
      w: 800,
      h: 1280,
      inch: 10.1,
      lcdIc: "JD9365",
      idfDriver: "esp_lcd_jd9365",
      touchIc: "GT9271",
      touchDriver: "i2c_gt9271",
      orientation: "portrait",
      // Matches esp_lcd_jd9365's 800x1280 reference resolution exactly —
      // dpiClockMhz taken straight from its tested reference config.
      dpiClockMhz: 80,
    }),
    ws_28_dsi_lcd: mipiDev({
      label: 'WS 2.8" DSI LCD 480×640 (P4 v3)',
      panelId: "2.8inch DSI LCD",
      w: 480,
      h: 640,
      inch: 2.8,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "portrait",
    }),
    ws_34_dsi_lcd_c: mipiDev({
      label: 'WS 3.4" DSI LCD (C) 800×800 (P4 v3)',
      panelId: "3.4inch DSI LCD (C)",
      w: 800,
      h: 800,
      inch: 3.4,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "portrait",
    }),
    ws_4_dsi_lcd: mipiDev({
      label: 'WS 4" DSI LCD 480×800 (P4 v3)',
      panelId: "4inch DSI LCD",
      w: 480,
      h: 800,
      inch: 4,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "portrait",
    }),
    ws_4_dsi_lcd_c: mipiDev({
      label: 'WS 4" DSI LCD (C) 720×720 (P4 v3)',
      panelId: "4inch DSI LCD (C)",
      w: 720,
      h: 720,
      inch: 4,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "portrait",
    }),
    ws_5_dsi_lcd_d: mipiDev({
      label: 'WS 5" DSI LCD (D) 720×1280 (P4 v3)',
      panelId: "5inch DSI LCD (D)",
      w: 720,
      h: 1280,
      inch: 5,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "portrait",
    }),
    ws_5_dsi_lcd_c: mipiDev({
      label: 'WS 5" DSI LCD (C) 1024×600 (P4 v3)',
      panelId: "5inch DSI LCD (C)",
      w: 1024,
      h: 600,
      inch: 5,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "landscape",
    }),
    ws_625_dsi_lcd: mipiDev({
      label: 'WS 6.25" DSI LCD 720×1560 (P4 v3)',
      panelId: "6.25inch DSI LCD",
      w: 720,
      h: 1560,
      inch: 6.25,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "portrait",
    }),
    ws_7_dsi_lcd: mipiDev({
      label: 'WS 7" DSI LCD 800×480 (P4 v3)',
      panelId: "7inch DSI LCD",
      w: 800,
      h: 480,
      inch: 7,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "landscape",
    }),
    ws_7_dsi_lcd_c: mipiDev({
      label: 'WS 7" DSI LCD (C) 1024×600 (P4 v3)',
      panelId: "7inch DSI LCD (C)",
      w: 1024,
      h: 600,
      inch: 7,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "landscape",
    }),
    ws_7_dsi_lcd_e: mipiDev({
      label: 'WS 7" DSI LCD (E) 1280×800 (P4 v3)',
      panelId: "7inch DSI LCD (E)",
      w: 1280,
      h: 800,
      inch: 7,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "landscape",
    }),
    ws_7_dsi_lcd_h: mipiDev({
      label: 'WS 7" DSI LCD (H) 1280×720 (P4 v3)',
      panelId: "7inch DSI LCD (H)",
      w: 1280,
      h: 720,
      inch: 7,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "landscape",
    }),
    ws_79_dsi_lcd: mipiDev({
      label: 'WS 7.9" DSI LCD 400×1280 (P4 v3)',
      panelId: "7.9inch DSI LCD",
      w: 400,
      h: 1280,
      inch: 7.9,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "portrait",
    }),
    ws_8_dsi_lcd_c: mipiDev({
      label: 'WS 8" DSI LCD (C) 1280×800 (P4 v3)',
      panelId: "8inch DSI LCD (C)",
      w: 1280,
      h: 800,
      inch: 8,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "landscape",
    }),
    ws_88_dsi_lcd: mipiDev({
      label: 'WS 8.8" DSI LCD 480×1920 (P4 v3)',
      panelId: "8.8inch DSI LCD",
      w: 480,
      h: 1920,
      inch: 8.8,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "portrait",
    }),
    ws_101_dsi_lcd_c: mipiDev({
      label: 'WS 10.1" DSI LCD (C) 1280×800 (P4 v3)',
      panelId: "10.1inch DSI LCD (C)",
      w: 1280,
      h: 800,
      inch: 10.1,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "landscape",
    }),
    ws_119_dsi_lcd: mipiDev({
      label: 'WS 11.9" DSI LCD 320×1480 (P4 v3)',
      panelId: "11.9inch DSI LCD",
      w: 320,
      h: 1480,
      inch: 11.9,
      idfDriver: "esp_lcd_dsi",
      touchIc: "GT911",
      p4Rev: "v3.x",
      orientation: "portrait",
    }),
  };

  const THEME_KEYS = [
    ["background", "Background"],
    ["surface", "Surface"],
    ["surfaceEdge", "Surface edge"],
    ["text", "Text"],
    ["textDim", "Text dim"],
    ["primary", "Primary"],
    ["success", "Success"],
    ["warning", "Warning"],
    ["danger", "Danger"],
  ];

  const TRANSITIONS = [
    "None",
    "SlideLeft",
    "SlideRight",
    "SlideUp",
    "SlideDown",
    "Fade",
    "Push",
    "Cover",
  ];

  let counter = 1;
  function genId(prefix) {
    return prefix + "_" + Date.now().toString(36) + (counter++).toString(36);
  }

  function defaultTheme() {
    return {
      background: "#080c14",
      surface: "#141c28",
      surfaceEdge: "#32405a",
      text: "#e6f0ff",
      textDim: "#8ca0be",
      primary: "#5e96ff",
      success: "#5ee88c",
      warning: "#f6b737",
      danger: "#f65656",
      radius: 8,
      padding: 8,
      rowHeight: 30,
      textSize: 1,
      fontBodyId: "f_body",
      fontTitleId: "f_title",
    };
  }

  function mergedTheme(project, screen) {
    if (!screen || !screen.theme) return project.theme;
    return Object.assign({}, project.theme, screen.theme);
  }

  function screenHasTheme(screen) {
    return !!(screen && screen.theme);
  }

  function defaultFonts() {
    return {
      f_body: {
        id: "f_body",
        label: "Body",
        cName: "LucarneFontBody",
        builtin: true,
        kind: "google",
        googleName: "Fira Sans",
        family: "Fira Sans",
        weight: 400,
        sizePx: 15,
      },
      f_title: {
        id: "f_title",
        label: "Title",
        cName: "LucarneFontTitle",
        builtin: true,
        kind: "google",
        googleName: "Fira Sans",
        family: "Fira Sans",
        weight: 400,
        sizePx: 24,
      },
    };
  }

  function defaultInput() {
    return {
      type: "buttons",
      activeLow: true,
      virtualKeyboard: false,
      buttons: { up: 6, down: 7, left: -1, right: -1, ok: 8, back: 9 },
      encoder: { a: 6, b: 7, btn: 8 },
    };
  }

  function defaultUiSource() {
    return { mode: "project", url: "", sdPath: "/ui.lucarne.json" };
  }

  const LIVE_SPEED_KEY = "lucarne_live_speed";
  const LIVE_SPEEDS = [
    { id: "safe", label: "Safe", baud: 115200 },
    { id: "eco", label: "Eco", baud: 460800 },
    { id: "balanced", label: "Balanced", baud: 921600 },
    { id: "fast", label: "Fast", baud: 1500000 },
    { id: "turbo", label: "Turbo", baud: 2000000 },
    { id: "realtime", label: "Realtime", baud: 3000000 },
  ];

  function liveSpeedById(id) {
    return LIVE_SPEEDS.find((s) => s.id === id) || LIVE_SPEEDS.find((s) => s.id === "turbo");
  }

  function getLiveSpeedId() {
    try {
      const id = localStorage.getItem(LIVE_SPEED_KEY);
      if (id && liveSpeedById(id)) return id;
      const legacy = parseInt(localStorage.getItem("lucarne_live_baud"), 10);
      if (legacy >= 115200) {
        let best = LIVE_SPEEDS[0];
        let bestDiff = Math.abs(legacy - best.baud);
        LIVE_SPEEDS.forEach((s) => {
          const d = Math.abs(legacy - s.baud);
          if (d < bestDiff) {
            best = s;
            bestDiff = d;
          }
        });
        return best.id;
      }
    } catch (e) {}
    return "turbo";
  }

  function setLiveSpeedId(id) {
    try {
      if (liveSpeedById(id)) localStorage.setItem(LIVE_SPEED_KEY, id);
    } catch (e) {}
  }

  function getLiveBaud() {
    return liveSpeedById(getLiveSpeedId()).baud;
  }

  function setLiveBaud(v) {
    const n = parseInt(v, 10);
    if (!n) return;
    let best = LIVE_SPEEDS[0];
    let bestDiff = Math.abs(n - best.baud);
    LIVE_SPEEDS.forEach((s) => {
      const d = Math.abs(n - s.baud);
      if (d < bestDiff) {
        best = s;
        bestDiff = d;
      }
    });
    setLiveSpeedId(best.id);
  }

  function defaultProject() {
    const dashId = "dash";
    const homeId = "home";
    const dev = DEVICES.st7789_169;
    return {
      name: "MyProject",
      deviceId: "st7789_169",
      panelWidth: dev.w,
      panelHeight: dev.h,
      rotation: 0,
      theme: defaultTheme(),
      fonts: defaultFonts(),
      input: defaultInput(),
      hardware: null,
      transition: { default: "SlideLeft", durationMs: 220 },
      images: {},
      icons: {},
      iconExportStorage: "flash",
      iconAnim: { maxFrames: 0, frameStep: 1 },
      uiSource: defaultUiSource(),
      callbacks: [],
      startScreen: homeId,
      keys: [
        { name: "temp", type: "float", value: 23.4 },
        { name: "hum", type: "float", value: 48 },
        { name: "load", type: "float", value: 0.32 },
        { name: "fan", type: "bool", value: true },
      ],
      screens: [
        {
          id: homeId,
          name: "Home",
          gx: 80,
          gy: 90,
          widgets: [
            {
              id: genId("w"),
              type: "label",
              x: 16,
              y: 16,
              w: 208,
              h: 30,
              text: "LUCARNE",
              textStyle: { fontId: "title", align: "center" },
            },
            {
              id: genId("w"),
              type: "menu",
              x: 12,
              y: 60,
              w: 216,
              h: 200,
              iconScale: 1,
              badgeScale: 1,
              items: [
                { id: genId("it"), label: "Dashboard", icon: "chart", rightIcon: "auto", target: dashId, transition: "Inherit" },
                { id: genId("it"), label: "Sensors", icon: "thermo", rightIcon: "auto", target: dashId, transition: "Fade" },
                {
                  id: genId("it"),
                  label: "Settings",
                  icon: "settings",
                  rightIcon: "power",
                  action: "callback",
                  callbackId: "open_settings",
                  target: "",
                  transition: "Inherit",
                },
              ],
            },
          ],
        },
        {
          id: dashId,
          name: "Dashboard",
          gx: 460,
          gy: 90,
          widgets: [
            {
              id: genId("w"),
              type: "label",
              x: 16,
              y: 14,
              w: 208,
              h: 28,
              text: "Dashboard",
              textStyle: { fontId: "title", align: "center" },
            },
            {
              id: genId("w"),
              type: "metric",
              x: 14,
              y: 56,
              w: 212,
              h: 34,
              label: "Temp",
              key: "temp",
              unit: "C",
              decimals: 1,
              accent: "#f6b737",
            },
            {
              id: genId("w"),
              type: "metric",
              x: 14,
              y: 96,
              w: 212,
              h: 34,
              label: "Humidity",
              key: "hum",
              unit: "%",
              decimals: 0,
              accent: "#5e96ff",
            },
            {
              id: genId("w"),
              type: "label",
              x: 16,
              y: 146,
              w: 212,
              h: 16,
              text: "CPU load",
              textStyle: { align: "left", color: "#8ca0be" },
            },
            {
              id: genId("w"),
              type: "bar",
              x: 14,
              y: 166,
              w: 212,
              h: 20,
              key: "load",
              min: 0,
              max: 1,
              showValue: true,
            },
          ],
        },
      ],
    };
  }

  function device(project) {
    return DEVICES[project.deviceId] || DEVICES.st7789_169;
  }

  function deviceFamily(project) {
    const d = device(project);
    return d.family || "spi_rgb";
  }

  function deviceCaps(project) {
    const d = device(project);
    const base = DEVICE_FAMILIES[d.family] || DEVICE_FAMILIES.spi_rgb;
    return Object.assign({}, base, d.caps || {});
  }

  // MIPI panel ICs with a real initPanel() branch in src/display/LucarneMipiDsi.cpp.
  const MIPI_LCD_IC_SUPPORTED = new Set(["HX8394", "ILI9881C", "JD9365", "EK79007"]);

  const OLED_PANEL_VARIANTS = {
    white: {
      label: "White (full panel)",
      regions: [{ y0: 0, y1: 65535, on: 0xffff }],
    },
    blue: {
      label: "Blue (full panel)",
      regions: [{ y0: 0, y1: 65535, on: 0x001f }],
    },
    yellow_blue_16_48: {
      label: "Yellow top 16 px, blue bottom 48 px",
      regions: [
        { y0: 0, y1: 16, on: 0xffe0 },
        { y0: 16, y1: 64, on: 0x001f },
      ],
    },
    yellow_blue_32_32: {
      label: "Yellow top 32 px, blue bottom 32 px",
      regions: [
        { y0: 0, y1: 32, on: 0xffe0 },
        { y0: 32, y1: 64, on: 0x001f },
      ],
    },
  };

  function oledPanelVariantIdsForDevice(dev) {
    if (!dev) return ["white"];
    if (dev.oledPanelVariants && dev.oledPanelVariants.length) return dev.oledPanelVariants.slice();
    if (dev.family === "oled_mono") return ["white", "blue", "yellow_blue_16_48", "yellow_blue_32_32"];
    return ["white"];
  }

  function oledPanelVariantDef(id) {
    return OLED_PANEL_VARIANTS[id] || OLED_PANEL_VARIANTS.white;
  }

  function resolveOledPanelVariantId(project) {
    const dev = device(project);
    const allowed = oledPanelVariantIdsForDevice(dev);
    const hw = project.hardware && project.hardware.oled;
    const id = (hw && hw.panelVariant) || dev.defaultOledPanelVariant || "white";
    if (allowed.indexOf(id) >= 0) return id;
    return allowed[0] || "white";
  }

  function oledPanelPreview(project) {
    if (deviceFamily(project) !== "oled_mono") return null;
    const def = oledPanelVariantDef(resolveOledPanelVariantId(project));
    const h = nativeDims(project).h;
    const regions = def.regions.map((r) => ({
      y0: r.y0 | 0,
      y1: r.y1 >= 65535 ? h : Math.min(r.y1 | 0, h),
      on: r.on & 0xffff,
    }));
    const oled = project.hardware && project.hardware.oled;
    return { regions, invert: !!(oled && oled.invert) };
  }

  const OLED_DRIVERS_SUPPORTED = new Set(["SSD1306", "SH1106", "SSD1315"]);
  const MATRIX_DRIVERS_SUPPORTED = new Set(["HD44780"]);

  function deviceFirmwareSupported(devOrId) {
    const d = typeof devOrId === "string" ? DEVICES[devOrId] : devOrId;
    if (!d) return true;
    if (d.family === "oled_mono") return OLED_DRIVERS_SUPPORTED.has(d.driver);
    if (d.family === "matrix_lcd") return MATRIX_DRIVERS_SUPPORTED.has(d.driver);
    if (d.family === "mipi_dsi") return MIPI_LCD_IC_SUPPORTED.has(d.lcdIc);
    return true;
  }

  // Touch ICs with a real driver class in src/input/ today.
  const MIPI_TOUCH_IC_SUPPORTED = new Set(["GT911", "GT9271", "GT928", "FT6336"]);

  // Devices wired to any other touch IC will report coordinates over I2C in
  // the export comments but never actually feed the UI, so treat them as
  // "no working touch" for DRC purposes.
  function deviceTouchFirmwareSupported(devOrId) {
    const d = typeof devOrId === "string" ? DEVICES[devOrId] : devOrId;
    if (!d || !d.touchIc) return true;
    return MIPI_TOUCH_IC_SUPPORTED.has(d.touchIc);
  }

  function nativeDims(project) {
    const d = device(project);
    return {
      w: project.panelWidth > 0 ? project.panelWidth : d.w,
      h: project.panelHeight > 0 ? project.panelHeight : d.h,
    };
  }

  function dims(project) {
    const n = nativeDims(project);
    if (project.rotation === 1 || project.rotation === 3) return { w: n.h, h: n.w };
    return { w: n.w, h: n.h };
  }

  function getScreen(project, id) {
    return project.screens.find((s) => s.id === id) || null;
  }

  function cloneWidgetData(w) {
    const raw = JSON.parse(JSON.stringify(w));
    raw.id = genId("w");
    if (raw.type === "menu" && raw.items) {
      raw.items = raw.items.map((it) => Object.assign({}, it, { id: genId("it") }));
    }
    return raw;
  }

  function duplicateScreen(project, sourceId) {
    const src = getScreen(project, sourceId);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = genId("scr");
    copy.name = (src.name || src.id) + " copy";
    copy.gx = (src.gx || 0) + 40;
    copy.gy = (src.gy || 0) + 30;
    copy.widgets = (src.widgets || []).map(cloneWidgetData);
    project.screens.push(copy);
    return copy;
  }

  function iconNames(project) {
    const t = window.LUCARNE_ICONS || {};
    const names = ["none"].concat(Object.keys(t));
    if (project && project.icons) {
      Object.keys(project.icons).forEach((id) => names.push("c:" + id));
    }
    return names;
  }

  const IMG_DB = "lucarne_studio_images";
  const IMG_STORE = "images";

  function openImgDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IMG_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IMG_STORE)) db.createObjectStore(IMG_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPutImages(images) {
    if (!window.indexedDB || !window.LucarneAssets) return;
    const db = await openImgDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IMG_STORE, "readwrite");
      const store = tx.objectStore(IMG_STORE);
      store.clear();
      Object.keys(images || {}).forEach((id) => {
        const img = images[id];
        if (img && img.pixels) store.put(window.LucarneAssets.serialize(img), id);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbLoadImages(project) {
    if (!window.indexedDB || !project.images || !window.LucarneAssets) return;
    const needs = Object.keys(project.images).filter((id) => project.images[id] && project.images[id]._idb);
    if (!needs.length) return;
    const db = await openImgDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IMG_STORE, "readonly");
      const store = tx.objectStore(IMG_STORE);
      let pending = needs.length;
      needs.forEach((id) => {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) project.images[id] = window.LucarneAssets.deserialize(req.result);
          pending--;
          if (pending === 0) resolve();
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  let saveErrorHandler = null;

  function setSaveErrorHandler(fn) {
    saveErrorHandler = fn;
  }

  function save(project) {
    try {
      const clone = JSON.parse(JSON.stringify(project));
      if (project.images) {
        clone.images = {};
        Object.keys(project.images).forEach((id) => {
          const img = project.images[id];
          if (!img) return;
          if (img.pixels) {
            clone.images[id] = {
              label: img.label,
              w: img.w,
              h: img.h,
              storage: img.storage || "flash",
              source: img.source || "",
              _idb: true,
            };
          } else clone.images[id] = img;
        });
      }
      if (project.icons) {
        clone.icons = {};
        Object.keys(project.icons).forEach((id) => {
          clone.icons[id] = window.LucarneAssets.serializeIcon(project.icons[id]);
        });
      }
      Object.values(clone.fonts || {}).forEach((f) => {
        delete f._atlas;
        delete f._loaded;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
      if (project.images) {
        idbPutImages(project.images).catch((e) => {
          console.warn("IndexedDB image save failed", e);
          if (saveErrorHandler) saveErrorHandler({ name: "ImageStoreError", message: (e && e.message) || "IndexedDB unavailable" });
        });
      }
      return true;
    } catch (e) {
      if (saveErrorHandler) saveErrorHandler(e);
      return false;
    }
  }

  function hydrate(project) {
    if (!project) return project;
    if (project.deviceId && DEVICE_ALIASES[project.deviceId]) {
      project.deviceId = DEVICE_ALIASES[project.deviceId];
    }
    if (!project.images) project.images = {};
    Object.keys(project.images).forEach((id) => {
      const raw = project.images[id];
      if (!raw) {
        delete project.images[id];
        return;
      }
      if (raw.b64) project.images[id] = window.LucarneAssets.deserialize(raw);
      if (project.images[id] && !project.images[id].storage) project.images[id].storage = "flash";
    });
    if (!project.icons) project.icons = {};
    Object.keys(project.icons).forEach((id) => {
      const raw = project.icons[id];
      if (raw && raw.px && window.LucarneAssets) {
        const ic = window.LucarneAssets.deserializeIcon(raw);
        project.icons[id] = ic ? Object.assign({ label: raw.label || id }, ic) : raw;
      } else if (raw && raw.rows && !raw.label) project.icons[id] = window.LucarneAssets.deserializeIcon(raw);
      else if (raw && raw.rows) project.icons[id] = raw;
    });
    if (!project.uiSource) project.uiSource = defaultUiSource();
    if (!project.iconExportStorage) project.iconExportStorage = "flash";
    if (!project.iconAnim) project.iconAnim = { maxFrames: 0, frameStep: 1 };
    else {
      if (project.iconAnim.maxFrames === undefined) project.iconAnim.maxFrames = 0;
      if (project.iconAnim.frameStep === undefined || project.iconAnim.frameStep < 1) project.iconAnim.frameStep = 1;
    }
    if (!project.input) project.input = defaultInput();
    else {
      if (project.input.virtualKeyboard === undefined) project.input.virtualKeyboard = false;
      if (!project.input.buttons) project.input.buttons = defaultInput().buttons;
      else {
        if (project.input.buttons.left === undefined) project.input.buttons.left = -1;
        if (project.input.buttons.right === undefined) project.input.buttons.right = -1;
      }
    }
    if (project.moduleId === undefined) project.moduleId = "";
    if (window.LucarneHardware) window.LucarneHardware.migrate(project);
    if (!project.panelWidth || !project.panelHeight) {
      const d = device(project);
      project.panelWidth = d.w;
      project.panelHeight = d.h;
    }
    if (window.LucarneTextStyle) window.LucarneTextStyle.migrateProjectLabels(project);
    return project;
  }

  let lastLoadError = null;

  async function load() {
    lastLoadError = null;
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const project = hydrate(JSON.parse(raw));
      await idbLoadImages(project);
      return project;
    } catch (e) {
      console.warn("Saved project could not be restored", e);
      let backupKey = null;
      if (raw) {
        try {
          localStorage.setItem(STORAGE_KEY + "_corrupt", raw);
          backupKey = STORAGE_KEY + "_corrupt";
        } catch (err) {
          console.warn("Corrupt project backup failed", err);
        }
      }
      lastLoadError = { message: (e && e.message) || String(e), backupKey };
      return null;
    }
  }

  function loadError() {
    return lastLoadError;
  }

  function clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  window.LucarneState = {
    DEVICES,
    DEVICE_FAMILIES,
    THEME_KEYS,
    TRANSITIONS,
    genId,
    defaultProject,
    defaultTheme,
    mergedTheme,
    screenHasTheme,
    defaultFonts,
    defaultInput,
    device,
    deviceFamily,
    deviceCaps,
    deviceFirmwareSupported,
    deviceTouchFirmwareSupported,
    OLED_PANEL_VARIANTS,
    oledPanelVariantIdsForDevice,
    oledPanelVariantDef,
    resolveOledPanelVariantId,
    oledPanelPreview,
    nativeDims,
    dims,
    getScreen,
    duplicateScreen,
    cloneWidgetData,
    getLiveBaud,
    setLiveBaud,
    LIVE_SPEEDS,
    liveSpeedById,
    getLiveSpeedId,
    setLiveSpeedId,
    defaultUiSource,
    hydrate,
    iconNames,
    save,
    load,
    clearSaved,
    setSaveErrorHandler,
    loadError,
    idbLoadImages,
  };
})();
