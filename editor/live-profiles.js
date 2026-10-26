(function () {
  "use strict";

  const PROFILES = {
    oled: { maxPayload: 16384, stripH: 8, fullEvery: 10, dirtyRatio: 0.22, ackMs: 60000 },
    avr: { maxPayload: 2048, stripH: 8, fullEvery: 8, dirtyRatio: 0.2, ackMs: 60000 },
    rp: { maxPayload: 8192, stripH: 16, fullEvery: 12, dirtyRatio: 0.25, ackMs: 45000 },
    esp32: { maxPayload: 32768, stripH: 48, fullEvery: 16, dirtyRatio: 0.3, ackMs: 45000 },
    esp32s3: { maxPayload: 49152, stripH: 64, fullEvery: 20, dirtyRatio: 0.35, ackMs: 45000 },
    esp32p4: { maxPayload: 65536, stripH: 80, fullEvery: 24, dirtyRatio: 0.35, ackMs: 45000 },
  };

  const BOARD_HINTS = [
    { re: /esp32-s3|esp32s3/i, id: "esp32s3" },
    { re: /esp32-p4|esp32p4/i, id: "esp32p4" },
    { re: /esp32-c3|esp32c3|esp32-c6|esp32c6|esp32-h2|esp32s2|esp32(?!-s3|-p4|-c)/i, id: "esp32" },
    { re: /rp2350|rp2040|pico|raspberry pi/i, id: "rp" },
    { re: /32u4|atmega|arduino leonardo|arduino micro|lilypad usb/i, id: "avr" },
  ];

  function profileById(id) {
    return PROFILES[id] || PROFILES.esp32;
  }

  function hintFromProject(project) {
    const hw = project && project.hardware;
    const board = (hw && hw.board) || {};
    const target = String(board.target || board.id || board.label || "");
    for (let i = 0; i < BOARD_HINTS.length; i++) {
      if (BOARD_HINTS[i].re.test(target)) return BOARD_HINTS[i].id;
    }
    const family = hw && hw.displayFamily;
    if (family === "mipi_dsi") return "esp32p4";
    return "esp32s3";
  }

  function hintFromBaud(baud) {
    const b = baud | 0;
    if (b <= 115200) return "avr";
    if (b <= 460800) return "rp";
    if (b <= 1500000) return "esp32";
    return "esp32s3";
  }

  function mergeCaps(base, infoCaps) {
    const out = Object.assign({}, base);
    if (!infoCaps) return out;
    if (infoCaps.maxPayload > 0) out.maxPayload = infoCaps.maxPayload;
    if (infoCaps.stripH > 0) out.stripH = infoCaps.stripH;
    if (infoCaps.fullEvery > 0) out.fullEvery = infoCaps.fullEvery;
    return out;
  }

  function resolve(project, baud, deviceInfo) {
    const S = window.LucarneState;
    if (S && project && S.deviceFamily(project) === "oled_mono") {
      let p = profileById("oled");
      if (deviceInfo && deviceInfo.maxPayload) {
        p = mergeCaps(p, {
          maxPayload: deviceInfo.maxPayload,
          stripH: deviceInfo.stripH || 0,
          fullEvery: deviceInfo.fullEvery || 0,
        });
      }
      return p;
    }
    let id = hintFromProject(project);
    if (deviceInfo && deviceInfo.platformHint) id = deviceInfo.platformHint;
    else if (!project || !project.hardware) id = hintFromBaud(baud);
    let p = profileById(id);
    if (deviceInfo && deviceInfo.maxPayload) {
      p = mergeCaps(p, {
        maxPayload: deviceInfo.maxPayload,
        stripH: deviceInfo.stripH || 0,
        fullEvery: deviceInfo.fullEvery || 0,
      });
    }
    return p;
  }

  window.LucarneLiveProfiles = {
    resolve,
    profileById,
    PROFILES,
  };
})();
