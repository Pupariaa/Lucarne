(function () {
  "use strict";

  const DRIVER = {
    ST7789: 1,
    ST7796: 2,
    ST7735: 3,
    ILI9342: 4,
    OLED: 5,
    HD44780: 6,
    MIPI: 7,
  };

  const DRIVER_BY_DEV = {
    ST7789: DRIVER.ST7789,
    ST7796: DRIVER.ST7796,
    ST7735S: DRIVER.ST7735,
    ST7735: DRIVER.ST7735,
    ILI9342: DRIVER.ILI9342,
    SSD1306: DRIVER.OLED,
    SH1106: DRIVER.OLED,
    SSD1315: DRIVER.OLED,
    HD44780: DRIVER.HD44780,
  };

  function deviceDriverId(project) {
    const S = window.LucarneState;
    if (!S || !project) return 0;
    const dev = S.device(project);
    const family = dev.family || "spi_rgb";
    if (family === "oled_mono") return DRIVER.OLED;
    if (family === "matrix_lcd") return DRIVER.HD44780;
    if (family === "mipi_dsi") return DRIVER.MIPI;
    const key = (dev.driver || "ST7789").toUpperCase();
    return DRIVER_BY_DEV[key] || DRIVER.ST7789;
  }

  function chipFromProject(project) {
    const hw = project && project.hardware;
    const board = (hw && hw.board) || {};
    const t = String(board.target || board.id || "").toLowerCase();
    if (t.indexOf("esp32-s3") >= 0 || t.indexOf("esp32s3") >= 0) return "esp32s3";
    if (t.indexOf("esp32-c3") >= 0 || t.indexOf("esp32c3") >= 0) return "esp32c3";
    if (t.indexOf("esp32-p4") >= 0 || t.indexOf("esp32p4") >= 0) return "esp32p4";
    if (t.indexOf("esp32") >= 0) return "esp32";
    if (t.indexOf("rp2350") >= 0) return "rp2040";
    if (t.indexOf("rp2040") >= 0 || t.indexOf("pico") >= 0) return "rp2040";
    if (t.indexOf("32u4") >= 0 || t.indexOf("atmega") >= 0) return "avr";
    return "esp32s3";
  }

  function presetMatchesOledDriver(preset, dev) {
    if (!preset || !dev) return false;
    const list = preset.oledDrivers;
    if (!list || !list.length) return false;
    const dr = String(dev.driver || "").toUpperCase();
    for (let i = 0; i < list.length; i++) {
      if (String(list[i]).toUpperCase() === dr) return true;
    }
    return false;
  }

  function matchPreset(presets, project) {
    if (!presets || !presets.length || !project) return null;
    const chip = chipFromProject(project);
    const driverId = deviceDriverId(project);
    const S = window.LucarneState;
    const dev = S ? S.device(project) : {};
    const family = dev.family || "spi_rgb";
    if (dev.flashReceiverPreset) {
      const pinned = presets.find((p) => p.id === dev.flashReceiverPreset && p.chip === chip);
      if (pinned) return pinned;
      const pinnedAny = presets.find((p) => p.id === dev.flashReceiverPreset);
      if (pinnedAny) return pinnedAny;
    }
    let list = presets.filter((p) => p.chip === chip);
    if (!list.length) list = presets.filter((p) => p.chip === "esp32s3");
    if (family === "oled_mono") {
      const oledList = list.filter((p) => p.displayKind === "oled_mono");
      const exact = oledList.find((p) => presetMatchesOledDriver(p, dev));
      if (exact) return exact;
      const generic = oledList.find((p) => !p.oledDrivers || !p.oledDrivers.length);
      if (generic) return generic;
    }
    const byDriver = list.find((p) => p.liveDriverId === driverId);
    if (byDriver) return byDriver;
    const byKind = list.find((p) => p.displayKind === family);
    if (byKind) return byKind;
    return list.find((p) => p.prebuilt) || list[0];
  }

  function displayKindLabel(kind) {
    if (kind === "oled_mono") return "Monochrome OLED";
    if (kind === "matrix_lcd") return "HD44780 character LCD";
    if (kind === "mipi_dsi") return "MIPI DSI";
    return "SPI RGB565 TFT";
  }

  window.LucarneLiveReceivers = {
    DRIVER,
    deviceDriverId,
    chipFromProject,
    matchPreset,
    displayKindLabel,
  };
})();
