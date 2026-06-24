(function () {
  "use strict";

  const idiv = (a, b) => Math.trunc(a / b);

  function color565(r, g, b) {
    return (((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)) & 0xffff;
  }

  function hexTo565(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return color565(r, g, b);
  }

  function rgb565to888(c) {
    let r = (c >> 11) & 0x1f;
    let g = (c >> 5) & 0x3f;
    let b = c & 0x1f;
    r = (r << 3) | (r >> 2);
    g = (g << 2) | (g >> 4);
    b = (b << 3) | (b >> 2);
    return [r, g, b];
  }

  function blend565(bg, fg, a) {
    const ar = (bg >> 11) & 0x1f;
    const ag = (bg >> 5) & 0x3f;
    const ab = bg & 0x1f;
    const br = (fg >> 11) & 0x1f;
    const bgc = (fg >> 5) & 0x3f;
    const bb = fg & 0x1f;
    const rr = ar + (((br - ar) * a) >> 8);
    const rg = ag + (((bgc - ag) * a) >> 8);
    const rb = ab + (((bb - ab) * a) >> 8);
    return ((rr << 11) | (rg << 5) | rb) & 0xffff;
  }

  class Display {
    constructor(width, height) {
      this.setSize(width, height);
    }

    setSize(width, height) {
      this.width = width;
      this.height = height;
      this.fb = new Uint16Array(width * height);
    }

    writePixel(x, y, color) {
      x = x | 0;
      y = y | 0;
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
      this.fb[y * this.width + x] = color & 0xffff;
    }

    drawPixel(x, y, color) {
      this.writePixel(x, y, color);
    }

    writeFastHLine(x, y, w, color) {
      if (w < 0) {
        x += w + 1;
        w = -w;
      }
      for (let i = 0; i < w; i++) this.writePixel(x + i, y, color);
    }

    writeFastVLine(x, y, h, color) {
      if (h < 0) {
        y += h + 1;
        h = -h;
      }
      for (let i = 0; i < h; i++) this.writePixel(x, y + i, color);
    }

    writeFillRect(x, y, w, h, color) {
      for (let j = 0; j < h; j++) this.writeFastHLine(x, y + j, w, color);
    }

    fillRect(x, y, w, h, color) {
      this.writeFillRect(x, y, w, h, color);
    }

    drawRect(x, y, w, h, color) {
      this.writeFastHLine(x, y, w, color);
      this.writeFastHLine(x, y + h - 1, w, color);
      this.writeFastVLine(x, y, h, color);
      this.writeFastVLine(x + w - 1, y, h, color);
    }

    fillScreen(color) {
      this.fb.fill(color & 0xffff);
    }

    drawCircleHelper(x0, y0, r, corner, color) {
      let f = 1 - r;
      let ddF_x = 1;
      let ddF_y = -2 * r;
      let x = 0;
      let y = r;
      while (x < y) {
        if (f >= 0) {
          y--;
          ddF_y += 2;
          f += ddF_y;
        }
        x++;
        ddF_x += 2;
        f += ddF_x;
        if (corner & 0x4) {
          this.writePixel(x0 + x, y0 + y, color);
          this.writePixel(x0 + y, y0 + x, color);
        }
        if (corner & 0x2) {
          this.writePixel(x0 + x, y0 - y, color);
          this.writePixel(x0 + y, y0 - x, color);
        }
        if (corner & 0x8) {
          this.writePixel(x0 - y, y0 + x, color);
          this.writePixel(x0 - x, y0 + y, color);
        }
        if (corner & 0x1) {
          this.writePixel(x0 - y, y0 - x, color);
          this.writePixel(x0 - x, y0 - y, color);
        }
      }
    }

    fillCircleHelper(x0, y0, r, corner, delta, color) {
      let f = 1 - r;
      let ddF_x = 1;
      let ddF_y = -2 * r;
      let x = 0;
      let y = r;
      let px = x;
      let py = y;
      delta++;
      while (x < y) {
        if (f >= 0) {
          y--;
          ddF_y += 2;
          f += ddF_y;
        }
        x++;
        ddF_x += 2;
        f += ddF_x;
        if (x < y + 1) {
          if (corner & 1) this.writeFastVLine(x0 + x, y0 - y, 2 * y + delta, color);
          if (corner & 2) this.writeFastVLine(x0 - x, y0 - y, 2 * y + delta, color);
        }
        if (y !== py) {
          if (corner & 1) this.writeFastVLine(x0 + py, y0 - px, 2 * px + delta, color);
          if (corner & 2) this.writeFastVLine(x0 - py, y0 - px, 2 * px + delta, color);
          py = y;
        }
        px = x;
      }
    }

    drawRoundRect(x, y, w, h, r, color) {
      const maxRadius = idiv(w < h ? w : h, 2);
      if (r > maxRadius) r = maxRadius;
      this.writeFastHLine(x + r, y, w - 2 * r, color);
      this.writeFastHLine(x + r, y + h - 1, w - 2 * r, color);
      this.writeFastVLine(x, y + r, h - 2 * r, color);
      this.writeFastVLine(x + w - 1, y + r, h - 2 * r, color);
      this.drawCircleHelper(x + r, y + r, r, 1, color);
      this.drawCircleHelper(x + w - r - 1, y + r, r, 2, color);
      this.drawCircleHelper(x + w - r - 1, y + h - r - 1, r, 4, color);
      this.drawCircleHelper(x + r, y + h - r - 1, r, 8, color);
    }

    fillRoundRect(x, y, w, h, r, color) {
      const maxRadius = idiv(w < h ? w : h, 2);
      if (r > maxRadius) r = maxRadius;
      this.writeFillRect(x + r, y, w - 2 * r, h, color);
      this.fillCircleHelper(x + w - r - 1, y + r, r, 1, h - 2 * r - 1, color);
      this.fillCircleHelper(x + r, y + r, r, 2, h - 2 * r - 1, color);
    }

    drawCharClassic(x, y, c, color, size) {
      const FONT = window.LUCARNE_FONT5x7;
      c = c & 0xff;
      for (let i = 0; i < 5; i++) {
        let line = FONT[c * 5 + i];
        for (let j = 0; j < 8; j++, line >>= 1) {
          if (line & 1) {
            if (size === 1) this.writePixel(x + i, y + j, color);
            else this.fillRect(x + i * size, y + j * size, size, size, color);
          }
        }
      }
    }

    printClassic(x, y, text, color, size) {
      let cx = x;
      for (let k = 0; k < text.length; k++) {
        const code = text.charCodeAt(k);
        if (code === 10) continue;
        this.drawCharClassic(cx, y, code, color, size);
        cx += 6 * size;
      }
    }

    drawTextAA(atlas, penX, baselineY, text, fg, bg) {
      let pen = penX;
      for (let k = 0; k < text.length; k++) {
        const code = text.charCodeAt(k);
        const g = atlas.glyphs[code];
        if (!g) continue;
        if (g.w > 0 && g.h > 0 && g.cov) {
          const gx = pen + g.xo;
          const gy = baselineY + g.yo;
          for (let yy = 0; yy < g.h; yy++) {
            for (let xx = 0; xx < g.w; xx++) {
              const a = g.cov[yy * g.w + xx];
              if (a === 0) continue;
              const out = a >= 250 ? fg : blend565(bg, fg, a);
              this.writePixel(gx + xx, gy + yy, out);
            }
          }
        }
        pen += g.adv;
      }
    }

    drawIconRows(rows, x, y, scale, color) {
      if (!rows) return;
      if (scale < 1) scale = 1;
      for (let ry = 0; ry < 16; ry++) {
        const bits = rows[ry];
        if (!bits) continue;
        for (let rx = 0; rx < 16; rx++) {
          if (bits & (0x8000 >> rx)) {
            if (scale === 1) this.writePixel(x + rx, y + ry, color);
            else this.fillRect(x + rx * scale, y + ry * scale, scale, scale, color);
          }
        }
      }
    }

    blitTo(ctx) {
      const img = ctx.createImageData(this.width, this.height);
      const d = img.data;
      for (let i = 0; i < this.fb.length; i++) {
        const [r, g, b] = rgb565to888(this.fb[i]);
        const o = i * 4;
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = b;
        d[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
  }

  function getAATextBounds(atlas, text) {
    let pen = 0;
    let loX = 32767;
    let loY = 32767;
    let hiX = -32768;
    let hiY = -32768;
    for (let k = 0; k < text.length; k++) {
      const g = atlas.glyphs[text.charCodeAt(k)];
      if (!g) continue;
      if (g.w > 0 && g.h > 0) {
        const gx = pen + g.xo;
        const gy = g.yo;
        if (gx < loX) loX = gx;
        if (gy < loY) loY = gy;
        if (gx + g.w > hiX) hiX = gx + g.w;
        if (gy + g.h > hiY) hiY = gy + g.h;
      }
      pen += g.adv;
    }
    if (hiX <= loX) return { minx: 0, miny: 0, w: 0, h: 0 };
    return { minx: loX, miny: loY, w: hiX - loX, h: hiY - loY };
  }

  function textWidthClassic(text, size) {
    return text.length * 6 * size;
  }

  function drawText(disp, text, bx, by, bw, bh, align, color, size, bg, atlas) {
    if (!text || text.length === 0) return;
    if (atlas) {
      const b = getAATextBounds(atlas, text);
      let left = bx;
      if (align === "center") left = bx + idiv(bw - b.w, 2);
      else if (align === "right") left = bx + bw - b.w;
      const top = by + idiv(bh - b.h, 2);
      disp.drawTextAA(atlas, left - b.minx, top - b.miny, text, color, bg);
      return;
    }
    const tw = textWidthClassic(text, size);
    const th = 8 * size;
    let cx = bx;
    if (align === "center") cx = bx + idiv(bw - tw, 2);
    else if (align === "right") cx = bx + bw - tw;
    const cy = by + idiv(bh - th, 2);
    disp.printClassic(cx, cy, text, color, size);
  }

  function iconRows(name) {
    if (!name || name === "none") return null;
    const tbl = window.LUCARNE_ICONS || {};
    return tbl[name] || null;
  }

  function formatMetric(rec, unit, decimals) {
    if (!rec) return "--" + unit;
    if (rec.type === "string") return rec.value !== undefined ? String(rec.value) : "--";
    if (rec.type === "bool") return rec.value ? "ON" : "OFF";
    const num = Number(rec.value) || 0;
    if (decimals === 0) return Math.trunc(num) + unit;
    return num.toFixed(decimals) + unit;
  }

  function textBoundsAny(atlas, text, size) {
    if (atlas) {
      const b = getAATextBounds(atlas, text);
      return { w: b.w, h: b.h };
    }
    return { w: textWidthClassic(text, size), h: 8 * size };
  }

  function drawWidget(disp, w, t, env) {
    const fontBody = t.fontBody || null;
    const fontTitle = t.fontTitle || null;

    if (w.type === "label") {
      const size = w.size || t.textSize;
      const color = w.color ? hexTo565(w.color) : t.text;
      const atlas = w.font === "title" ? fontTitle : fontBody;
      let bw = w.w || 0;
      let bh = w.h || 0;
      if (bw <= 0 || bh <= 0) {
        const m = textBoundsAny(atlas, w.text || "", size);
        if (bw <= 0) bw = m.w;
        if (bh <= 0) bh = m.h;
      }
      drawText(disp, w.text || "", w.x, w.y, bw, bh, w.align || "left", color, size, t.background, atlas);
    } else if (w.type === "metric") {
      const r = t.radius;
      disp.fillRoundRect(w.x, w.y, w.w, w.h, r, t.surface);
      disp.drawRoundRect(w.x, w.y, w.w, w.h, r, t.surfaceEdge);
      const accent = w.accent ? hexTo565(w.accent) : t.primary;
      const barW = 4;
      const barH = w.h - t.padding;
      const barY = w.y + idiv(w.h - barH, 2);
      disp.fillRoundRect(w.x + 3, barY, barW, barH, 2, accent);
      const pad = t.padding;
      const contentX = w.x + 3 + barW + pad;
      const contentW = w.w - (3 + barW + pad) - pad;
      const labelW = idiv(contentW * 6, 10);
      const valueW = contentW - labelW;
      drawText(disp, w.label || "", contentX, w.y, labelW, w.h, "left", t.textDim, t.textSize, t.surface, fontBody);
      const rec = env.getValue(w.key);
      const val = formatMetric(rec, w.unit || "", w.decimals === undefined ? 1 : w.decimals);
      drawText(disp, val, contentX + labelW, w.y, valueW, w.h, "right", t.text, t.textSize, t.surface, fontBody);
    } else if (w.type === "bar") {
      let r = idiv(w.h, 2);
      if (r > t.radius) r = t.radius;
      disp.fillRoundRect(w.x, w.y, w.w, w.h, r, t.surface);
      disp.drawRoundRect(w.x, w.y, w.w, w.h, r, t.surfaceEdge);
      const min = w.min === undefined ? 0 : w.min;
      const max = w.max === undefined ? 1 : w.max;
      const span = max - min;
      const rec = env.getValue(w.key);
      const v = rec ? Number(rec.value) || min : min;
      let ratio = span !== 0 ? (v - min) / span : 0;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;
      const inset = 2;
      const trackW = w.w - inset * 2;
      const fillW = Math.trunc(trackW * ratio);
      const color = w.color ? hexTo565(w.color) : t.primary;
      if (fillW > 0) {
        let fr = r - inset;
        if (fr < 0) fr = 0;
        disp.fillRoundRect(w.x + inset, w.y + inset, fillW, w.h - inset * 2, fr, color);
      }
      if (w.showValue) {
        const pct = Math.trunc(ratio * 100 + 0.5) + "%";
        const txtBg = fillW > w.w / 2 ? color : t.surface;
        drawText(disp, pct, w.x, w.y, w.w, w.h, "center", t.text, t.textSize, txtBg, fontBody);
      }
    } else if (w.type === "icon") {
      const color = w.color ? hexTo565(w.color) : t.text;
      const scale = w.scale || 1;
      disp.drawIconRows(iconRows(w.icon), w.x, w.y, scale, color);
    } else if (w.type === "menu") {
      let rowH = t.rowHeight;
      if (rowH < 16) rowH = 16;
      let visible = idiv(w.h, rowH);
      if (visible < 1) visible = 1;
      const items = w.items || [];
      const selected = env.menuSelection(w.id, items.length);
      let scroll = 0;
      if (selected < scroll) scroll = selected;
      if (selected >= scroll + visible) scroll = selected - visible + 1;
      if (scroll < 0) scroll = 0;
      const gap = 3;
      for (let row = 0; row < visible; row++) {
        const idx = scroll + row;
        if (idx >= items.length) break;
        const it = items[idx];
        const ry = w.y + row * rowH;
        const rh = rowH - gap;
        const sel = idx === selected;
        const fill = sel ? t.primary : t.surface;
        const txt = sel ? t.background : t.text;
        disp.fillRoundRect(w.x, ry, w.w, rh, t.radius, fill);
        if (!sel) disp.drawRoundRect(w.x, ry, w.w, rh, t.radius, t.surfaceEdge);
        const pad = t.padding;
        let contentX = w.x + pad;
        const ic = iconRows(it.icon);
        if (ic) {
          const iconY = ry + idiv(rh - 16, 2);
          disp.drawIconRows(ic, contentX, iconY, 1, txt);
          contentX += 16 + pad;
        }
        const labelW = w.x + w.w - pad - contentX;
        drawText(disp, it.label || "", contentX, ry, labelW, rh, "left", txt, t.textSize, fill, fontBody);
        if (it.target) {
          const arrow = iconRows("arrow_right");
          const aY = ry + idiv(rh - 16, 2);
          disp.drawIconRows(arrow, w.x + w.w - pad - 16, aY, 1, txt);
        }
      }
    }
  }

  function drawScreen(disp, screen, theme, env) {
    disp.fillScreen(theme.background);
    const widgets = screen.widgets || [];
    for (let i = 0; i < widgets.length; i++) {
      const w = widgets[i];
      if (w.visible === false) continue;
      drawWidget(disp, w, theme, env);
    }
  }

  function themeTo565(theme, fontBody, fontTitle) {
    return {
      background: hexTo565(theme.background),
      surface: hexTo565(theme.surface),
      surfaceEdge: hexTo565(theme.surfaceEdge),
      text: hexTo565(theme.text),
      textDim: hexTo565(theme.textDim),
      primary: hexTo565(theme.primary),
      success: hexTo565(theme.success),
      warning: hexTo565(theme.warning),
      danger: hexTo565(theme.danger),
      radius: theme.radius,
      padding: theme.padding,
      rowHeight: theme.rowHeight,
      textSize: theme.textSize,
      fontBody: fontBody || null,
      fontTitle: fontTitle || null,
    };
  }

  function composeFB(out, a, b, w, h, type, p) {
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    if (type === "Fade") {
      const mix = (p * 255) | 0;
      for (let i = 0; i < w * h; i++) out[i] = blend565(a[i], b[i], mix);
      return;
    }
    if (type === "Cover") {
      const o = Math.min(w, (p * w) | 0);
      for (let y = 0; y < h; y++) {
        const ro = y * w;
        out.set(a.subarray(ro, ro + w), ro);
        if (o > 0) out.set(b.subarray(ro, ro + o), ro + (w - o));
      }
      return;
    }
    if (type === "SlideLeft" || type === "Push") {
      const o = Math.min(w, (p * w) | 0);
      const keep = w - o;
      for (let y = 0; y < h; y++) {
        const ro = y * w;
        if (keep > 0) out.set(a.subarray(ro + o, ro + w), ro);
        if (o > 0) out.set(b.subarray(ro, ro + o), ro + keep);
      }
      return;
    }
    if (type === "SlideRight") {
      const o = Math.min(w, (p * w) | 0);
      for (let y = 0; y < h; y++) {
        const ro = y * w;
        if (o > 0) out.set(b.subarray(ro + (w - o), ro + w), ro);
        if (w - o > 0) out.set(a.subarray(ro, ro + (w - o)), ro + o);
      }
      return;
    }
    if (type === "SlideUp") {
      const o = Math.min(h, (p * h) | 0);
      for (let y = 0; y < h - o; y++) out.set(a.subarray((y + o) * w, (y + o) * w + w), y * w);
      for (let k = 0; k < o; k++) out.set(b.subarray(k * w, k * w + w), (h - o + k) * w);
      return;
    }
    if (type === "SlideDown") {
      const o = Math.min(h, (p * h) | 0);
      for (let k = 0; k < o; k++) out.set(b.subarray((h - o + k) * w, (h - o + k) * w + w), k * w);
      for (let y = o; y < h; y++) out.set(a.subarray((y - o) * w, (y - o) * w + w), y * w);
      return;
    }
    out.set(b);
  }

  window.LucarneRender = {
    Display,
    color565,
    hexTo565,
    rgb565to888,
    blend565,
    drawScreen,
    drawWidget,
    themeTo565,
    textWidth: textWidthClassic,
    getAATextBounds,
    iconRows,
    composeFB,
  };
})();
