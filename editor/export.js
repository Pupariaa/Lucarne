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

  function buildHeader(LE, hasFonts) {
    const project = LE.project;
    const theme = project.theme;
    const lines = [];
    const p = (s) => lines.push(s);

    p("#ifndef PROJET_H");
    p("#define PROJET_H");
    p("");
    p("#include <Lucarne.h>");
    if (hasFonts) p('#include "Projet_fonts.h"');
    p("");
    p("using namespace lucarne;");
    p("");
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
          p("Icon " + v + "(" + w.x + ", " + w.y + ", iconFromName(" + cstr(w.icon) + "), " + (w.scale || 1) + ");");
        } else if (w.type === "menu") {
          p("Menu " + v + "(" + w.x + ", " + w.y + ", " + w.w + ", " + w.h + ");");
        }
      });
    });
    p("");

    p("// ---- Screens ----");
    project.screens.forEach((s) => {
      p("Screen screen_" + ident(s.id) + "(" + cstr(s.name || s.id) + ");");
    });
    p("");

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

    p("inline void build(UI &ui) {");
    p("    ui.setTheme(makeTheme());");
    p("    ui.setTransition(" + transEnum(project.transition.default) + ", " + (project.transition.durationMs || 220) + ");");
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
          (w.items || []).forEach((it) => {
            const target = it.target ? "&screen_" + ident(it.target) : "nullptr";
            p(
              "    " + v + ".addItem(" + cstr(it.label) + ", iconFromName(" + cstr(it.icon || "none") + "), " + target + ", " + transEnum(it.transition) + ");"
            );
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
    p("    ui.show(&screen_" + ident(start) + ");");
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
    const main = buildHeader(LE, !!fonts);
    const files = [{ name: "Projet.h", content: main }];
    if (fonts) files.push({ name: "Projet_fonts.h", content: fonts });
    return files;
  }

  window.LucarneExport = { buildAll };
})();
