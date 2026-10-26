(function () {
  "use strict";

  const ICON_SIZE = 32;

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function decodePackIcon(obj) {
    if (!obj || !obj.px) return null;
    const w = obj.w;
    const h = obj.h;
    const raw = b64ToBytes(obj.px);
    const pixels = new Uint16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
    let alpha = null;
    if (obj.a) {
      const ar = b64ToBytes(obj.a);
      alpha = new Uint8Array(ar.buffer.slice(ar.byteOffset, ar.byteOffset + ar.byteLength));
    }
    return { w, h, pixels, alpha, color: true };
  }

  function isMonoRows(v) {
    return Array.isArray(v) && v.length === 16 && typeof v[0] === "number";
  }

  function monoFromRows(rows) {
    return { mono: true, w: rows.length, h: rows.length, rows };
  }

  function pixelsToMonoRows(pixels, w, h, alpha, outSize) {
    const n = outSize || 16;
    const rows = new Array(n).fill(0);
    for (let y = 0; y < n; y++) {
      let row = 0;
      const sy = Math.floor((y * h) / n);
      for (let x = 0; x < n; x++) {
        const sx = Math.floor((x * w) / n);
        const si = sy * w + sx;
        const a = alpha ? alpha[si] : 255;
        if (a > 48) row |= 1 << (n - 1 - x);
      }
      rows[y] = row;
    }
    return rows;
  }

  function drawToCanvas(canvas, icon, tint) {
    const ctx = canvas.getContext("2d");
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    if (!icon) return;
    if (icon.mono && icon.rows) {
      ctx.fillStyle = tint || "#e6f0ff";
      for (let y = 0; y < 16; y++) {
        const bits = icon.rows[y] || 0;
        for (let x = 0; x < 16; x++) {
          if (bits & (1 << (15 - x))) ctx.fillRect((x * cw) / 16, (y * ch) / 16, Math.ceil(cw / 16), Math.ceil(ch / 16));
        }
      }
      return;
    }
    if (icon.image && icon.animated) {
      const srcW = icon.image.naturalWidth || icon.image.width || 0;
      const srcH = icon.image.naturalHeight || icon.image.height || 0;
      if (srcW > 0 && srcH > 0) {
        const scale = Math.min(cw / srcW, ch / srcH);
        const rw = srcW * scale;
        const rh = srcH * scale;
        ctx.drawImage(icon.image, (cw - rw) / 2, (ch - rh) / 2, rw, rh);
      }
      return;
    }
    if (!icon.pixels) return;
    const sw = icon.w;
    const sh = icon.h;
    const img = ctx.createImageData(cw, ch);
    const d = img.data;
    for (let y = 0; y < ch; y++) {
      const sy = Math.floor((y * sh) / ch);
      for (let x = 0; x < cw; x++) {
        const sx = Math.floor((x * sw) / cw);
        const si = sy * sw + sx;
        const a = icon.alpha ? icon.alpha[si] : 255;
        if (a < 8) continue;
        const c = icon.pixels[si];
        const r = ((c >> 11) & 0x1f) << 3;
        const g = ((c >> 5) & 0x3f) << 2;
        const b = (c & 0x1f) << 3;
        const di = (y * cw + x) * 4;
        d[di] = r;
        d[di + 1] = g;
        d[di + 2] = b;
        d[di + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let scratchCanvas = null;

  function scratch(w, h) {
    if (!scratchCanvas) scratchCanvas = document.createElement("canvas");
    if (scratchCanvas.width !== w) scratchCanvas.width = w;
    if (scratchCanvas.height !== h) scratchCanvas.height = h;
    return scratchCanvas;
  }

  function rgb888to565(r, g, b) {
    return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
  }

  function blitImage(disp, dx, dy, img, dw, dh, blend565) {
    const srcW = img ? img.naturalWidth || img.width || 0 : 0;
    const srcH = img ? img.naturalHeight || img.height || 0 : 0;
    if (!img || !srcW || !srcH) return;
    dw = Math.max(1, Math.round(dw));
    dh = Math.max(1, Math.round(dh));
    const c = scratch(dw, dh);
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, dw, dh);
    const scale = Math.min(dw / srcW, dh / srcH);
    const rw = srcW * scale;
    const rh = srcH * scale;
    ctx.drawImage(img, (dw - rw) / 2, (dh - rh) / 2, rw, rh);
    const data = ctx.getImageData(0, 0, dw, dh).data;
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const i = (y * dw + x) * 4;
        const a = data[i + 3];
        if (a < 8) continue;
        const fg = rgb888to565(data[i], data[i + 1], data[i + 2]);
        const px = dx + x;
        const py = dy + y;
        if (px < 0 || py < 0 || px >= disp.width || py >= disp.height) continue;
        if (a >= 250) {
          disp.writePixel(px, py, fg);
        } else if (blend565) {
          const under = disp.peekPixel ? disp.peekPixel(px, py) : disp.fb[py * disp.width + px];
          disp.writePixel(px, py, blend565(under, fg, a));
        } else {
          disp.writePixel(px, py, fg);
        }
      }
    }
  }

  function blit565(disp, dx, dy, icon, dw, dh, blend565) {
    if (!icon || !icon.pixels) return;
    const sw = icon.w || 16;
    const sh = icon.h || sw;
    const pix = icon.pixels;
    const alpha = icon.alpha;
    const outW = Math.max(1, Math.round(dw || sw));
    const outH = Math.max(1, Math.round(dh || sh));
    for (let y = 0; y < outH; y++) {
      const sy = Math.floor((y * sh) / outH);
      for (let x = 0; x < outW; x++) {
        const sx = Math.floor((x * sw) / outW);
        const si = sy * sw + sx;
        const a = alpha ? alpha[si] : 255;
        if (a < 8) continue;
        const fg = pix[si];
        if (a >= 250) {
          disp.writePixel(dx + x, dy + y, fg);
        } else if (blend565) {
          const px = dx + x;
          const py = dy + y;
          if (px < 0 || py < 0 || px >= disp.width || py >= disp.height) continue;
          const under = disp.peekPixel ? disp.peekPixel(px, py) : disp.fb[py * disp.width + px];
          disp.writePixel(px, py, blend565(under, fg, a));
        } else {
          disp.writePixel(dx + x, dy + y, fg);
        }
      }
    }
  }

  window.LucarneIconFmt = {
    ICON_SIZE,
    decodePackIcon,
    isMonoRows,
    monoFromRows,
    pixelsToMonoRows,
    drawToCanvas,
    blit565,
    blitImage,
  };
})();
