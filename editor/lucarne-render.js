(function () {
  "use strict";

  const idiv = (a, b) => Math.trunc(a / b);

  function color565(r, g, b) {
    return (((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)) & 0xffff;
  }

  function hexTo565(hex) {
    if (hex == null || hex === "") return 0;
    const h = String(hex).replace("#", "");
    if (h.length < 6) return 0;
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

  function colorIsOn565(c) {
    const r = ((c >> 11) & 0x1f) << 1;
    const g = (c >> 5) & 0x3f;
    const b = (c & 0x1f) << 1;
    return r * 299 + g * 587 + b * 114 >= 31500;
  }

  function blitDisplayToCanvas(disp, ctx, project) {
    let panel = null;
    const S = window.LucarneState;
    if (project && S && S.oledPanelPreview) panel = S.oledPanelPreview(project);
    disp.blitTo(ctx, panel ? { oledPanel: panel } : undefined);
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

    peekPixel(x, y) {
      x = x | 0;
      y = y | 0;
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
      return this.fb[y * this.width + x] & 0xffff;
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

    fillCircle(cx, cy, r, color) {
      r = r | 0;
      cx = cx | 0;
      cy = cy | 0;
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r) this.writePixel(cx + x, cy + y, color);
        }
      }
    }

    fillTriangle(x0, y0, x1, y1, x2, y2, color) {
      let a = x0;
      let b = x0;
      let y = y0;
      let last;
      if (y0 > y1) {
        [y0, y1] = [y1, y0];
        [x0, x1] = [x1, x0];
      }
      if (y1 > y2) {
        [y2, y1] = [y1, y2];
        [x2, x1] = [x1, x2];
      }
      if (y0 > y1) {
        [y0, y1] = [y1, y0];
        [x0, x1] = [x1, x0];
      }
      if (y0 === y2) {
        a = b = x0;
        if (x1 < a) a = x1;
        else if (x1 > b) b = x1;
        if (x2 < a) a = x2;
        else if (x2 > b) b = x2;
        this.writeFastHLine(a, y0, b - a + 1, color);
        return;
      }
      const dx01 = x1 - x0;
      const dy01 = y1 - y0;
      const dx02 = x2 - x0;
      const dy02 = y2 - y0;
      const dx12 = x2 - x1;
      const dy12 = y2 - y1;
      let sa = 0;
      let sb = 0;
      last = y1 === y2 ? y1 : y1 - 1;
      for (y = y0; y <= last; y++) {
        a = x0 + (dy01 ? sa / dy01 : 0) | 0;
        b = x0 + (dy02 ? sb / dy02 : 0) | 0;
        sa += dx01;
        sb += dx02;
        if (a > b) [a, b] = [b, a];
        this.writeFastHLine(a, y, b - a + 1, color);
      }
      sa = dx12 * (y - y1);
      sb = dx02 * (y - y0);
      for (; y <= y2; y++) {
        a = x1 + (dy12 ? sa / dy12 : 0) | 0;
        b = x0 + (dy02 ? sb / dy02 : 0) | 0;
        sa += dx12;
        sb += dx02;
        if (a > b) [a, b] = [b, a];
        this.writeFastHLine(a, y, b - a + 1, color);
      }
    }

    drawTriangle(x0, y0, x1, y1, x2, y2, color) {
      this.drawLine(x0, y0, x1, y1, color);
      this.drawLine(x1, y1, x2, y2, color);
      this.drawLine(x2, y2, x0, y0, color);
    }

    drawCircle(cx, cy, r, color) {
      r = r | 0;
      cx = cx | 0;
      cy = cy | 0;
      let x = r;
      let y = 0;
      let err = 1 - r;
      while (x >= y) {
        this.writePixel(cx + x, cy + y, color);
        this.writePixel(cx + y, cy + x, color);
        this.writePixel(cx - y, cy + x, color);
        this.writePixel(cx - x, cy + y, color);
        this.writePixel(cx - x, cy - y, color);
        this.writePixel(cx - y, cy - x, color);
        this.writePixel(cx + y, cy - x, color);
        this.writePixel(cx + x, cy - y, color);
        y++;
        if (err < 0) err += 2 * y + 1;
        else {
          x--;
          err += 2 * (y - x) + 1;
        }
      }
    }

    drawLine(x0, y0, x1, y1, color) {
      x0 = x0 | 0;
      y0 = y0 | 0;
      x1 = x1 | 0;
      y1 = y1 | 0;
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      while (true) {
        this.writePixel(x0, y0, color);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x0 += sx;
        }
        if (e2 < dx) {
          err += dx;
          y0 += sy;
        }
      }
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
      const U = window.LucarneUtf8;
      const each = U ? U.forEachCodepoint : (str, fn) => { for (let i = 0; i < str.length; i++) fn(str.charCodeAt(i)); };
      each(text, (code) => {
        if (code === 10) return;
        if (code > 255) return;
        this.drawCharClassic(cx, y, code, color, size);
        cx += 6 * size;
      });
    }

    drawTextAA(atlas, penX, baselineY, text, fg, bg, spacing) {
      spacing = spacing || 0;
      let pen = penX;
      const U = window.LucarneUtf8;
      const each = U ? U.forEachCodepoint : (str, fn) => { for (let i = 0; i < str.length; i++) fn(str.charCodeAt(i)); };
      each(text, (code) => {
        if (code === 10) {
          baselineY += atlas.yAdvance;
          pen = penX;
          return;
        }
        if (code === 13) return;
        const g = atlas.glyphs[code];
        if (!g) return;
        if (g.w > 0 && g.h > 0 && g.cov) {
          const gx = pen + g.xo;
          const gy = baselineY + g.yo;
          for (let yy = 0; yy < g.h; yy++) {
            for (let xx = 0; xx < g.w; xx++) {
              const a = g.cov[yy * g.w + xx];
              if (a === 0) continue;
              const under = this.peekPixel(gx + xx, gy + yy);
              const out = a >= 250 ? fg : blend565(under, fg, a);
              this.writePixel(gx + xx, gy + yy, out);
            }
          }
        }
        pen += g.adv + spacing;
      });
    }

    drawIcon(icon, x, y, scale, tint) {
      if (!icon) return;
      const sc = normalizeIconScale(scale);
      const F = window.LucarneIconFmt;
      const iw = icon.w || 16;
      const ih = icon.h || iw;
      if (icon.mono && icon.rows) {
        const dw = Math.max(1, Math.round(iw * sc));
        const dh = Math.max(1, Math.round(ih * sc));
        if (Math.abs(sc - Math.round(sc)) < 0.001) {
          this.drawIconRows(icon.rows, x, y, Math.round(sc), tint, iw, ih);
        } else {
          this.drawIconSized(icon, x, y, dw, dh, tint);
        }
        return;
      }
      if (icon.pixels && F) {
        const dw = iw * sc;
        const dh = ih * sc;
        if (icon.animated) {
          if (icon.image) F.blitImage(this, x, y, icon.image, dw, dh, blend565);
          return;
        }
        F.blit565(this, x, y, icon, dw, dh, blend565);
      }
    }

    drawIconRows(rows, x, y, scale, color, iw, ih) {
      if (!rows) return;
      iw = iw || 16;
      ih = ih || iw;
      if (scale < 1) scale = 1;
      for (let ry = 0; ry < ih; ry++) {
        const bits = rows[ry];
        if (!bits) continue;
        for (let rx = 0; rx < iw; rx++) {
          if (bits & (0x8000 >> rx)) {
            if (scale === 1) this.writePixel(x + rx, y + ry, color);
            else this.fillRect(x + rx * scale, y + ry * scale, scale, scale, color);
          }
        }
      }
    }

    drawIconSized(icon, x, y, dw, dh, tint) {
      if (!icon) return;
      dw = Math.max(1, Math.round(dw));
      dh = Math.max(1, Math.round(dh));
      const F = window.LucarneIconFmt;
      if (icon.pixels && F) {
        if (icon.animated) {
          if (icon.image) {
            F.blitImage(this, x, y, icon.image, dw, dh, blend565);
          }
          return;
        }
        F.blit565(this, x, y, icon, dw, dh, blend565);
        return;
      }
      if (icon.mono && icon.rows) {
        const sw = icon.w || 16;
        const sh = icon.h || 16;
        for (let py = 0; py < dh; py++) {
          const sy = Math.floor((py * sh) / dh);
          const bits = icon.rows[sy];
          if (!bits) continue;
          for (let px = 0; px < dw; px++) {
            const sx = Math.floor((px * sw) / dw);
            if (bits & (0x8000 >> sx)) this.writePixel(x + px, y + py, tint);
          }
        }
      }
    }

    blitTo(ctx, opts) {
      if (!this._imgData || this._imgData.width !== this.width || this._imgData.height !== this.height) {
        this._imgData = ctx.createImageData(this.width, this.height);
      }
      const d = this._imgData.data;
      const fb = this.fb;
      const panel = opts && opts.oledPanel;
      if (panel && panel.regions && panel.regions.length) {
        const w = this.width;
        const regions = panel.regions;
        for (let y = 0; y < this.height; y++) {
          let emit = regions[regions.length - 1].on;
          for (let ri = 0; ri < regions.length; ri++) {
            const rg = regions[ri];
            if (y >= rg.y0 && y < rg.y1) {
              emit = rg.on;
              break;
            }
          }
          const er = (emit >> 11) & 0x1f;
          const eg = (emit >> 5) & 0x3f;
          const eb = emit & 0x1f;
          const onR = (er << 3) | (er >> 2);
          const onG = (eg << 2) | (eg >> 4);
          const onB = (eb << 3) | (eb >> 2);
          const row = y * w;
          for (let x = 0; x < w; x++) {
            const i = row + x;
            const o = i * 4;
            let lit = colorIsOn565(fb[i]);
            if (panel.invert) lit = !lit;
            if (lit) {
              d[o] = onR;
              d[o + 1] = onG;
              d[o + 2] = onB;
            } else {
              d[o] = 0;
              d[o + 1] = 0;
              d[o + 2] = 0;
            }
            d[o + 3] = 255;
          }
        }
      } else {
        for (let i = 0, o = 0; i < fb.length; i++, o += 4) {
          const c = fb[i];
          let r = (c >> 11) & 0x1f;
          let g = (c >> 5) & 0x3f;
          let b = c & 0x1f;
          d[o] = (r << 3) | (r >> 2);
          d[o + 1] = (g << 2) | (g >> 4);
          d[o + 2] = (b << 3) | (b >> 2);
          d[o + 3] = 255;
        }
      }
      ctx.putImageData(this._imgData, 0, 0);
    }
  }

  function getAATextBounds(atlas, text, spacing) {
    spacing = spacing || 0;
    let pen = 0;
    let loX = 32767;
    let loY = 32767;
    let hiX = -32768;
    let hiY = -32768;
    const U = window.LucarneUtf8;
    const each = U ? U.forEachCodepoint : (str, fn) => { for (let i = 0; i < str.length; i++) fn(str.charCodeAt(i)); };
    each(text, (code) => {
      if (code === 10 || code === 13) return;
      const g = atlas.glyphs[code];
      if (!g) return;
      if (g.w > 0 && g.h > 0) {
        const gx = pen + g.xo;
        const gy = g.yo;
        if (gx < loX) loX = gx;
        if (gy < loY) loY = gy;
        if (gx + g.w > hiX) hiX = gx + g.w;
        if (gy + g.h > hiY) hiY = gy + g.h;
      }
      pen += g.adv + spacing;
    });
    if (hiX <= loX) return { minx: 0, miny: 0, w: 0, h: 0 };
    return { minx: loX, miny: loY, w: hiX - loX, h: hiY - loY };
  }

  function textWidthClassic(text, size) {
    return text.length * 6 * size;
  }

  function drawText(disp, text, bx, by, bw, bh, align, color, size, bg, atlas, spacing) {
    spacing = spacing || 0;
    if (!text || text.length === 0) return;
    if (atlas) {
      const b = getAATextBounds(atlas, text, spacing);
      let left = bx;
      if (align === "center") left = bx + idiv(bw - b.w, 2);
      else if (align === "right") left = bx + bw - b.w;
      const top = by + idiv(bh - b.h, 2);
      disp.drawTextAA(atlas, left - b.minx, top - b.miny, text, color, bg, spacing);
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

  function drawResolvedText(disp, text, bx, by, bw, bh, bg, resolved) {
    if (resolved && resolved.transparent) return;
    drawText(disp, text, bx, by, bw, bh, resolved.align, resolved.color565, resolved.size, bg, resolved.atlas, resolved.spacing);
  }

  function isTransparentColor(v) {
    return window.LucarneTextStyle && window.LucarneTextStyle.isTransparentColor(v);
  }

  function shapeKind(w) {
    const k = w && w.shape;
    if (k === "circle" || k === "triangle") return k;
    return "rect";
  }

  function shapeTriangleVerts(w) {
    return {
      x0: w.x + idiv(w.w, 2),
      y0: w.y,
      x1: w.x,
      y1: w.y + w.h - 1,
      x2: w.x + w.w - 1,
      y2: w.y + w.h - 1,
    };
  }

  function pointInTriangle(px, py, x0, y0, x1, y1, x2, y2) {
    const d0 = (px - x2) * (y0 - y2) - (x0 - x2) * (py - y2);
    const d1 = (px - x0) * (y1 - y0) - (x1 - x0) * (py - y0);
    const d2 = (px - x1) * (y2 - y1) - (x2 - x1) * (py - y1);
    const hasNeg = d0 < 0 || d1 < 0 || d2 < 0;
    const hasPos = d0 > 0 || d1 > 0 || d2 > 0;
    return !(hasNeg && hasPos);
  }

  function shapeHitTest(w, px, py) {
    if (!w || w.type !== "shape") return false;
    if (px < w.x || py < w.y || px >= w.x + w.w || py >= w.y + w.h) return false;
    const kind = shapeKind(w);
    if (kind === "rect") return true;
    if (kind === "circle") {
      const cx = w.x + idiv(w.w, 2);
      const cy = w.y + idiv(w.h, 2);
      const r = w.w < w.h ? idiv(w.w, 2) : idiv(w.h, 2);
      const dx = px - cx;
      const dy = py - cy;
      return dx * dx + dy * dy <= r * r;
    }
    const v = shapeTriangleVerts(w);
    return pointInTriangle(px, py, v.x0, v.y0, v.x1, v.y1, v.x2, v.y2);
  }

  function shapeKindEnum(kind) {
    if (kind === "circle") return "ShapeKind::Circle";
    if (kind === "triangle") return "ShapeKind::Triangle";
    return "ShapeKind::Rect";
  }

  function graphTypeEnum(type) {
    if (type === "bar") return "GraphType::Bar";
    if (type === "area") return "GraphType::Area";
    if (type === "sparkline") return "GraphType::Sparkline";
    return "GraphType::Line";
  }

  function graphModeEnum(mode) {
    if (mode === "keys") return "GraphMode::Keys";
    return "GraphMode::Stream";
  }

  function graphSamples(w, env) {
    if (env && env.graphSamples && env.graphSamples(w.id)) return env.graphSamples(w.id);
    if (w.samples && w.samples.length >= 2) return w.samples;
    if ((w.mode === "keys" || w.type === "chart") && w.keys) {
      const min = w.min === undefined ? 0 : w.min;
      return w.keys
        .filter((k) => k)
        .map((k) => {
          const rec = env.getValue(k);
          return rec && rec.type !== "string" && rec.type !== "bool" ? Number(rec.value) : min;
        });
    }
    if (w.mode === "stream" && w.key) {
      const min = w.min === undefined ? 0 : w.min;
      const rec = env.getValue(w.key);
      const v = rec && rec.type !== "string" && rec.type !== "bool" ? Number(rec.value) : min;
      return [v, v];
    }
    return [];
  }

  function drawGraphBody(disp, w, t, env, gx, gy, gw, gh) {
    const gType = w.graphType || "line";
    const spark = gType === "sparkline";
    const samples = graphSamples(w, env);
    if (samples.length < 2) return;
    const line = isTransparentColor(w.color) ? null : w.color ? hexTo565(w.color) : t.primary;
    if (line === null) return;
    const min = w.min === undefined ? 0 : w.min;
    const max = w.max === undefined ? 100 : w.max;
    const span = max - min || 1;
    const grid = w.grid !== false && !spark;
    if (grid) {
      disp.writeFastHLine(gx, gy + idiv(gh, 2), gw, t.surfaceEdge);
      disp.writeFastVLine(gx + idiv(gw, 2), gy, gh, t.surfaceEdge);
    }
    const baseY = gy + gh - 1;
    if (gType === "bar") {
      const n = samples.length;
      let barW = idiv(gw, n);
      if (barW < 1) barW = 1;
      for (let i = 0; i < n; i++) {
        let v = samples[i];
        if (v < min) v = min;
        if (v > max) v = max;
        const ratio = (v - min) / span;
        let bh = Math.trunc((gh - 1) * ratio);
        if (bh < 1 && ratio > 0) bh = 1;
        const bx = gx + i * barW;
        let bw = barW - (barW > 2 ? 1 : 0);
        if (bw < 1) bw = 1;
        disp.fillRect(bx, baseY - bh + 1, bw, bh, line);
      }
      return;
    }
    let px0 = gx;
    let py0 = baseY;
    for (let i = 0; i < samples.length; i++) {
      let v = samples[i];
      if (v < min) v = min;
      if (v > max) v = max;
      const ratio = (v - min) / span;
      const px = gx + idiv((gw * i) / (samples.length - 1));
      const py = gy + gh - 1 - Math.trunc((gh - 1) * ratio);
      if (i > 0) {
        disp.drawLine(px0, py0, px, py, line);
        if (gType === "area") {
          const xLeft = px0 < px ? px0 : px;
          const xRight = px0 < px ? px : px0;
          const yTop0 = px0 < px ? py0 : py;
          const yTop1 = px0 < px ? py : py0;
          for (let xx = xLeft; xx <= xRight; xx++) {
            const tRatio = xRight === xLeft ? 0 : (xx - xLeft) / (xRight - xLeft);
            const yt = Math.trunc(yTop0 + (yTop1 - yTop0) * tRatio);
            if (yt < baseY) disp.writeFastVLine(xx, yt, baseY - yt + 1, line);
          }
        }
      }
      px0 = px;
      py0 = py;
    }
  }

  function iconScaleValue(itemScale, menuScale) {
    const item = parseFloat(itemScale);
    if (item > 0) return normalizeIconScale(item);
    const menu = parseFloat(menuScale);
    if (menu > 0) return normalizeIconScale(menu);
    return 1;
  }

  function menuIconTargetPx(rh, itemScale, menuScale) {
    const mul = iconScaleValue(itemScale, menuScale);
    const maxFit = Math.max(8, rh - 4);
    const baseAt1 = Math.min(16, Math.floor(maxFit * 0.55));
    return Math.min(maxFit, Math.round(baseAt1 * mul));
  }

  function parseIconScale(scale, fallback) {
    if (scale === "" || scale === null || scale === undefined) {
      return fallback !== undefined ? fallback : 1;
    }
    const n = parseFloat(scale);
    if (!(n > 0)) return fallback !== undefined ? fallback : 1;
    return Math.round(Math.max(0.1, Math.min(4, n)) * 10) / 10;
  }

  function normalizeIconScale(scale) {
    return parseIconScale(scale, 1);
  }

  function iconScaleExport(scale) {
    const n = normalizeIconScale(scale);
    const t = Math.round(n * 10);
    if (t % 10 === 0 && t >= 10 && t <= 40) return t / 10;
    return t;
  }

  function iconRows(name) {
    if (!name || name === "none") return null;
    const tbl = window.LUCARNE_ICONS || {};
    return tbl[name] || null;
  }

  function resolveIcon(name, env) {
    if (!name || name === "none") return null;
    const F = window.LucarneIconFmt;
    if (name.indexOf("emoji:") === 0) {
      if (window.LucarneFluentEmoji) {
        const id = name.slice(6);
        const ic = window.LucarneFluentEmoji.getIcon(id);
        if (!ic && env && env.LE) {
          window.LucarneFluentEmoji.ensureIcon(id)
            .then(() => env.LE.markDirty())
            .catch(() => {});
        }
        return ic;
      }
      return null;
    }
    if (name.indexOf("tabler:") === 0) {
      const n = name.slice(7);
      if (window.LucarneIconPacks) {
        const emb = window.LucarneIconPacks.getIcon(name);
        if (emb) return emb;
      }
      if (window.LucarneTabler) {
        const ic = window.LucarneTabler.getIcon(n);
        if (ic) return ic;
      }
      return null;
    }
    if (name.indexOf("streamline:") === 0 || name.indexOf("glyphs:") === 0) {
      if (window.LucarneIconPacks) return window.LucarneIconPacks.getIcon(name);
      return null;
    }
    if (name.indexOf("c:") === 0 && env && env.customIconAtlas) {
      const raw = env.customIconAtlas(name.slice(2));
      if (!raw) return null;
      if (F && F.isMonoRows(raw)) return F.monoFromRows(raw);
      if (raw.pixels) return raw;
      if (raw.rows) return F ? F.monoFromRows(raw.rows) : { mono: true, w: 16, h: 16, rows: raw.rows };
      return null;
    }
    const rows = iconRows(name);
    if (rows && F) return F.monoFromRows(rows);
    return null;
  }

  function resolveIconRows(name, env) {
    const ic = resolveIcon(name, env);
    if (!ic) return null;
    if (ic.mono) return ic.rows;
    return ic;
  }

  function insideRoundRect(x, y, w, h, r) {
    if (r <= 0) return true;
    if (x >= r && x < w - r) return true;
    if (y >= r && y < h - r) return true;
    const cx = x < r ? r : w - r - 1;
    const cy = y < r ? r : h - r - 1;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }

  function maskScreenCorners(disp, bezel, r) {
    if (r <= 0) return;
    const w = disp.width;
    const h = disp.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!insideRoundRect(x, y, w, h, r)) disp.writePixel(x, y, bezel);
      }
    }
  }

  function formatMetric(rec, unit, decimals) {
    if (!rec) return "--" + unit;
    if (rec.type === "string") return rec.value !== undefined ? String(rec.value) : "--";
    if (rec.type === "bool") return rec.value ? "ON" : "OFF";
    const num = Number(rec.value) || 0;
    if (decimals === 0) return Math.trunc(num) + unit;
    return num.toFixed(decimals) + unit;
  }

  function formatBinding(rec, unit, decimals) {
    let value;
    if (!rec) value = "--";
    else if (rec.type === "string") value = rec.value !== undefined ? String(rec.value) : "";
    else if (rec.type === "bool") value = rec.value ? "ON" : "OFF";
    else if (rec.type === "int") value = String(Math.trunc(Number(rec.value) || 0));
    else if (rec.type === "float") value = (Number(rec.value) || 0).toFixed(Math.max(0, decimals | 0));
    else value = "--";
    return unit ? value + " " + unit : value;
  }

  function labelDisplayText(w, env) {
    if (w.bindKey && env && env.getValue) {
      return formatBinding(env.getValue(w.bindKey), w.bindUnit || "", w.bindDecimals === undefined ? 1 : w.bindDecimals);
    }
    return w.text || "";
  }

  function menuRowColor(field, themeFallback) {
    const TS = window.LucarneTextStyle;
    if (!field || (TS && TS.isTransparentColor(field))) return themeFallback;
    return hexTo565(field);
  }

  function textBoundsAny(atlas, text, size) {
    if (atlas) {
      const b = getAATextBounds(atlas, text);
      return { w: b.w, h: b.h };
    }
    return { w: textWidthClassic(text, size), h: 8 * size };
  }

  function drawWidget(disp, w, t, env) {
    const TS = window.LucarneTextStyle;
    const fontBody = t.fontBody || null;
    const fontTitle = t.fontTitle || null;

    function st(style, defaults) {
      if (TS && env && env.LE) return TS.resolve(env.LE, env.LE.project.theme, style, defaults);
      const d = defaults || {};
      let transparent = false;
      let color565 = t.text;
      if (style && isTransparentColor(style.color)) transparent = true;
      else if (style && style.color) color565 = hexTo565(style.color);
      else if (d.dim) color565 = t.textDim;
      else if (d.color565 !== undefined) color565 = d.color565;
      return {
        atlas: d.fontKind === "title" ? fontTitle : fontBody,
        size: style && style.textSize !== undefined && style.textSize !== "" ? style.textSize : d.size !== undefined ? d.size : t.textSize,
        color565,
        transparent,
        align: (style && style.align) || d.align || "left",
        spacing: style && style.spacing !== undefined && style.spacing !== "" ? parseInt(style.spacing, 10) || 0 : 0,
      };
    }

    if (w.type === "label") {
      const stLabel =
        TS && env && env.LE ? TS.resolveLabelWidget(env.LE, env.LE.project.theme, w) : st(w.textStyle, { align: w.align || "left", color565: w.color ? hexTo565(w.color) : t.text, size: w.size || t.textSize, fontKind: w.font === "title" ? "title" : "body" });
      const labelText = labelDisplayText(w, env);
      let bw = w.w || 0;
      let bh = w.h || 0;
      if (bw <= 0 || bh <= 0) {
        const m = textBoundsAny(stLabel.atlas, labelText, stLabel.size);
        if (bw <= 0) bw = m.w;
        if (bh <= 0) bh = m.h;
      }
      drawResolvedText(disp, labelText, w.x, w.y, bw, bh, t.background, stLabel);
    } else if (w.type === "metric") {
      const r = t.radius;
      disp.fillRoundRect(w.x, w.y, w.w, w.h, r, t.surface);
      disp.drawRoundRect(w.x, w.y, w.w, w.h, r, t.surfaceEdge);
      const accent = isTransparentColor(w.accent) ? null : w.accent ? hexTo565(w.accent) : t.primary;
      const barW = 4;
      const barH = w.h - t.padding;
      const barY = w.y + idiv(w.h - barH, 2);
      if (accent !== null) disp.fillRoundRect(w.x + 3, barY, barW, barH, 2, accent);
      const pad = t.padding;
      const contentX = w.x + 3 + barW + pad;
      const contentW = w.w - (3 + barW + pad) - pad;
      const labelW = idiv(contentW * 6, 10);
      const valueW = contentW - labelW;
      drawResolvedText(disp, w.label || "", contentX, w.y, labelW, w.h, t.surface, st(w.labelStyle, { dim: true, align: "left" }));
      const rec = env.getValue(w.key);
      const val = formatMetric(rec, w.unit || "", w.decimals === undefined ? 1 : w.decimals);
      drawResolvedText(disp, val, contentX + labelW, w.y, valueW, w.h, t.surface, st(w.valueStyle, { align: "right" }));
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
      const color = isTransparentColor(w.color) ? null : w.color ? hexTo565(w.color) : t.primary;
      if (fillW > 0 && color !== null) {
        let fr = r - inset;
        if (fr < 0) fr = 0;
        disp.fillRoundRect(w.x + inset, w.y + inset, fillW, w.h - inset * 2, fr, color);
      }
      if (w.showValue) {
        const pct = Math.trunc(ratio * 100 + 0.5) + "%";
        const txtBg = color !== null && fillW > w.w / 2 ? color : t.surface;
        drawResolvedText(disp, pct, w.x, w.y, w.w, w.h, txtBg, st(w.valueStyle, { align: "center" }));
      }
    } else if (w.type === "button") {
      const navFocus = env.focusNavId === w.id;
      const fillTrans = isTransparentColor(w.fill);
      const fill = fillTrans ? null : w.fill ? hexTo565(w.fill) : t.primary;
      const txtTrans = isTransparentColor(w.textColor);
      const txt = txtTrans ? null : w.textColor ? hexTo565(w.textColor) : t.background;
      if (fill !== null) disp.fillRoundRect(w.x, w.y, w.w, w.h, t.radius, fill);
      disp.drawRoundRect(w.x, w.y, w.w, w.h, t.radius, navFocus ? t.primary : t.surfaceEdge);
      let contentX = w.x + t.padding;
      const ic = w.icon && w.icon !== "none" ? resolveIcon(w.icon, env) : null;
      const textSt = st(w.textStyle, { color565: txt !== null ? txt : t.background, align: "center" });
      if (txtTrans) textSt.transparent = true;
      if (ic) {
        let side = w.h - t.padding * 2;
        if (side > 20) side = 20;
        if (side < 8) side = 8;
        const iy = w.y + idiv(w.h - side, 2);
        const iconTint = txtTrans ? t.text : textSt.color565;
        disp.drawIconSized(ic, contentX, iy, side, side, iconTint);
        contentX += side + t.padding;
      }
      const lw = w.x + w.w - t.padding - contentX;
      const textBg = fill !== null ? fill : t.background;
      drawResolvedText(disp, w.label || "Button", contentX, w.y, lw, w.h, textBg, textSt);
    } else if (w.type === "shape") {
      const kind = shapeKind(w);
      const active = env.focusShapeId === w.id;
      const fillTrans = isTransparentColor(active ? w.activeFill : w.fill);
      const strokeTrans = isTransparentColor(active ? w.activeStroke : w.stroke);
      const fill = fillTrans
        ? null
        : active
          ? w.activeFill
            ? hexTo565(w.activeFill)
            : t.primary
          : w.fill
            ? hexTo565(w.fill)
            : t.surface;
      const stroke = strokeTrans
        ? null
        : active
          ? w.activeStroke
            ? hexTo565(w.activeStroke)
            : t.text
          : w.stroke
            ? hexTo565(w.stroke)
            : t.surfaceEdge;
      const sw = w.strokeWidth === undefined ? 2 : Math.max(1, w.strokeWidth | 0);
      if (kind === "rect") {
        if (fill !== null) disp.fillRect(w.x, w.y, w.w, w.h, fill);
        if (stroke !== null) {
          for (let i = 0; i < sw; i++) disp.drawRect(w.x + i, w.y + i, w.w - i * 2, w.h - i * 2, stroke);
        }
      } else if (kind === "circle") {
        const cx = w.x + idiv(w.w, 2);
        const cy = w.y + idiv(w.h, 2);
        const r = w.w < w.h ? idiv(w.w, 2) : idiv(w.h, 2);
        if (fill !== null) disp.fillCircle(cx, cy, r, fill);
        if (stroke !== null) disp.drawCircle(cx, cy, r, stroke);
      } else {
        const v = shapeTriangleVerts(w);
        if (fill !== null) disp.fillTriangle(v.x0, v.y0, v.x1, v.y1, v.x2, v.y2, fill);
        if (stroke !== null) disp.drawTriangle(v.x0, v.y0, v.x1, v.y1, v.x2, v.y2, stroke);
      }
      if (w.label) {
        const txtTrans = active && isTransparentColor(w.activeText);
        let txt565 = t.background;
        if (active && w.activeText && !isTransparentColor(w.activeText)) txt565 = hexTo565(w.activeText);
        else if (w.textColor && !isTransparentColor(w.textColor)) txt565 = hexTo565(w.textColor);
        const textSt = st(w.textStyle, { color565: txt565, align: "center" });
        if (txtTrans) textSt.transparent = true;
        const textBg = fill !== null ? fill : t.background;
        drawResolvedText(disp, w.label, w.x, w.y, w.w, w.h, textBg, textSt);
      }
    } else if (w.type === "switch") {
      const navFocus = env.focusNavId === w.id;
      const rec = env.getValue(w.key);
      const on = rec && rec.type === "bool" ? !!rec.value : false;
      let trackW = Math.max(28, Math.trunc((w.w * 40) / 100));
      let trackH = Math.max(14, Math.trunc((w.h * 55) / 100));
      const tx = w.x + w.w - trackW - t.padding;
      const ty = w.y + idiv(w.h - trackH, 2);
      const track = on ? t.primary : t.surfaceEdge;
      disp.fillRoundRect(tx, ty, trackW, trackH, idiv(trackH, 2), track);
      const knob = trackH - 4;
      const kx = on ? tx + trackW - knob - 2 : tx + 2;
      const ky = ty + 2;
      disp.fillCircle(kx + idiv(knob, 2), ky + idiv(knob, 2), idiv(knob, 2), t.text);
      const lw = tx - w.x - t.padding;
      if (navFocus) disp.drawRoundRect(w.x, w.y, w.w, w.h, t.radius, t.primary);
      if (lw > 0) drawResolvedText(disp, w.label || "", w.x, w.y, lw, w.h, t.background, st(w.textStyle, { align: "left" }));
    } else if (w.type === "slider") {
      const navFocus = env.focusNavId === w.id;
      const rec = env.getValue(w.key);
      const min = w.min === undefined ? 0 : w.min;
      const max = w.max === undefined ? 100 : w.max;
      let v = rec && rec.type !== "string" && rec.type !== "bool" ? Number(rec.value) : min;
      if (v < min) v = min;
      if (v > max) v = max;
      const span = max - min || 1;
      const ratio = (v - min) / span;
      const pad = t.padding;
      let trackH = Math.max(6, Math.trunc((w.h * 35) / 100));
      const ty = w.y + idiv(w.h - trackH, 2);
      const tw = w.w - pad * 2;
      const tx = w.x + pad;
      disp.fillRoundRect(tx, ty, tw, trackH, idiv(trackH, 2), t.surfaceEdge);
      const fill = isTransparentColor(w.color) ? null : w.color ? hexTo565(w.color) : t.primary;
      const fw = Math.trunc(tw * ratio);
      if (fw > 0 && fill !== null) disp.fillRoundRect(tx, ty, fw, trackH, idiv(trackH, 2), fill);
      let knobR = trackH + 2;
      if (knobR < 6) knobR = 6;
      const kx = tx + Math.trunc(tw * ratio);
      const ky = ty + idiv(trackH, 2);
      if (fill !== null) {
        disp.fillCircle(kx, ky, knobR, fill);
        disp.drawCircle(kx, ky, knobR, t.text);
      }
      if (navFocus) disp.drawRoundRect(w.x, w.y, w.w, w.h, t.radius, t.primary);
    } else if (w.type === "graph" || w.type === "chart") {
      const spark = w.graphType === "sparkline";
      const pad = spark ? 1 : t.padding;
      if (!spark) disp.drawRoundRect(w.x, w.y, w.w, w.h, t.radius, t.surfaceEdge);
      const gx = w.x + pad;
      const gy = w.y + pad;
      const gw = w.w - pad * 2;
      const gh = w.h - pad * 2;
      if (gw >= 2 && gh >= 2) drawGraphBody(disp, w, t, env, gx, gy, gw, gh);
    } else if (w.type === "gauge") {
      const rec = env.getValue(w.key);
      const min = w.min === undefined ? 0 : w.min;
      const max = w.max === undefined ? 100 : w.max;
      let v = rec && rec.type !== "string" && rec.type !== "bool" ? Number(rec.value) : min;
      if (v < min) v = min;
      if (v > max) v = max;
      const span = max - min || 1;
      const ratio = (v - min) / span;
      const accent = isTransparentColor(w.accent) ? null : w.accent ? hexTo565(w.accent) : t.primary;
      const cx = w.x + idiv(w.w, 2);
      const cy = w.y + idiv(w.h * 55, 100);
      let r = idiv(w.w, 3);
      if (r > idiv(w.h, 2)) r = idiv(w.h, 2);
      if (r < 8) r = 8;
      disp.drawCircle(cx, cy, r, t.surfaceEdge);
      if (accent !== null) {
        const arcEnd = Math.trunc(180 * ratio);
        for (let a = 0; a <= arcEnd; a++) {
          const rad = ((180 - a) * Math.PI) / 180;
          const px = Math.trunc(cx + Math.cos(rad) * r);
          const py = Math.trunc(cy - Math.sin(rad) * r);
          disp.drawPixel(px, py, accent);
        }
      }
      drawResolvedText(disp, w.label || "", w.x, w.y + 2, w.w, idiv(w.h, 3), t.background, st(w.labelStyle, { dim: true, align: "center" }));
      const txt = formatMetric(rec, "", w.decimals === undefined ? 1 : w.decimals);
      drawResolvedText(disp, txt, w.x, cy + idiv(r, 2), w.w, idiv(w.h, 3), t.background, st(w.valueStyle, { align: "center" }));
    } else if (w.type === "battery") {
      const rec = env.getValue(w.key || "battery");
      let level = rec && rec.type !== "string" && rec.type !== "bool" ? Number(rec.value) : 0;
      if (level < 0) level = 0;
      if (level > 100) level = 100;
      const chargingRec = w.chargingKey ? env.getValue(w.chargingKey) : null;
      const charging = chargingRec && chargingRec.type === "bool" ? !!chargingRec.value : false;
      let tipW = idiv(w.w, 8);
      if (tipW < 2) tipW = 2;
      if (tipW > 6) tipW = 6;
      const bodyW = w.w - tipW - 1;
      let bodyH = idiv(w.h * 55, 100);
      if (bodyH < 6) bodyH = 6;
      const by = w.y + idiv(w.h - bodyH, 2);
      disp.drawRoundRect(w.x, by, bodyW, bodyH, 2, t.text);
      disp.fillRect(w.x + bodyW + 1, by + idiv(bodyH, 4), tipW, idiv(bodyH, 2), t.text);
      const fillW = Math.trunc((bodyW - 4) * level / 100);
      let fill = t.success;
      if (level <= (w.lowThreshold !== undefined ? w.lowThreshold : 20)) fill = t.danger;
      else if (level <= 40) fill = t.warning;
      if (charging) fill = t.primary;
      if (fillW > 0) disp.fillRect(w.x + 2, by + 2, fillW, bodyH - 4, fill);
      if (w.showPercent !== false && w.w >= 36) {
        drawResolvedText(disp, Math.trunc(level) + "", w.x, w.y, w.w, w.h, t.background, st(w.valueStyle, { align: "center", size: 1 }));
      }
    } else if (w.type === "clock") {
      let txt = "";
      if (w.timeKey && env.getValue(w.timeKey)) {
        const rec = env.getValue(w.timeKey);
        if (rec && rec.type === "string") txt = String(rec.value || "");
      } else {
        const h = env.getValue(w.hourKey || "hour");
        const m = env.getValue(w.minuteKey || "minute");
        const s = w.secondKey ? env.getValue(w.secondKey) : null;
        let hour = h && h.type !== "string" && h.type !== "bool" ? Number(h.value) : 0;
        let minute = m && m.type !== "string" && m.type !== "bool" ? Number(m.value) : 0;
        hour = ((hour % 24) + 24) % 24;
        minute = ((minute % 60) + 60) % 60;
        const pad = (n) => (n < 10 ? "0" : "") + n;
        if (w.format === "hm12") {
          const pm = hour >= 12;
          let h12 = hour % 12;
          if (h12 === 0) h12 = 12;
          txt = h12 + ":" + pad(minute) + (pm ? " PM" : " AM");
        } else if (w.format === "hms" && s) {
          let sec = s.type !== "string" && s.type !== "bool" ? Number(s.value) : 0;
          sec = ((sec % 60) + 60) % 60;
          txt = pad(hour) + ":" + pad(minute) + ":" + pad(sec);
        } else {
          txt = pad(hour) + ":" + pad(minute);
        }
      }
      drawResolvedText(disp, txt, w.x, w.y, w.w, w.h, t.background, st(w.textStyle, { fontKind: "title", align: "left" }));
    } else if (w.type === "date") {
      let txt = "";
      if (w.dateKey && env.getValue(w.dateKey)) {
        const rec = env.getValue(w.dateKey);
        if (rec && rec.type === "string") txt = String(rec.value || "");
      } else {
        const d = env.getValue(w.dayKey || "day");
        const mo = env.getValue(w.monthKey || "month");
        const y = env.getValue(w.yearKey || "year");
        const day = d && d.type !== "string" && d.type !== "bool" ? Number(d.value) : 1;
        const month = mo && mo.type !== "string" && mo.type !== "bool" ? Number(mo.value) : 1;
        const year = y && y.type !== "string" && y.type !== "bool" ? Number(y.value) : 2026;
        const pad = (n) => (n < 10 ? "0" : "") + n;
        if (w.format === "ymd") txt = year + "-" + pad(month) + "-" + pad(day);
        else if (w.format === "mdy") txt = pad(month) + "/" + pad(day) + "/" + year;
        else if (w.format === "dmy_dot") txt = pad(day) + "." + pad(month) + "." + year;
        else txt = pad(day) + "/" + pad(month) + "/" + year;
      }
      drawResolvedText(disp, txt, w.x, w.y, w.w, w.h, t.background, st(w.textStyle, { align: "left" }));
    } else if (w.type === "status") {
      let cx = w.x;
      const iconH = Math.max(8, idiv(w.h * 70, 100));
      const cy = w.y + idiv(w.h - iconH, 2);
      const wifiRec = w.wifiKey ? env.getValue(w.wifiKey) : null;
      const on = wifiRec && wifiRec.type === "bool" ? !!wifiRec.value : false;
      let bars = 0;
      if (on) {
        const rssiRec = w.rssiKey ? env.getValue(w.rssiKey) : null;
        const rssi = rssiRec && rssiRec.type !== "string" && rssiRec.type !== "bool" ? Number(rssiRec.value) : -70;
        if (rssi >= -50) bars = 4;
        else if (rssi >= -60) bars = 3;
        else if (rssi >= -70) bars = 2;
        else bars = 1;
      }
      for (let i = 0; i < 4; i++) {
        const bh = idiv(iconH * (i + 1), 4);
        const bx = cx + i * 5;
        const by = cy + iconH - bh;
        if (i < bars) disp.fillRect(bx, by, 3, bh, on ? t.text : t.textDim);
        else disp.drawRect(bx, by, 3, bh, t.textDim);
      }
      cx += 26;
      const btRec = w.bluetoothKey ? env.getValue(w.bluetoothKey) : null;
      const bt = btRec && btRec.type === "bool" ? !!btRec.value : false;
      const col = bt ? t.text : t.textDim;
      disp.drawLine(cx + idiv(iconH, 2), cy, cx + idiv(iconH, 2), cy + iconH, col);
      disp.drawLine(cx + idiv(iconH, 2), cy, cx + iconH, cy + idiv(iconH, 2), col);
      disp.drawLine(cx + idiv(iconH, 2), cy + iconH, cx + iconH, cy + idiv(iconH, 2), col);
    } else if (w.type === "dynamicimage") {
      const pathRec = w.pathKey ? env.getValue(w.pathKey) : null;
      const path = pathRec && pathRec.type === "string" ? String(pathRec.value || "") : "";
      let drawn = false;
      if (path && w.imageId && env.imageAtlas) {
        const asset = env.imageAtlas(w.imageId);
        if (asset && asset.pixels) {
          const bw = w.w > 0 ? w.w : asset.w;
          const bh = w.h > 0 ? w.h : asset.h;
          blitRGB565(disp, w.x, w.y, asset.pixels, asset.w, asset.h, bw, bh, asset.alpha, t.background);
          drawn = true;
        }
      }
      if (!drawn) {
        disp.drawRoundRect(w.x, w.y, w.w, w.h, t.radius, t.surfaceEdge);
        const label = path ? path.replace(/^.*[/\\]/, "").slice(0, 14) : "Dynamic";
        drawResolvedText(disp, label, w.x, w.y, w.w, w.h, t.background, st(w.textStyle, { dim: true, align: "center", size: 1 }));
      }
    } else if (w.type === "list") {
      let rowH = t.rowHeight;
      if (rowH < 14) rowH = 14;
      let visible = idiv(w.h, rowH);
      if (visible < 1) visible = 1;
      const items = w.items || [];
      const gap = 2;
      for (let row = 0; row < visible; row++) {
        if (row >= items.length) break;
        const it = items[row];
        const ry = w.y + row * rowH;
        const rh = rowH - gap;
        disp.fillRoundRect(w.x, ry, w.w, rh, t.radius, t.surface);
        disp.drawRoundRect(w.x, ry, w.w, rh, t.radius, t.surfaceEdge);
        const lbl = typeof it === "string" ? it : it.label || "";
        const merged = Object.assign({}, w.textStyle, typeof it === "object" ? it.textStyle : null);
        drawResolvedText(disp, lbl, w.x + t.padding, ry, w.w - t.padding * 2, rh, t.surface, st(merged, { align: "left" }));
      }
    } else if (w.type === "icon") {
      if (!isTransparentColor(w.color)) {
        const color = w.color ? hexTo565(w.color) : t.text;
        const ic = resolveIcon(w.icon, env);
        const sz = iconWidgetDisplaySize(w);
        const dw = w.w > 0 && w.h > 0 ? w.w : sz.w;
        const dh = w.w > 0 && w.h > 0 ? w.h : sz.h;
        if (ic) {
          if (w.scaleMode === "native" && ic.pixels) {
            blitRGB565Native(disp, w.x, w.y, ic.pixels, ic.w || dw, ic.h || dh, ic.alpha, t.background, 0, 0, dw, dh);
          } else {
            disp.drawIconSized(ic, w.x, w.y, dw, dh, color);
          }
        }
      }
    } else if (w.type === "image") {
      const asset = env.imageAtlas ? env.imageAtlas(w.imageId) : null;
      if (asset && asset.pixels) {
        const bw = w.w > 0 ? w.w : asset.w;
        const bh = w.h > 0 ? w.h : asset.h;
        if (w.scaleMode === "native") {
          blitRGB565Native(disp, w.x, w.y, asset.pixels, asset.w, asset.h, asset.alpha, t.background, 0, 0, bw, bh);
        } else {
          blitRGB565(disp, w.x, w.y, asset.pixels, asset.w, asset.h, bw, bh, asset.alpha, t.background);
        }
      }
    } else if (w.type === "menu") {
      let rowH = t.rowHeight;
      if (rowH < 16) rowH = 16;
      let visible = idiv(w.h, rowH);
      if (visible < 1) visible = 1;
      const items = w.items || [];
      const selected = env.menuSelection(w.id, items.length);
      const menuIconScale = w.iconScale;
      const menuBadgeScale = w.badgeScale;
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
        const fill = sel ? menuRowColor(w.activeFill, t.primary) : menuRowColor(w.inactiveFill, t.surface);
        const txt = sel ? menuRowColor(w.activeText, t.background) : menuRowColor(w.inactiveText, t.text);
        const edge = menuRowColor(w.inactiveEdge, t.surfaceEdge);
        disp.fillRoundRect(w.x, ry, w.w, rh, t.radius, fill);
        if (!sel) disp.drawRoundRect(w.x, ry, w.w, rh, t.radius, edge);
        const pad = t.padding;
        let contentX = w.x + pad;
        const ic = resolveIcon(it.icon, env);
        if (ic) {
          const side = menuIconTargetPx(rh, it.iconScale, menuIconScale);
          const iconY = ry + idiv(rh - side, 2);
          disp.drawIconSized(ic, contentX, iconY, side, side, txt);
          contentX += side + pad;
        }
        const labelW = w.x + w.w - pad - contentX;
        const merged = Object.assign({}, w.textStyle, it.textStyle);
        const textSt = st(merged, { align: "left" });
        if ((!it.textStyle || !it.textStyle.color) && !textSt.transparent) textSt.color565 = txt;
        drawResolvedText(disp, it.label || "", contentX, ry, labelW, rh, fill, textSt);
        const ri = it.rightIcon || "auto";
        const hideBadge = ri === "none";
        if (!hideBadge) {
          let badgeRef = ri;
          if (badgeRef === "auto" || badgeRef === "") {
            if (it.target) badgeRef = "arrow_right";
            else badgeRef = "none";
          }
          const badge = badgeRef !== "none" ? resolveIcon(badgeRef, env) : null;
          if (badge) {
            const side = menuIconTargetPx(rh, it.rightIconScale, menuBadgeScale);
            const aY = ry + idiv(rh - side, 2);
            disp.drawIconSized(badge, w.x + w.w - pad - side, aY, side, side, txt);
          }
        }
      }
    } else if (w.type === "textfield") {
      const r = t.radius;
      const kind = w.inputKind || "text";
      const focused = env.focusFieldId === w.id || env.focusNavId === w.id;
      disp.fillRoundRect(w.x, w.y, w.w, w.h, r, t.surface);
      disp.drawRoundRect(w.x, w.y, w.w, w.h, r, focused ? t.primary : t.surfaceEdge);
      const pad = t.padding;
      const editing = env.focusFieldId === w.id && env.editDraft !== null && env.editDraft !== undefined;
      let val = "";
      if (editing) {
        val = env.editDraft;
      } else {
        const rec = env.getValue(w.key);
        if (rec) {
          if (kind === "numeric" || kind === "integer") val = rec.value === undefined || rec.value === null ? "" : String(rec.value);
          else val = String(rec.value || "");
        }
      }
      let show = val;
      if (!show) show = w.placeholder || "";
      else if (kind === "password") show = "\u2022".repeat(Math.min(val.length, 24));
      const dim = !val;
      const fieldSt = st(w.textStyle, { align: "left", dim, size: Math.max(10, Math.min(t.textSize, w.h - pad * 2)) });
      drawResolvedText(disp, show, w.x + pad, w.y, w.w - pad * 2, w.h, t.surface, fieldSt);
      if (w.label) {
        drawResolvedText(disp, w.label, w.x, w.y - 12, w.w, 12, t.background, st(w.labelStyle, { dim: true, size: 10 }));
      }
    } else if (w.type === "keyboard") {
      drawKeyboardAt(disp, { x: w.x, y: w.y, w: w.w, h: w.h, layout: w.layout || "compact" }, t, false, null);
    }
  }

  function drawKeyboardAt(disp, rect, t, overlay, kbFocusIndex) {
    const KB = window.LucarneKeyboard;
    if (!KB || !rect) return;
    const fontBody = t.fontBody || null;
    if (overlay) {
      disp.fillRect(rect.x, rect.y, rect.w, rect.h, t.surface);
      disp.drawRect(rect.x, rect.y, rect.w, rect.h, t.surfaceEdge);
    }
    const layout = KB.getLayout(rect.layout || "compact");
    const rows = layout.rows;
    const gap = KB.GAP;
    const pad = KB.PAD;
    const kh = Math.max(8, Math.floor((rect.h - pad * 2 - gap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length)));
    let ri = 0;
    let y = rect.y + pad;
    rows.forEach((keys) => {
      const totalU = KB.rowUnits(keys);
      const rowW = rect.w - pad * 2;
      const unitW = (rowW - gap * (keys.length - 1)) / totalU;
      let x = rect.x + pad;
      keys.forEach((k) => {
        const kw = Math.max(4, Math.floor(unitW * (k.u || 1)));
        const keyFocus = kbFocusIndex !== null && kbFocusIndex !== undefined && ri === kbFocusIndex;
        const fill565 = overlay ? t.background : t.surface;
        disp.fillRoundRect(x, y, kw, kh, 2, fill565);
        disp.drawRoundRect(x, y, kw, kh, 2, keyFocus ? t.primary : t.surfaceEdge);
        const label = KB.displayLabel(k.t);
        const fontSize = Math.max(8, Math.min(14, kh - 4));
        drawResolvedText(disp, label, x, y, kw, kh, fill565, {
          atlas: fontBody,
          size: fontSize,
          color565: t.text,
          transparent: false,
          align: "center",
          spacing: 0,
        });
        x += kw + gap;
        ri++;
      });
      y += kh + gap;
    });
  }

  function blitRGB565Native(disp, dx, dy, src, sw, sh, alpha, bg, srcOx, srcOy, viewW, viewH) {
    srcOx = srcOx || 0;
    srcOy = srcOy || 0;
    const drawW = viewW > 0 ? viewW : sw - srcOx;
    const drawH = viewH > 0 ? viewH : sh - srcOy;
    for (let py = 0; py < drawH; py++) {
      const sy = srcOy + py;
      if (sy < 0 || sy >= sh) continue;
      for (let px = 0; px < drawW; px++) {
        const sx = srcOx + px;
        if (sx < 0 || sx >= sw) continue;
        const si = sy * sw + sx;
        const fg = src[si];
        let out = fg;
        if (alpha) {
          const a = alpha[si];
          if (a < 8) continue;
          if (a < 250) {
            const under = disp.peekPixel(dx + px, dy + py);
            out = blend565(under, fg, a);
          }
        }
        disp.writePixel(dx + px, dy + py, out);
      }
    }
  }

  function blitRGB565(disp, dx, dy, src, sw, sh, dw, dh, alpha, bg) {
    const sample = (sx, sy, px, py) => {
      const si = sy * sw + sx;
      const fg = src[si];
      if (!alpha) return fg;
      const a = alpha[si];
      if (a < 8) return null;
      if (a >= 250) return fg;
      const under = disp.peekPixel(dx + px, dy + py);
      return blend565(under, fg, a);
    };
    if (dw === sw && dh === sh) {
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const out = sample(x, y, x, y);
          if (out !== null) disp.writePixel(dx + x, dy + y, out);
        }
      }
      return;
    }
    for (let y = 0; y < dh; y++) {
      const sy = Math.floor((y * sh) / dh);
      for (let x = 0; x < dw; x++) {
        const sx = Math.floor((x * sw) / dw);
        const out = sample(sx, sy, x, y);
        if (out !== null) disp.writePixel(dx + x, dy + y, out);
      }
    }
  }

  function drawSplashProgress(disp, theme, durationMs, elapsedMs, offsetY) {
    if (!durationMs) return;
    let ratio = elapsedMs / durationMs;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    const sw = disp.width;
    const sh = disp.height;
    const barH = 6;
    const margin = theme.padding;
    const trackW = sw - margin * 2;
    const fillW = Math.floor(trackW * ratio);
    const oy = offsetY || 0;
    const y = sh - margin - barH - oy;
    disp.fillRoundRect(margin, y, trackW, barH, 3, theme.surface);
    if (fillW > 0) disp.fillRoundRect(margin, y, fillW, barH, 3, theme.primary);
  }

  function shiftWidget(w, offsetY) {
    if (!offsetY) return w;
    return Object.assign({}, w, { y: w.y - offsetY });
  }

  function drawScreen(disp, screen, theme, env) {
    const sw = disp.width;
    const sh = disp.height;
    const cr = screen.cornerRadius || 0;
    const bezel = theme.surfaceEdge;
    const offsetY = env.screenOffsetY || 0;
    if (cr <= 0) {
      disp.fillScreen(theme.background);
    } else {
      disp.fillScreen(bezel);
      disp.fillRoundRect(0, 0, sw, sh, cr, theme.background);
    }
    const widgets = screen.widgets || [];
    for (let i = 0; i < widgets.length; i++) {
      const w = widgets[i];
      if (w.visible === false) continue;
      drawWidget(disp, shiftWidget(w, offsetY), theme, env);
    }
    if (screen.splash && screen.splash.showProgress && env.splashElapsedMs !== undefined) {
      drawSplashProgress(disp, theme, screen.splash.durationMs || 2000, env.splashElapsedMs, offsetY);
    }
    if (env.overlayKeyboard) {
      drawKeyboardAt(disp, env.overlayKeyboard, theme, true, env.kbFocusIndex);
    }
    if (cr > 0) maskScreenCorners(disp, bezel, cr);
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

  function iconWidgetDisplaySize(w, icons) {
    const FE = window.LucarneFluentEmoji;
    let base = 16;
    if (w && w.icon && w.icon.indexOf("emoji:") === 0 && FE) base = FE.SIZE || 32;
    else if (w && w.icon && w.icon.indexOf("c:") === 0) {
      const cid = w.icon.slice(2);
      const custom = icons && icons[cid];
      if (custom && custom.w > 0) base = custom.w;
      else base = 32;
    }
    const sc = normalizeIconScale(w && w.scale, 1);
    let side = Math.max(1, Math.round(base * sc));
    if (w && w.scaleMode === "native") {
      if (w.w > 0 && w.h > 0) return { w: w.w, h: w.h };
      return { w: side, h: side };
    }
    if (w && w.lockSize && w.w > 0 && w.h > 0) return { w: w.w, h: w.h };
    if (w && w.w > 0 && w.h > 0) side = Math.max(side, Math.max(w.w, w.h));
    const maxPx = FE && FE.MAX_EXPORT_PX ? FE.MAX_EXPORT_PX : 160;
    if (side > maxPx) side = maxPx;
    return { w: side, h: side };
  }

  window.LucarneRender = {
    Display,
    color565,
    colorIsOn565,
    blitDisplayToCanvas,
    hexTo565,
    rgb565to888,
    blend565,
    drawScreen,
    drawWidget,
    themeTo565,
    textWidth: textWidthClassic,
    getAATextBounds,
    iconRows,
    resolveIcon,
    resolveIconRows,
    parseIconScale,
    normalizeIconScale,
    iconScaleExport,
    iconWidgetDisplaySize,
    shapeHitTest,
    shapeKindEnum,
    graphTypeEnum,
    graphModeEnum,
    graphSamples,
    composeFB,
  };
})();
