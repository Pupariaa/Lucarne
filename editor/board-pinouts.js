(function () {
  "use strict";

  // Curated pinout data for common devkits. GPIO numbers reflect the boards
  // most people actually build on top of; always double-check silkscreen /
  // datasheet for your exact revision before trusting a strapping pin choice.
  const PINOUTS = {
    esp32: {
      label: "ESP32 DevKitC / WROOM-32",
      freePool: [4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33],
      inputOnly: [34, 35, 36, 39],
      reserved: {
        0: "Boot strap, usually wired to the BOOT button",
        1: "UART0 TX (Serial monitor)",
        2: "Boot strap, often tied to the onboard LED",
        3: "UART0 RX (Serial monitor)",
        5: "Boot strap - must be HIGH at boot (usable as CS, which idles HIGH)",
        6: "Internal SPI flash (CLK) - not usable",
        7: "Internal SPI flash (D0) - not usable",
        8: "Internal SPI flash (D1) - not usable",
        9: "Internal SPI flash (D2) - not usable",
        10: "Internal SPI flash (D3) - not usable",
        11: "Internal SPI flash (CMD) - not usable",
        12: "Boot strap (MTDI) - sets flash voltage, must be LOW at boot",
        15: "Boot strap (MTDO) - avoid driving LOW at boot",
      },
      recommended: {
        spiSclk: 18,
        spiMosi: 23,
        spiMiso: 19,
        dispCs: 5,
        dispDc: 4,
        dispRst: 16,
        dispBl: 27,
        i2cSda: 21,
        i2cScl: 22,
        touchInt: 32,
        touchRst: 33,
        sdCs: 26,
        btnUp: 34,
        btnDown: 35,
        btnOk: 36,
        btnBack: 39,
        encA: 34,
        encB: 35,
        encBtn: 36,
      },
      notes: [
        "GPIO34/35/36/39 are input-only with no internal pull resistor - wire an external pull-up (or pull-down + invert Active Low) for buttons on these pins.",
      ],
    },
    esp32s2: {
      label: "ESP32-S2 DevKitC-1",
      freePool: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42],
      inputOnly: [46],
      reserved: {
        0: "Boot strap, usually wired to the BOOT button",
        19: "Native USB D- (leave free if using USB CDC)",
        20: "Native USB D+ (leave free if using USB CDC)",
        22: "Not broken out on DevKitC-1",
        23: "Not broken out on DevKitC-1",
        24: "Not broken out on DevKitC-1",
        25: "Not broken out on DevKitC-1",
        26: "Internal SPI flash/PSRAM",
        27: "Internal SPI flash/PSRAM",
        28: "Internal SPI flash/PSRAM",
        29: "Internal SPI flash/PSRAM",
        30: "Internal SPI flash/PSRAM",
        31: "Internal SPI flash/PSRAM",
        32: "Internal SPI flash/PSRAM",
        45: "Boot strap (VDD_SPI voltage) - must be LOW at boot",
        46: "Boot strap + input-only - must be LOW at boot",
      },
      recommended: {
        spiSclk: 12,
        spiMosi: 11,
        spiMiso: 13,
        dispCs: 10,
        dispDc: 9,
        dispRst: 8,
        dispBl: 14,
        i2cSda: 6,
        i2cScl: 7,
        touchInt: 4,
        touchRst: 5,
        sdCs: 15,
        btnUp: 1,
        btnDown: 2,
        btnOk: 3,
        btnBack: 21,
        encA: 1,
        encB: 2,
        encBtn: 3,
      },
      notes: [],
    },
    esp32s3: {
      label: "ESP32-S3 DevKitC-1 / N16R8",
      freePool: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 47, 48],
      inputOnly: [46],
      reserved: {
        0: "Boot strap, usually wired to the BOOT button",
        19: "Native USB D- (leave free if using USB CDC)",
        20: "Native USB D+ (leave free if using USB CDC)",
        22: "Not broken out on most S3 devkits",
        23: "Not broken out on most S3 devkits",
        26: "Internal SPI flash/PSRAM",
        27: "Internal SPI flash/PSRAM",
        28: "Internal SPI flash/PSRAM",
        29: "Internal SPI flash/PSRAM",
        30: "Internal SPI flash/PSRAM",
        31: "Internal SPI flash/PSRAM",
        32: "Internal SPI flash/PSRAM (octal variants)",
        33: "Octal PSRAM (N16R8 modules)",
        34: "Octal PSRAM (N16R8 modules)",
        35: "Octal PSRAM (N16R8 modules)",
        36: "Octal PSRAM (N16R8 modules)",
        37: "Octal PSRAM (N16R8 modules)",
        43: "UART0 TX (Serial monitor)",
        44: "UART0 RX (Serial monitor)",
        45: "Boot strap (VDD_SPI voltage) - must be LOW at boot",
      },
      recommended: {
        spiSclk: 12,
        spiMosi: 11,
        spiMiso: 13,
        dispCs: 10,
        dispDc: 9,
        dispRst: 8,
        dispBl: 14,
        i2cSda: 6,
        i2cScl: 7,
        touchInt: 4,
        touchRst: 5,
        sdCs: 15,
        btnUp: 1,
        btnDown: 2,
        btnOk: 3,
        btnBack: 21,
        encA: 1,
        encB: 2,
        encBtn: 3,
      },
      notes: ["N16R8 variants (octal PSRAM) additionally reserve GPIO33-37 - already excluded here."],
    },
    esp32c3: {
      label: "ESP32-C3 SuperMini / DevKitM-1",
      freePool: [0, 1, 3, 4, 5, 6, 7, 10, 18, 19, 20, 21],
      inputOnly: [],
      reserved: {
        2: "Boot strap - must be HIGH at boot on most modules",
        8: "Boot strap on some C3 variants",
        9: "Boot strap, usually wired to the BOOT button",
        11: "Internal SPI flash",
        12: "Internal SPI flash",
        13: "Internal SPI flash",
        14: "Internal SPI flash",
        15: "Internal SPI flash",
        16: "Internal SPI flash",
        17: "Internal SPI flash",
      },
      recommended: {
        spiSclk: 4,
        spiMosi: 5,
        spiMiso: 6,
        dispCs: 7,
        dispDc: 10,
        dispRst: 18,
        dispBl: 19,
        i2cSda: 8,
        i2cScl: 9,
        touchInt: 3,
        touchRst: 1,
        sdCs: 0,
        btnUp: 0,
        btnDown: 1,
        btnOk: 3,
        btnBack: 20,
        encA: 0,
        encB: 1,
        encBtn: 3,
      },
      notes: ["Only 11 usable GPIOs on this chip - large projects (SPI + I2C touch + SD + buttons) can run out of pins quickly."],
    },
    esp32c6: {
      label: "ESP32-C6 DevKitC-1",
      freePool: [0, 1, 2, 3, 6, 7, 10, 11, 18, 19, 20, 21, 22, 23],
      inputOnly: [],
      reserved: {
        4: "Strapping pin (MTMS) - avoid driving at boot",
        5: "Strapping pin (MTDI) - avoid driving at boot",
        8: "Strapping pin, also drives the onboard RGB LED (WS2812)",
        9: "Strapping pin, usually wired to the BOOT button",
        12: "Native USB D- (USB-Serial/JTAG) - leave free if using USB CDC",
        13: "Native USB D+ (USB-Serial/JTAG) - leave free if using USB CDC",
        14: "Not broken out on SiP-flash (N4/N8) modules - depends on variant",
        15: "Strapping pin (VDD_SPI voltage) - must be LOW at boot",
        16: "UART0 TX - wired to the onboard USB-to-serial chip (Serial monitor)",
        17: "UART0 RX - wired to the onboard USB-to-serial chip (Serial monitor)",
      },
      recommended: {
        spiSclk: 6,
        spiMosi: 7,
        spiMiso: 2,
        dispCs: 10,
        dispDc: 11,
        dispRst: 18,
        dispBl: 19,
        i2cSda: 20,
        i2cScl: 21,
        touchInt: 22,
        touchRst: 23,
        sdCs: 0,
        btnUp: 0,
        btnDown: 1,
        btnOk: 3,
        btnBack: 23,
        encA: 0,
        encB: 1,
        encBtn: 3,
      },
      notes: [
        "Only 14 curated free GPIOs on this devkit - a project using SPI display + I2C touch + SD + buttons all at once will run out; the wizard warns per missing role.",
      ],
    },
    esp32p4: {
      label: "ESP32-P4 Function EV Board",
      freePool: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
      inputOnly: [],
      reserved: {
        8: "Boot strap on P4 function EV board",
        15: "Boot strap on P4 function EV board",
      },
      recommended: {
        spiSclk: 11,
        spiMosi: 12,
        spiMiso: 13,
        dispCs: 10,
        dispDc: 9,
        dispRst: 16,
        dispBl: 17,
        i2cSda: 7,
        i2cScl: 6,
        touchInt: 18,
        touchRst: 19,
        sdCs: 14,
        btnUp: 0,
        btnDown: 1,
        btnOk: 2,
        btnBack: 3,
        encA: 0,
        encB: 1,
        encBtn: 2,
      },
      notes: [
        "MIPI-DSI panel lanes, DPI sync/porch signals and the panel's I2C touch controller (GT911/GT9271/GT928/FT6336) are wired through the display FPC and are configured under Display profile, not through this wizard.",
      ],
    },
    rp2040: {
      label: "Raspberry Pi Pico (RP2040)",
      freePool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 26, 27, 28],
      inputOnly: [],
      reserved: {
        23: "SMPS power-save mode select (internal)",
        24: "VBUS sense (internal)",
        25: "Onboard LED - usable, but keep free for status blink",
        29: "VSYS/ADC sense (internal)",
      },
      recommended: {
        spiSclk: 18,
        spiMosi: 19,
        spiMiso: 16,
        dispCs: 17,
        dispDc: 20,
        dispRst: 21,
        dispBl: 22,
        i2cSda: 4,
        i2cScl: 5,
        touchInt: 6,
        touchRst: 7,
        sdCs: 9,
        btnUp: 2,
        btnDown: 3,
        btnOk: 8,
        btnBack: 10,
        encA: 2,
        encB: 3,
        encBtn: 8,
      },
      notes: ["SPI/DC/CS defaults match the RP2040 hardware SPI0 pins (GP16/17/18/19) for best performance."],
    },
    rp2350: {
      label: "Raspberry Pi Pico 2 (RP2350)",
      freePool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 26, 27, 28],
      inputOnly: [],
      reserved: {
        23: "SMPS power-save mode select (internal)",
        24: "VBUS sense (internal)",
        25: "Onboard LED - usable, but keep free for status blink",
        29: "VSYS/ADC sense (internal)",
      },
      recommended: {
        spiSclk: 18,
        spiMosi: 19,
        spiMiso: 16,
        dispCs: 17,
        dispDc: 20,
        dispRst: 21,
        dispBl: 22,
        i2cSda: 4,
        i2cScl: 5,
        touchInt: 6,
        touchRst: 7,
        sdCs: 9,
        btnUp: 2,
        btnDown: 3,
        btnOk: 8,
        btnBack: 10,
        encA: 2,
        encB: 3,
        encBtn: 8,
      },
      notes: ["Pin-compatible with the original Pico - same header layout, faster core."],
    },
    arduino_nano_esp32: {
      label: "Arduino Nano ESP32 (ESP32-S3, Nano form factor)",
      freePool: [5, 6, 7, 8, 9, 10, 17, 18, 21, 38, 47, 48, 1, 2, 3, 4, 11, 12, 13, 14],
      inputOnly: [46],
      reserved: {
        0: "LED_GREEN (onboard RGB LED) + boot strap - avoid driving at boot",
        19: "Native USB D- (leave free if using USB CDC / Serial)",
        20: "Native USB D+ (leave free if using USB CDC / Serial)",
        43: "D0 - hardware UART0 RX (RX0 header, Serial1)",
        44: "D1 - hardware UART0 TX (TX0 header, Serial1)",
        45: "LED_BLUE (onboard RGB LED) + boot strap (VDD_SPI) - must be LOW at boot",
      },
      recommended: {
        spiSclk: 13,
        spiMosi: 12,
        spiMiso: 14,
        dispCs: 10,
        dispDc: 9,
        dispRst: 8,
        dispBl: 7,
        i2cSda: 5,
        i2cScl: 6,
        touchInt: 4,
        touchRst: 3,
        sdCs: 2,
        btnUp: 17,
        btnDown: 18,
        btnOk: 21,
        btnBack: 38,
        encA: 17,
        encB: 18,
        encBtn: 21,
      },
      notes: [
        "This is an ESP32-S3 module (NORA-W106) in the Nano form factor. Pin numbers here are the raw GPIOs behind the D0-D13/A0-A7 header labels (e.g. board pin D2 = GPIO5) - the same numbers work with pinMode()/digitalWrite() no matter which Pin Numbering option is selected in the IDE.",
        "GPIO46 (LED_RED) is input-only and a boot strap - not offered as an output-capable role.",
      ],
    },
    arduino_nano_rp2040_connect: {
      label: "Arduino Nano RP2040 Connect (RP2040, Nano form factor)",
      freePool: [25, 15, 16, 17, 18, 19, 20, 21, 5, 7, 4, 6, 26, 27, 28, 29],
      inputOnly: [],
      reserved: {
        0: "UART0 TX (D1 header) - Serial monitor if used",
        1: "UART0 RX (D0 header) - Serial monitor if used",
        6: "Onboard LED (D13) - usable, but keep free for status blink",
      },
      recommended: {
        spiSclk: 18,
        spiMosi: 19,
        spiMiso: 16,
        dispCs: 17,
        dispDc: 20,
        dispRst: 21,
        dispBl: 5,
        i2cSda: 7,
        i2cScl: 4,
        touchInt: 26,
        touchRst: 27,
        sdCs: 28,
        btnUp: 25,
        btnDown: 15,
        btnOk: 29,
        btnBack: 6,
        encA: 25,
        encB: 15,
        encBtn: 29,
      },
      notes: [
        "Pin numbers are the underlying RP2040 GPIOs behind this board's D0-D13/A0-A3 header labels (e.g. D6 = GPIO18) - the same numbers work with pinMode()/digitalWrite() whether your own sketch uses D-names or raw numbers.",
        "A4-A7 on this board are read through the onboard NINA-W102 co-processor, not the RP2040 itself, so they're not offered here as GPIO pins.",
        "The onboard NINA-W102 (Wi-Fi/BT) and ATECC608A (crypto) chips use their own dedicated RP2040 pins that aren't broken out to the header, so they don't conflict with anything listed here.",
      ],
    },
  };

  const MATRIX_ROLES = {
    lcdRs: "rs",
    lcdEn: "en",
    lcdD4: "d4",
    lcdD5: "d5",
    lcdD6: "d6",
    lcdD7: "d7",
    lcdRw: "rw",
    lcdBl: "bl",
  };

  const OUTPUT_ROLES = new Set([
    "spiSclk",
    "spiMosi",
    "dispCs",
    "dispDc",
    "dispRst",
    "dispBl",
    "i2cSda",
    "i2cScl",
    "sdCs",
    "touchRst",
    "lcdRs",
    "lcdEn",
    "lcdD4",
    "lcdD5",
    "lcdD6",
    "lcdD7",
    "lcdRw",
    "lcdBl",
  ]);

  const ROLE_LABELS = {
    spiSclk: "SPI SCLK",
    spiMosi: "SPI MOSI",
    spiMiso: "SPI MISO",
    dispCs: "Display CS",
    dispDc: "Display DC",
    dispRst: "Display RST",
    dispBl: "Display backlight",
    i2cSda: "I2C SDA",
    i2cScl: "I2C SCL",
    touchInt: "Touch INT",
    touchRst: "Touch RST",
    sdCs: "SD card CS",
    btnUp: "Button Up",
    btnDown: "Button Down",
    btnLeft: "Button Left",
    btnRight: "Button Right",
    btnOk: "Button OK",
    btnBack: "Button Back",
    encA: "Encoder A",
    encB: "Encoder B",
    encBtn: "Encoder button",
    lcdRs: "LCD RS",
    lcdEn: "LCD E",
    lcdD4: "LCD D4",
    lcdD5: "LCD D5",
    lcdD6: "LCD D6",
    lcdD7: "LCD D7",
    lcdRw: "LCD RW",
    lcdBl: "LCD backlight",
  };

  function boardIds() {
    return Object.keys(PINOUTS);
  }

  function get(boardId) {
    return PINOUTS[boardId] || null;
  }

  function classify(boardId, pin) {
    const d = PINOUTS[boardId];
    if (!d) return { kind: "unknown", reason: "" };
    if (d.reserved[pin]) return { kind: "reserved", reason: d.reserved[pin] };
    if (d.inputOnly.indexOf(pin) >= 0) return { kind: "inputOnly", reason: "Input-only pin" };
    if (d.freePool.indexOf(pin) >= 0) return { kind: "free", reason: "" };
    return { kind: "unknown", reason: "Not in the curated free pool for this devkit" };
  }

  function neededRoles(project, hw) {
    const H = window.LucarneHardware;
    const roles = [];
    if (!H) return roles;
    const needsSpi = H.needsSpiBus ? H.needsSpiBus(project) : true;
    const family = H.displayFamily(project);
    const dev = window.LucarneState ? window.LucarneState.device(project) : {};
    if (needsSpi) {
      roles.push("spiSclk", "spiMosi");
      if (hw.sd && hw.sd.enabled) roles.push("spiMiso");
      else if (family !== "matrix_lcd" && family !== "mipi_dsi") roles.push("spiMiso");
    }
    if (family === "spi_rgb" || (family === "oled_mono" && dev.bus === "spi")) {
      roles.push("dispCs", "dispDc", "dispRst");
      if (family === "spi_rgb") roles.push("dispBl");
    } else if (family === "oled_mono" && dev.bus !== "spi") {
      // I2C OLED - handled via i2c roles below plus RST
      roles.push("dispRst");
    } else if (family === "matrix_lcd") {
      const m = hw.matrix || {};
      roles.push("lcdRs", "lcdEn", "lcdD4", "lcdD5", "lcdD6", "lcdD7");
      if (m.rw !== undefined && m.rw !== null && m.rw >= 0) roles.push("lcdRw");
      if (m.bl !== undefined && m.bl !== null && m.bl >= 0) roles.push("lcdBl");
    }
    const touchI2c = hw.touch && hw.touch.enabled && hw.touch.kind && hw.touch.kind.indexOf("i2c_") === 0;
    const oledI2c = family === "oled_mono" && dev.bus !== "spi";
    if (touchI2c || oledI2c) roles.push("i2cSda", "i2cScl");
    if (touchI2c) roles.push("touchInt", "touchRst");
    if (hw.sd && hw.sd.enabled) roles.push("sdCs");
    if (project.input) {
      if (project.input.type === "buttons") {
        const b = project.input.buttons || {};
        roles.push("btnUp", "btnDown");
        if (b.left !== undefined && (b.left | 0) >= 0) roles.push("btnLeft");
        if (b.right !== undefined && (b.right | 0) >= 0) roles.push("btnRight");
        if (b.ok === undefined || (b.ok | 0) >= 0) roles.push("btnOk");
        if (b.back === undefined || (b.back | 0) >= 0) roles.push("btnBack");
      }
      else if (project.input.type === "encoder") roles.push("encA", "encB", "encBtn");
    }
    return roles.filter((r, i) => roles.indexOf(r) === i);
  }

  function suggest(boardId, project, hw) {
    const d = PINOUTS[boardId];
    if (!d) return { ok: false, assignments: {}, warnings: ["Unknown board"], notes: [] };
    const roles = neededRoles(project, hw);
    const used = new Set();
    const assignments = {};
    const warnings = [];

    function pickFallback(role) {
      const allowInputOnly = !OUTPUT_ROLES.has(role);
      for (const p of d.freePool) {
        if (!used.has(p)) return p;
      }
      if (allowInputOnly) {
        for (const p of d.inputOnly) {
          if (!used.has(p)) return p;
        }
      }
      return undefined;
    }

    roles.forEach((role) => {
      let pin = d.recommended[role];
      if (pin === undefined || used.has(pin) || (OUTPUT_ROLES.has(role) && d.inputOnly.indexOf(pin) >= 0)) {
        pin = pickFallback(role);
      }
      if (pin === undefined) {
        warnings.push("No free pin left for " + (ROLE_LABELS[role] || role) + ".");
        return;
      }
      used.add(pin);
      assignments[role] = pin;
    });

    return { ok: warnings.length === 0, assignments, warnings, notes: d.notes || [], roleLabels: ROLE_LABELS };
  }

  function applyAssignments(project, hw, assignments) {
    if (assignments.spiSclk !== undefined) hw.spi.sclk = assignments.spiSclk;
    if (assignments.spiMosi !== undefined) hw.spi.mosi = assignments.spiMosi;
    if (assignments.spiMiso !== undefined) hw.spi.miso = assignments.spiMiso;
    if (assignments.dispCs !== undefined) hw.display.cs = assignments.dispCs;
    if (assignments.dispDc !== undefined) hw.display.dc = assignments.dispDc;
    if (assignments.dispRst !== undefined) {
      hw.display.rst = assignments.dispRst;
      if (hw.oled) hw.oled.rst = assignments.dispRst;
    }
    if (assignments.dispBl !== undefined) hw.display.bl = assignments.dispBl;
    if (assignments.i2cSda !== undefined) hw.i2c.sda = assignments.i2cSda;
    if (assignments.i2cScl !== undefined) hw.i2c.scl = assignments.i2cScl;
    if (assignments.touchInt !== undefined) hw.touch.intPin = assignments.touchInt;
    if (assignments.touchRst !== undefined) hw.touch.rstPin = assignments.touchRst;
    if (assignments.sdCs !== undefined) hw.sd.cs = assignments.sdCs;
    if (hw.matrix) {
      Object.keys(MATRIX_ROLES).forEach((role) => {
        if (assignments[role] !== undefined) hw.matrix[MATRIX_ROLES[role]] = assignments[role];
      });
    }
    if (project.input) {
      if (project.input.type === "buttons") {
        const b = project.input.buttons;
        if (assignments.btnUp !== undefined) b.up = assignments.btnUp;
        if (assignments.btnDown !== undefined) b.down = assignments.btnDown;
        if (assignments.btnLeft !== undefined) b.left = assignments.btnLeft;
        if (assignments.btnRight !== undefined) b.right = assignments.btnRight;
        if (assignments.btnOk !== undefined) b.ok = assignments.btnOk;
        if (assignments.btnBack !== undefined) b.back = assignments.btnBack;
      } else if (project.input.type === "encoder") {
        const e = project.input.encoder;
        if (assignments.encA !== undefined) e.a = assignments.encA;
        if (assignments.encB !== undefined) e.b = assignments.encB;
        if (assignments.encBtn !== undefined) e.btn = assignments.encBtn;
      }
    }
  }

  window.LucarneBoardPinouts = {
    boardIds,
    get,
    classify,
    neededRoles,
    suggest,
    applyAssignments,
    ROLE_LABELS,
    OUTPUT_ROLES,
    MATRIX_ROLES,
  };
})();
