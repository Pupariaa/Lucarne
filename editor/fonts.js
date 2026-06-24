(function () {
  "use strict";

  const cache = {};

  function bake(cssFamily, sizePx, weight) {
    const key = cssFamily + "|" + sizePx + "|" + (weight || 400);
    if (cache[key]) return cache[key];

    const pad = Math.ceil(sizePx * 0.7) + 4;
    const cw = sizePx * 2 + pad * 2;
    const chh = sizePx * 3;
    const cv = document.createElement("canvas");
    cv.width = cw;
    cv.height = chh;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.font = (weight || 400) + " " + sizePx + 'px "' + cssFamily + '", sans-serif';
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    const originX = pad;
    const baseY = Math.round(sizePx * 1.6);
    const glyphs = {};

    for (let code = 32; code <= 126; code++) {
      const ch = String.fromCharCode(code);
      ctx.clearRect(0, 0, cw, chh);
      ctx.fillStyle = "#fff";
      ctx.fillText(ch, originX, baseY);
      const adv = Math.round(ctx.measureText(ch).width);
      const img = ctx.getImageData(0, 0, cw, chh).data;

      let minx = cw,
        miny = chh,
        maxx = -1,
        maxy = -1;
      for (let y = 0; y < chh; y++) {
        for (let x = 0; x < cw; x++) {
          const a = img[(y * cw + x) * 4 + 3];
          if (a > 0) {
            if (x < minx) minx = x;
            if (x > maxx) maxx = x;
            if (y < miny) miny = y;
            if (y > maxy) maxy = y;
          }
        }
      }

      if (maxx < minx) {
        glyphs[code] = { w: 0, h: 0, adv, xo: 0, yo: 0, cov: null };
        continue;
      }

      const gw = maxx - minx + 1;
      const gh = maxy - miny + 1;
      const cov = new Uint8Array(gw * gh);
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          cov[y * gw + x] = img[((miny + y) * cw + (minx + x)) * 4 + 3];
        }
      }
      glyphs[code] = { w: gw, h: gh, adv, xo: minx - originX, yo: miny - baseY, cov };
    }

    const m = ctx.measureText("Hg");
    let yAdv = Math.round(
      (m.actualBoundingBoxAscent || sizePx * 0.8) +
        (m.actualBoundingBoxDescent || sizePx * 0.2) +
        sizePx * 0.35
    );
    if (!yAdv || yAdv < sizePx) yAdv = Math.round(sizePx * 1.3);

    const atlas = { first: 32, last: 126, yAdvance: yAdv, sizePx, glyphs };
    cache[key] = atlas;
    return atlas;
  }

  function loadGoogle(family, weight) {
    return new Promise((resolve) => {
      const id = "gf-" + family.replace(/\s+/g, "-");
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=" +
          encodeURIComponent(family) +
          ":wght@400;500;700&display=swap";
        document.head.appendChild(link);
      }
      const probe = '16px "' + family + '"';
      document.fonts
        .load(probe)
        .then(() => document.fonts.load((weight || 400) + " " + probe))
        .then(() => resolve(family))
        .catch(() => resolve(family));
    });
  }

  async function loadUpload(file) {
    const buf = await file.arrayBuffer();
    const fam =
      "Up-" + file.name.replace(/[^a-z0-9]/gi, "").slice(0, 12) + "-" + Date.now().toString(36);
    const ff = new FontFace(fam, buf);
    await ff.load();
    document.fonts.add(ff);
    return { family: fam, base64: arrayBufferToBase64(buf) };
  }

  function arrayBufferToBase64(buf) {
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function loadBase64(family, base64) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ff = new FontFace(family, bytes.buffer);
    await ff.load();
    document.fonts.add(ff);
    return family;
  }

  function toC(name, atlas) {
    const cov = [];
    const glyphLines = [];
    let offset = 0;
    for (let code = atlas.first; code <= atlas.last; code++) {
      const g = atlas.glyphs[code] || { w: 0, h: 0, adv: 0, xo: 0, yo: 0, cov: null };
      glyphLines.push("  {" + offset + ", " + g.w + ", " + g.h + ", " + g.adv + ", " + g.xo + ", " + g.yo + "},");
      if (g.cov) {
        for (let i = 0; i < g.cov.length; i++) cov.push(g.cov[i]);
        offset += g.w * g.h;
      }
    }
    let s = "static const uint8_t " + name + "_COV[] = {\n";
    for (let i = 0; i < cov.length; i += 20) s += "  " + cov.slice(i, i + 20).join(", ") + ",\n";
    s += "};\n\n";
    s += "static const AAGlyph " + name + "_GLYPHS[] = {\n" + glyphLines.join("\n") + "\n};\n\n";
    s +=
      "const AAFont " +
      name +
      " = {" +
      name +
      "_COV, " +
      name +
      "_GLYPHS, " +
      atlas.first +
      ", " +
      atlas.last +
      ", " +
      atlas.yAdvance +
      ", " +
      atlas.sizePx +
      "};\n\n";
    return s;
  }

  let defaultReady = null;
  function ensureDefault() {
    if (!defaultReady) defaultReady = loadGoogle("Fira Sans", 400);
    return defaultReady;
  }

  window.LucarneFonts = {
    bake,
    loadGoogle,
    loadUpload,
    loadBase64,
    toC,
    ensureDefault,
  };
})();
