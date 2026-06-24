(function () {
  "use strict";

  const STORAGE_KEY = "lucarne_project_v2";

  const DEVICES = {
    st7789_169: { label: 'ST7789 1.69" 240x280', driver: "ST7789", w: 240, h: 280, inch: 1.69 },
    st7789_13: { label: 'ST7789 1.3" 240x240', driver: "ST7789", w: 240, h: 240, inch: 1.3 },
    st7735_18: { label: 'ST7735S 1.8" 160x128', driver: "ST7735S", w: 160, h: 128, inch: 1.8 },
    st7735_144: { label: 'ST7735S 1.44" 128x128', driver: "ST7735S", w: 128, h: 128, inch: 1.44 },
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
      buttons: { up: 25, down: 26, ok: 27, back: 14 },
      encoder: { a: 25, b: 26, btn: 27 },
    };
  }

  function defaultProject() {
    const dashId = "dash";
    const homeId = "home";
    return {
      name: "MyProject",
      deviceId: "st7789_169",
      rotation: 0,
      theme: defaultTheme(),
      fonts: defaultFonts(),
      input: defaultInput(),
      transition: { default: "SlideLeft", durationMs: 220 },
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
              align: "center",
              font: "title",
            },
            {
              id: genId("w"),
              type: "menu",
              x: 12,
              y: 60,
              w: 216,
              h: 200,
              items: [
                { id: genId("it"), label: "Dashboard", icon: "chart", target: dashId, transition: "Inherit" },
                { id: genId("it"), label: "Sensors", icon: "thermo", target: dashId, transition: "Fade" },
                { id: genId("it"), label: "Settings", icon: "settings", target: "", transition: "Inherit" },
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
              align: "center",
              font: "title",
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
              align: "left",
              color: "#8ca0be",
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

  function dims(project) {
    const d = device(project);
    if (project.rotation === 1 || project.rotation === 3) return { w: d.h, h: d.w };
    return { w: d.w, h: d.h };
  }

  function getScreen(project, id) {
    return project.screens.find((s) => s.id === id) || null;
  }

  function iconNames() {
    const t = window.LUCARNE_ICONS || {};
    return ["none"].concat(Object.keys(t));
  }

  function save(project) {
    try {
      const clone = JSON.parse(JSON.stringify(project));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
    } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  window.LucarneState = {
    DEVICES,
    THEME_KEYS,
    TRANSITIONS,
    genId,
    defaultProject,
    defaultTheme,
    defaultFonts,
    defaultInput,
    device,
    dims,
    getScreen,
    iconNames,
    save,
    load,
    clearSaved,
  };
})();
