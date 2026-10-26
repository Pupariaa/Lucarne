(function () {
  "use strict";

  const PRESETS = [
    {
      id: "dashboard",
      label: "Dashboard",
      widgets(d, genId) {
        const hw = Math.min(100, idiv(d.w - 36, 2));
        return [
          { id: genId("w"), type: "label", x: 14, y: 8, w: d.w - 28, h: 20, text: "Dashboard", textStyle: { fontId: "title", align: "center" } },
          { id: genId("w"), type: "metric", x: 14, y: 32, w: hw, h: 34, label: "Temp", key: "temp", unit: "°C", decimals: 1 },
          { id: genId("w"), type: "metric", x: 22 + hw, y: 32, w: hw, h: 34, label: "Humidity", key: "hum", unit: "%", decimals: 0 },
          { id: genId("w"), type: "chart", x: 14, y: 72, w: d.w - 28, h: 56, keys: ["temp", "hum"], min: 0, max: 100 },
          { id: genId("w"), type: "bar", x: 14, y: 136, w: d.w - 28, h: 18, key: "level", min: 0, max: 100, showValue: true },
        ];
      },
    },
    {
      id: "settings",
      label: "Settings",
      widgets(d, genId) {
        return [
          { id: genId("w"), type: "label", x: 14, y: 8, w: d.w - 28, h: 20, text: "Settings", textStyle: { fontId: "title", align: "center" } },
          { id: genId("w"), type: "switch", x: 14, y: 36, w: d.w - 28, h: 28, label: "Wi-Fi", key: "wifi" },
          { id: genId("w"), type: "switch", x: 14, y: 68, w: d.w - 28, h: 28, label: "Notifications", key: "notify" },
          { id: genId("w"), type: "slider", x: 14, y: 104, w: d.w - 28, h: 32, key: "brightness", min: 0, max: 100 },
          {
            id: genId("w"),
            type: "list",
            x: 14,
            y: 144,
            w: d.w - 28,
            h: Math.min(120, d.h - 152),
            items: [
              { id: genId("it"), label: "Account" },
              { id: genId("it"), label: "Privacy" },
              { id: genId("it"), label: "About" },
            ],
          },
        ];
      },
    },
    {
      id: "statusbar",
      label: "Status bar",
      widgets(d, genId) {
        return [
          { id: genId("w"), type: "clock", x: 8, y: 4, w: 72, h: 20, hourKey: "hour", minuteKey: "minute", format: "hm", textStyle: { fontId: "title" } },
          { id: genId("w"), type: "date", x: 8, y: 24, w: 100, h: 16, dayKey: "day", monthKey: "month", yearKey: "year", format: "dmy", textStyle: { fontId: "body", size: 1 } },
          { id: genId("w"), type: "status", x: d.w - 80, y: 4, w: 72, h: 18, wifiKey: "wifi", rssiKey: "rssi", bluetoothKey: "bt" },
          { id: genId("w"), type: "battery", x: d.w - 52, y: 22, w: 44, h: 18, key: "battery", showPercent: true, chargingKey: "charging", lowThreshold: 20 },
        ];
      },
      keys() {
        return [
          { name: "hour", type: "int", value: 14 },
          { name: "minute", type: "int", value: 30 },
          { name: "day", type: "int", value: 29 },
          { name: "month", type: "int", value: 7 },
          { name: "year", type: "int", value: 2026 },
          { name: "wifi", type: "bool", value: true },
          { name: "rssi", type: "int", value: -58 },
          { name: "bt", type: "bool", value: false },
          { name: "battery", type: "float", value: 72 },
          { name: "charging", type: "bool", value: false },
        ];
      },
    },
    {
      id: "iot",
      label: "IoT panel",
      widgets(d, genId) {
        const gw = Math.min(80, idiv(d.w - 28, 2));
        return [
          { id: genId("w"), type: "gauge", x: 14, y: 12, w: gw, h: 72, label: "Speed", key: "speed", min: 0, max: 100, decimals: 0 },
          { id: genId("w"), type: "icon", x: 14 + gw + 12, y: 20, w: 32, h: 32, icon: "wifi", scale: 1 },
          { id: genId("w"), type: "metric", x: 14 + gw + 8, y: 56, w: d.w - 28 - gw - 8, h: 34, label: "Status", key: "status", unit: "", decimals: 0 },
          {
            id: genId("w"),
            type: "button",
            x: 14,
            y: d.h - 44,
            w: d.w - 28,
            h: 32,
            label: "Start",
            icon: "power",
            action: "callback",
            callbackId: "start",
          },
        ];
      },
    },
  ];

  function idiv(a, b) {
    return Math.trunc(a / b);
  }

  function list() {
    return PRESETS.map((p) => ({ id: p.id, label: p.label }));
  }

  function apply(presetId, screen, dims, genId, project) {
    const p = PRESETS.find((x) => x.id === presetId);
    if (!p || !screen) return false;
    const d = dims || { w: 240, h: 240 };
    screen.widgets = screen.widgets || [];
    screen.widgets.push(...p.widgets(d, genId));
    if (project && p.keys) {
      project.keys = project.keys || [];
      p.keys().forEach((k) => {
        if (!project.keys.find((x) => x.name === k.name)) project.keys.push(k);
      });
    }
    return true;
  }

  window.LucarneTemplates = { list, apply };
})();
