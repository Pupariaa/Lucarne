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
      buttons: { up: 6, down: 7, ok: 8, back: 9 },
      encoder: { a: 6, b: 7, btn: 8 },
    };
  }

  function defaultUiSource() {
    return { mode: "project", url: "", sdPath: "/ui.lucarne.json" };
  }

  const LIVE_SPEED_KEY = "lucarne_live_speed";
  const LIVE_SPEEDS = [
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
      transition: { default: "SlideLeft", durationMs: 220 },
      images: {},
      icons: {},
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

  function iconNames(project) {
    const t = window.LUCARNE_ICONS || {};
    const names = ["none"].concat(Object.keys(t));
    if (project && project.icons) {
      Object.keys(project.icons).forEach((id) => names.push("c:" + id));
    }
    return names;
  }

  function save(project) {
    try {
      const clone = JSON.parse(JSON.stringify(project));
      if (project.images) {
        clone.images = {};
        Object.keys(project.images).forEach((id) => {
          const img = project.images[id];
          if (img && img.pixels) clone.images[id] = window.LucarneAssets.serialize(img);
          else clone.images[id] = img;
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
    } catch (e) {}
  }

  function hydrate(project) {
    if (!project) return project;
    if (!project.images) project.images = {};
    Object.keys(project.images).forEach((id) => {
      const raw = project.images[id];
      if (raw && raw.b64) project.images[id] = window.LucarneAssets.deserialize(raw);
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
    if (!project.panelWidth || !project.panelHeight) {
      const d = device(project);
      project.panelWidth = d.w;
      project.panelHeight = d.h;
    }
    return project;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return hydrate(JSON.parse(raw));
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
    nativeDims,
    dims,
    getScreen,
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
  };
})();
