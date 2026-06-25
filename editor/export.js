(function () {
  "use strict";

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

  function transEnum(t) {
    return "Transition::" + (t && t !== "Inherit" ? t : "Inherit");
  }

  function fontCName(LE, id) {
    const f = LE.project.fonts[id];
    if (!f) return null;
    return f.builtin ? f.cName : "Font_" + ident(id);
  }

  function buildFontsHeader(LE) {
    const project = LE.project;
    let body = "";
    let count = 0;
    Object.keys(project.fonts).forEach((id) => {
      const f = project.fonts[id];
      if (f.builtin) return;
      const atlas = LE.fontAtlas(id);
      if (!atlas) return;
      body += "// Font: " + (f.label || id) + " (" + (f.family || "") + " " + f.sizePx + "px)\n";
      body += window.LucarneFonts.toC("Font_" + ident(id), atlas);
      count++;
    });
    if (!count) return null;
    let h = "#ifndef PROJET_FONTS_H\n#define PROJET_FONTS_H\n\n";
    h += "#include <Lucarne.h>\n\n";
    h += "namespace lucarne {\n\n";
    h += body;
    h += "}\n\n#endif\n";
    return h;
  }

  function buildImagesHeader(LE) {
    const project = LE.project;
    if (!project.images) return null;
    let body = "";
    let count = 0;
    Object.keys(project.images).forEach((id) => {
      const img = project.images[id];
      if (!img) return;
      const st = img.storage || "flash";
      if (!img.pixels && st !== "sd" && st !== "web") return;
      body += "// Image: " + (img.label || id) + " (" + img.w + "x" + img.h + ", " + st + ")\n";
      body += window.LucarneAssets.toC("Img_" + ident(id), img);
      count++;
    });
    if (!count) return null;
    let h = "#ifndef PROJET_IMAGES_H\n#define PROJET_IMAGES_H\n\n";
    h += "#include <Lucarne.h>\n\n";
    h += "namespace lucarne {\n\n";
    h += body;
    h += "}\n\n#endif\n";
    return h;
  }

  function buildIconsHeader(LE) {
    const project = LE.project;
    let body = "";
    let count = 0;
    const rowDispatch = [];
    const imgDispatch = [];

    function addIcon(ref, icon) {
      if (!icon) return;
      const safe = ident(ref.replace(/:/g, "_"));
      body += "// " + ref + "\n";
      if (icon.pixels) {
        const cname = "Ico_" + safe + "_img";
        body += window.LucarneAssets.toC(cname, {
          w: icon.w,
          h: icon.h,
          pixels: icon.pixels,
          storage: "flash",
          source: "",
        });
        imgDispatch.push({ key: ref, fn: cname });
      } else if (icon.rows) {
        const cname = "Ico_" + safe;
        body += window.LucarneAssets.toIconC(cname, icon);
        rowDispatch.push({ key: ref, fn: cname });
      } else return;
      count++;
    }

    function collectRefs() {
      const set = new Set();
      function use(ref) {
        if (ref && ref !== "none") set.add(ref);
      }
      (project.screens || []).forEach((s) => {
        (s.widgets || []).forEach((w) => {
          if (w.type === "icon") use(w.icon);
          if (w.type === "button") use(w.icon);
          if (w.type === "menu")
            (w.items || []).forEach((it) => {
              use(it.icon);
              const ri = it.rightIcon;
              if (ri && ri !== "none" && ri !== "auto") use(ri);
            });
        });
      });
      return Array.from(set);
    }

    collectRefs().forEach((ref) => {
      if (ref.indexOf("c:") === 0) {
        const id = ref.slice(2);
        const ic = project.icons && project.icons[id];
        if (ic) addIcon(ref, window.LucarneAssets.iconAtlas(ic) || ic);
        return;
      }
      if (window.LucarneIconPacks) {
        const ic = window.LucarneIconPacks.getIcon(ref);
        if (ic) {
          addIcon(ref, ic);
          return;
        }
      }
      if (ref.indexOf("tabler:") === 0 && window.LucarneTabler) {
        const ic = window.LucarneTabler.getIcon(ref.slice(7));
        if (ic) addIcon(ref, ic);
      }
    });

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
    h += "}  // namespace projet\n\n#endif\n";
    return h;
  }

  function iconRefExpr(name) {
    if (!name || name === "none") return "nullptr";
    return cstr(name);
  }

  function iconExpr(name) {
    return iconRefExpr(name);
  }

  function menuItemOptsExpr(it) {
    const ri = it.rightIcon || "auto";
    const is = it.iconScale | 0;
    const bs = it.rightIconScale | 0;
    const autoRi = ri === "auto" || ri === "";
    const noRi = ri === "none";
    if (autoRi && !is && !bs) return "";
    let badgeArg = "nullptr";
    let hidden = "false";
    if (noRi) hidden = "true";
    else if (!autoRi) badgeArg = iconRefExpr(ri);
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
        }
      });
    });
    return map;
  }

  function buildHeader(LE, hasFonts, hasImages, hasIcons) {
    const project = LE.project;
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

    const varOf = {};
    let n = 0;
    project.screens.forEach((s) => {
      s.widgets.forEach((w) => {
        varOf[w.id] = "w" + n++;
      });
    });

    p("// ---- Widgets ----");
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
          p("Icon " + v + "(" + w.x + ", " + w.y + ", " + iconExpr(w.icon) + ", " + (w.scale || 1) + ");");
        } else if (w.type === "image") {
          const asset = w.imageId ? "&Img_" + ident(w.imageId) : "nullptr";
          p("Image " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ", " + asset + ");");
        } else if (w.type === "menu") {
          p("Menu " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ");");
        } else if (w.type === "button") {
          p("Button " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ", " + cstr(w.label || "Button") + ");");
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

    p("inline Theme makeTheme() {");
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
    p("    ui.setTransition(" + transEnum(project.transition.default) + ", " + (project.transition.durationMs || 220) + ");");
    if (hasIcons) p("    lucarne::setIconLookups(projet::iconRowsByRef, projet::iconImageByRef);");
    if (cbIds.length > 0) p("    // Menu callbacks are polled in loop() — see pollMenuAction() below");
    p("");

    project.screens.forEach((s) => {
      s.widgets.forEach((w) => {
        const v = varOf[w.id];
        if (w.type === "label") {
          if (w.w > 0 && w.h > 0) p("    " + v + ".setBounds(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ");");
          if (w.font === "title" && titleFont) p("    " + v + ".setFont(&" + titleFont + ");");
          if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
          if (w.size) p("    " + v + ".setSize(" + w.size + ");");
        } else if (w.type === "metric") {
          if (w.decimals !== undefined) p("    " + v + ".setDecimals(" + w.decimals + ");");
          if (w.accent) p("    " + v + ".setAccent(" + col(w.accent) + ");");
        } else if (w.type === "bar") {
          if (w.showValue) p("    " + v + ".setShowValue(true);");
          if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
        } else if (w.type === "icon") {
          if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
        } else if (w.type === "menu") {
          if (w.iconScale && w.iconScale !== 1) p("    " + v + ".setIconScale(" + w.iconScale + ");");
          if (w.badgeScale && w.badgeScale !== 1) p("    " + v + ".setBadgeScale(" + w.badgeScale + ");");
          (w.items || []).forEach((it) => {
            const opts = menuItemOptsExpr(it);
            if (it.action === "callback" && it.callbackId) {
              const cid = ident(it.callbackId);
              p(
                "    " +
                  v +
                  ".addCallbackItem(" +
                  cstr(it.label) +
                  ", " +
                  iconExpr(it.icon || "none") +
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
                  iconExpr(it.icon || "none") +
                  ", " +
                  target +
                  ", " +
                  transEnum(it.transition) +
                  opts +
                  ");"
              );
            }
          });
        } else if (w.type === "button") {
          if (w.icon && w.icon !== "none") p("    " + v + ".setIconRef(" + iconExpr(w.icon) + ");");
          if (w.fill && w.textColor) p("    " + v + ".setColor(" + col(w.fill) + ", " + col(w.textColor) + ");");
          else if (w.fill) p("    " + v + ".setColor(" + col(w.fill) + ", " + col(theme.background) + ");");
          if (w.action === "callback" && w.callbackId) {
            p("    " + v + ".setCallback(" + (cbMap[ident(w.callbackId)] || 0) + ");");
          } else if (w.target) {
            p("    " + v + ".setNavigate(&screen_" + ident(w.target) + ", " + transEnum(w.transition) + ");");
          }
        } else if (w.type === "slider") {
          if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
        } else if (w.type === "chart") {
          (w.keys || []).forEach((key, idx) => {
            if (key) p("    " + v + ".setKey(" + idx + ", " + cstr(key) + ");");
          });
          p("    " + v + ".setRange(" + floatLit(w.min || 0) + ", " + floatLit(w.max === undefined ? 100 : w.max) + ");");
          if (w.color) p("    " + v + ".setColor(" + col(w.color) + ");");
        } else if (w.type === "gauge") {
          if (w.accent) p("    " + v + ".setAccent(" + col(w.accent) + ");");
        } else if (w.type === "list") {
          (w.items || []).forEach((it) => {
            p("    " + v + ".addItem(" + cstr(typeof it === "string" ? it : it.label || "") + ");");
          });
        }
      });
    });
    p("");

    project.screens.forEach((s) => {
      const sv = "screen_" + ident(s.id);
      s.widgets.forEach((w) => {
        p("    " + sv + ".add(&" + varOf[w.id] + ");");
      });
      if (s.cornerRadius) p("    setupScreen_" + ident(s.id) + "();");
    });
    p("");

    (project.keys || []).forEach((k) => {
      if (k.type === "float") p("    ui.setFloat(" + cstr(k.name) + ", " + floatLit(k.value || 0) + ");");
      else if (k.type === "int") p("    ui.setInt(" + cstr(k.name) + ", " + Math.trunc(k.value || 0) + ");");
      else if (k.type === "bool") p("    ui.setBool(" + cstr(k.name) + ", " + (k.value ? "true" : "false") + ");");
      else if (k.type === "string") p("    ui.setString(" + cstr(k.name) + ", " + cstr(k.value || "") + ");");
    });
    p("");

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
        "    input.begin(" + (b.up | 0) + ", " + (b.down | 0) + ", " + (b.ok | 0) + ", " + (b.back | 0) + ", " + (inp.activeLow ? "true" : "false") + ");"
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
      p("    // Call projet::input.feed(x, y, pressed) from your touch driver.");
    } else {
      p("    (void)ui;");
    }
    p("}");
    p("");

    p("inline void update() {");
    if (inp.type === "buttons" || inp.type === "encoder") {
      p("    input.update();");
    } else {
      p("    // Touch input is driven by feed(); nothing to poll.");
    }
    p("}");
    p("");
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
    p("//   Display display; UI ui(display);");
    p("//   display.begin(pins, options, buffer);");
    p("//   projet::build(ui);");
    p("//   projet::attachInput(ui);");
    p("//   ui.begin();");
    p("//   void loop() { projet::update(); ui.update(); }");
    p("");
    p("#endif");

    return lines.join("\n");
  }

  function buildAll(LE) {
    const fonts = buildFontsHeader(LE);
    const images = buildImagesHeader(LE);
    const icons = buildIconsHeader(LE);
    const main = buildHeader(LE, !!fonts, !!images, !!icons);
    const files = [{ name: "Projet.h", content: main }];
    if (fonts) files.push({ name: "Projet_fonts.h", content: fonts });
    if (images) files.push({ name: "Projet_images.h", content: images });
    if (icons) files.push({ name: "Projet_icons.h", content: icons });
    if (LE.project.images) {
      Object.keys(LE.project.images).forEach((id) => {
        const img = LE.project.images[id];
        if (img && img.storage === "sd" && img.pixels) {
          const bin = window.LucarneAssets.exportRgb565Bin(img);
          if (bin) {
            files.push({ name: "assets/" + ident(id) + ".rgb565", content: bin, binary: true });
          }
        }
      });
    }

    return files;
  }

  window.LucarneExport = { buildAll };
})();
