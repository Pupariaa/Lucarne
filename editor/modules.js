(function () {
  "use strict";

  const PHASE_ZERO_ID = "phase-zero-s3-24";

  function list() {
    return [{ id: PHASE_ZERO_ID, label: "Phase Zero S3-24" }];
  }

  function apply(project, id) {
    if (!project) return project;
    if (id && id !== PHASE_ZERO_ID) return project;
    const S = window.LucarneState;
    const H = window.LucarneHardware;
    if (!S || !H) return project;
    H.migrate(project);
    project.moduleId = PHASE_ZERO_ID;
    project.deviceId = "st7789_24";
    project.panelWidth = 240;
    project.panelHeight = 320;
    project.rotation = 1;
    const dev = S.device(project);
    H.applyDeviceDefaults(project, dev);
    const hw = H.get(project);
    hw.board.target = "esp32s3";
    hw.board.schemeId = "app3M_fat9M_16MB";
    hw.board.psramMb = 8;
    hw.board.sramKb = 512;
    hw.spi.mosi = 18;
    hw.spi.miso = 5;
    hw.spi.sclk = 17;
    hw.display.cs = 16;
    hw.display.dc = 15;
    hw.display.rst = 8;
    hw.display.bl = 7;
    hw.display.blActiveLow = true;
    hw.display.spiHz = 40000000;
    hw.display.spiMode = 3;
    hw.display.colorOrder = "RGB";
    hw.display.invert = true;
    if (!hw.touch) hw.touch = H.defaultHardware().touch;
    hw.touch.enabled = false;
    hw.touch.kind = "none";
    hw.sd.enabled = true;
    hw.sd.cs = 6;
    hw.sd.spiHz = 20000000;
    if (!hw.hal) hw.hal = H.defaultHardware().hal;
    hw.hal.uiProfile = "Psram";
    hw.hal.bufferMode = "Full";
    hw.hal.stripeLines = 0;
    hw.hal.allowRichTransitions = true;
    hw.hal.preferRichTransitions = true;
    hw.hal.preferHwRotate = true;
    hw.hal.jpegDecodeHw = true;
    if (!project.input) project.input = S.defaultInput();
    project.input.type = "buttons";
    project.input.activeLow = true;
    project.input.buttons = { up: 4, down: 38, left: 2, right: 1, ok: -1, back: -1 };
    return project;
  }

  function summary(project) {
    if (!project || project.moduleId !== PHASE_ZERO_ID) return [];
    return [
      'ST7789 2.4", native 240x320, rotation 90 degrees, logical canvas 320x240. Color order RGB, colors inverted. Touch off.',
      "Buttons, active-low: Up GPIO4, Down GPIO38, Left GPIO2, Right GPIO1. Confirm and Back are absent. This board has no confirm button, so a menu cannot be opened from the pad.",
      "Shared SPI: MOSI GPIO18, SCLK GPIO17, MISO GPIO5. Display CS GPIO16 at 40 MHz, SD CS GPIO6 at 20 MHz. Backlight GPIO7, on when the pin is low.",
      "ESP32-S3 N16R8, 8 MB PSRAM, UI profile Psram, buffer Full, stripe lines auto, rich transitions on, HW rotation on, HW JPEG decode on.",
      "Arduino IDE: ESP32-S3, PSRAM OPI, flash 16 MB, USB CDC on boot.",
      "The GPIO wizard still suggests DevKitC pins. Reapply this module to restore this wiring.",
    ];
  }

  window.LucarneModules = { list, apply, summary, PHASE_ZERO_ID };
})();
