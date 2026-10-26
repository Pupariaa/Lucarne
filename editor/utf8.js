(function () {
  "use strict";

  function forEachCodepoint(str, fn) {
    if (!str) return;
    for (let i = 0; i < str.length; i++) {
      let cp = str.charCodeAt(i);
      if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
        const lo = str.charCodeAt(i + 1);
        if (lo >= 0xdc00 && lo <= 0xdfff) {
          cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
          i++;
        }
      }
      fn(cp);
    }
  }

  function scanText(set, str) {
    forEachCodepoint(str, (cp) => {
      if (cp >= 32 && cp <= 255) set.add(cp);
    });
  }

  function collectProjectCodepoints(project) {
    const set = new Set();
    for (let c = 32; c <= 126; c++) set.add(c);
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        scanText(set, w.text);
        scanText(set, w.label);
        if (w.type === "menu") {
          (w.items || []).forEach((it) => scanText(set, it.label));
        }
        if (w.type === "list") {
          (w.items || []).forEach((it) => {
            scanText(set, typeof it === "string" ? it : it.label);
          });
        }
      });
    });
    return set;
  }

  function fontExportLast(used) {
    let last = 126;
    used.forEach((c) => {
      if (c > last && c <= 255) last = c;
    });
    return last;
  }

  window.LucarneUtf8 = {
    forEachCodepoint,
    scanText,
    collectProjectCodepoints,
    fontExportLast,
  };
})();
