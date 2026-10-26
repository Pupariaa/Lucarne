(function () {
  "use strict";

  // "web" (fetch-over-HTTP) storage is intentionally not offered here: there is
  // no HTTP image loader in the firmware yet, so an image left in that mode
  // would just draw blank on real hardware. Existing projects saved with
  // storage: "web" are still exported (see toC() below) but flagged by the DRC.
  const IMAGE_STORAGE = [
    { value: "flash", label: "Projet.h (flash)" },
    { value: "sd", label: "SD card" },
    { value: "psram", label: "External RAM" },
  ];

  function rgb888to565(r, g, b) {
    return (((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)) & 0xffff;
  }

  function rasterFromRgba(w, h, data) {
    const pixels = new Uint16Array(w * h);
    const alpha = new Uint8Array(w * h);
    let hasAlpha = false;
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      alpha[p] = data[i + 3];
      if (alpha[p] < 255) hasAlpha = true;
      pixels[p] = rgb888to565(data[i], data[i + 1], data[i + 2]);
    }
    return { pixels, alpha: hasAlpha ? alpha : undefined };
  }

  function importBmpBuffer(buffer, label) {
    const v = new DataView(buffer);
    if (v.byteLength < 54 || v.getUint16(0, true) !== 0x4d42) throw new Error("Not a BMP file");
    const offset = v.getUint32(10, true);
    const dib = v.getUint32(14, true);
    if (dib < 40) throw new Error("Unsupported BMP header");
    const w = v.getInt32(18, true);
    const hRaw = v.getInt32(22, true);
    if (w < 1 || w > 4096) throw new Error("Invalid BMP width");
    const h = Math.abs(hRaw);
    if (h < 1 || h > 4096) throw new Error("Invalid BMP height");
    const topDown = hRaw < 0;
    const bpp = v.getUint16(28, true);
    const comp = v.getUint32(30, true);
    if (comp !== 0) throw new Error("Compressed BMP not supported");
    if (bpp !== 24 && bpp !== 32) throw new Error("BMP must be 24 or 32 bit");
    const rowBytes = Math.floor((bpp * w + 31) / 32) * 4;
    const pixels = new Uint16Array(w * h);
    const alpha = new Uint8Array(w * h);
    let hasAlpha = bpp === 32;
    for (let y = 0; y < h; y++) {
      const srcY = topDown ? y : h - 1 - y;
      const rowOff = offset + srcY * rowBytes;
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (bpp === 32) {
          const i = rowOff + x * 4;
          const b = v.getUint8(i);
          const g = v.getUint8(i + 1);
          const r = v.getUint8(i + 2);
          const a = v.getUint8(i + 3);
          alpha[p] = a;
          if (a < 255) hasAlpha = true;
          pixels[p] = rgb888to565(r, g, b);
        } else {
          const i = rowOff + x * 3;
          alpha[p] = 255;
          pixels[p] = rgb888to565(v.getUint8(i + 2), v.getUint8(i + 1), v.getUint8(i));
        }
      }
    }
    return {
      w,
      h,
      pixels,
      alpha: hasAlpha ? alpha : undefined,
      label: label.replace(/\.[^.]+$/, ""),
      storage: "flash",
      source: "",
    };
  }

  function importRasterFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;
        const { pixels, alpha } = rasterFromRgba(w, h, data);
        URL.revokeObjectURL(url);
        resolve({
          w,
          h,
          pixels,
          alpha,
          label: file.name.replace(/\.[^.]+$/, ""),
          storage: "flash",
          source: "",
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to decode image"));
      };
      img.src = url;
    });
  }

  function importFile(file) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".bmp")) {
      return file.arrayBuffer().then((buffer) => importBmpBuffer(buffer, file.name));
    }
    return importRasterFile(file);
  }

  function importIcon(file) {
    const SIZE = window.LucarneIconFmt ? window.LucarneIconFmt.ICON_SIZE : 32;
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".bmp")) {
      return file.arrayBuffer().then((buffer) => {
        const decoded = importBmpBuffer(buffer, file.name);
        return fitIconRaster(decoded, SIZE);
      });
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = SIZE;
        c.height = SIZE;
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, SIZE, SIZE);
        const scale = Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
        const pixels = new Uint16Array(SIZE * SIZE);
        const alpha = new Uint8Array(SIZE * SIZE);
        for (let p = 0, i = 0; p < SIZE * SIZE; p++, i += 4) {
          alpha[p] = data[i + 3];
          pixels[p] = rgb888to565(data[i], data[i + 1], data[i + 2]);
        }
        URL.revokeObjectURL(url);
        resolve({ w: SIZE, h: SIZE, pixels, alpha, label: file.name.replace(/\.[^.]+$/, "") });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to decode icon"));
      };
      img.src = url;
    });
  }

  function fitIconRaster(src, size) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    const rgba = ctx.createImageData(src.w, src.h);
    for (let p = 0, i = 0; p < src.w * src.h; p++, i += 4) {
      const c565 = src.pixels[p];
      const r = ((c565 >> 11) & 0x1f) * 255 / 31;
      const g = ((c565 >> 5) & 0x3f) * 255 / 63;
      const b = (c565 & 0x1f) * 255 / 31;
      rgba.data[i] = r;
      rgba.data[i + 1] = g;
      rgba.data[i + 2] = b;
      rgba.data[i + 3] = src.alpha ? src.alpha[p] : 255;
    }
    const tmp = document.createElement("canvas");
    tmp.width = src.w;
    tmp.height = src.h;
    tmp.getContext("2d").putImageData(rgba, 0, 0);
    const scale = Math.min(size / src.w, size / src.h);
    const dw = src.w * scale;
    const dh = src.h * scale;
    ctx.drawImage(tmp, (size - dw) / 2, (size - dh) / 2, dw, dh);
    const data = ctx.getImageData(0, 0, size, size).data;
    const { pixels, alpha } = rasterFromRgba(size, size, data);
    return { w: size, h: size, pixels, alpha, label: src.label };
  }

  function atlas(entry) {
    if (!entry || !entry.pixels) return null;
    return { w: entry.w, h: entry.h, pixels: entry.pixels, alpha: entry.alpha };
  }

  function iconAtlas(entry) {
    if (!entry) return null;
    if (entry.pixels) return entry;
    if (entry.rows && window.LucarneIconFmt) return window.LucarneIconFmt.monoFromRows(entry.rows);
    if (entry.rows) return entry.rows;
    return null;
  }

  function b64FromBuffer(buf) {
    const raw = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < raw.length; i++) bin += String.fromCharCode(raw[i]);
    return btoa(bin);
  }

  function serialize(entry) {
    const raw = new Uint8Array(entry.pixels.buffer);
    let bin = "";
    for (let i = 0; i < raw.length; i++) bin += String.fromCharCode(raw[i]);
    return {
      label: entry.label,
      w: entry.w,
      h: entry.h,
      storage: entry.storage || "flash",
      source: entry.source || "",
      b64: btoa(bin),
      a: entry.alpha ? b64FromBuffer(entry.alpha.buffer) : undefined,
    };
  }

  function serializeIcon(entry) {
    if (entry.pixels) {
      return {
        label: entry.label,
        w: entry.w,
        h: entry.h,
        px: b64FromBuffer(entry.pixels.buffer),
        a: entry.alpha ? b64FromBuffer(entry.alpha.buffer) : undefined,
      };
    }
    return { label: entry.label, rows: entry.rows.slice() };
  }

  function deserialize(obj) {
    if (!obj || !obj.b64) return null;
    const bin = atob(obj.b64);
    const raw = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
    const pixels = new Uint16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
    let alpha = undefined;
    if (obj.a) {
      const ab = atob(obj.a);
      alpha = new Uint8Array(ab.length);
      for (let i = 0; i < ab.length; i++) alpha[i] = ab.charCodeAt(i);
    }
    return {
      label: obj.label || "",
      w: obj.w,
      h: obj.h,
      pixels,
      alpha,
      storage: obj.storage || "flash",
      source: obj.source || "",
    };
  }

  function deserializeIcon(obj) {
    if (!obj) return null;
    if (obj.px && window.LucarneIconFmt) return window.LucarneIconFmt.decodePackIcon(obj);
    if (!obj.rows) return null;
    return { label: obj.label || "", rows: obj.rows.slice() };
  }

  function storageEnum(s) {
    if (s === "sd") return "lucarne::ImageStorage::Sd";
    if (s === "volume" || s === "ffat" || s === "internal") return "lucarne::ImageStorage::Volume";
    if (s === "web") return "lucarne::ImageStorage::Web";
    if (s === "psram") return "lucarne::ImageStorage::Psram";
    if (s === "flashrle") return "lucarne::ImageStorage::FlashRle";
    return "lucarne::ImageStorage::Flash";
  }

  function compressRowRle(pixels, alpha, w, y) {
    const out = [];
    const base = y * w;
    let x = 0;
    while (x < w) {
      const i = base + x;
      const a = alpha ? alpha[i] : 255;
      if (a < 8) {
        let run = 1;
        while (x + run < w && run < 255) {
          if ((alpha ? alpha[base + x + run] : 255) >= 8) break;
          run++;
        }
        out.push(0, run);
        x += run;
      } else {
        const px = pixels[i];
        let run = 1;
        while (x + run < w && run < 255) {
          const j = base + x + run;
          if ((alpha ? alpha[j] : 255) < 8) break;
          if (pixels[j] !== px) break;
          run++;
        }
        if (run >= 3) {
          out.push(1, run, px & 0xff, (px >> 8) & 0xff);
          x += run;
        } else {
          out.push(2, px & 0xff, (px >> 8) & 0xff, a);
          x++;
        }
      }
    }
    return out;
  }

  function compressRle(pixels, alpha, w, h) {
    const rowOffsets = [];
    const chunks = [];
    let offset = 0;
    for (let y = 0; y < h; y++) {
      rowOffsets.push(offset);
      const row = compressRowRle(pixels, alpha, w, y);
      for (let i = 0; i < row.length; i++) chunks.push(row[i]);
      offset += row.length;
    }
    rowOffsets.push(offset);
    return { rle: new Uint8Array(chunks), rowOffsets };
  }

  function rleBytes(pixels, alpha, w, h) {
    return compressRle(pixels, alpha, w, h).rle.length;
  }

  function shouldUseRle(entry) {
    if (!entry || !entry.pixels || !entry.alpha) return false;
    const w = entry.w;
    const h = entry.h;
    if (!w || !h || w * h < 16 * 16) return false;
    const raw = w * h * 3;
    return rleBytes(entry.pixels, entry.alpha, w, h) < raw * 0.9;
  }

  function framesEqual(a, b) {
    if (!a || !b) return false;
    const w = a.w || 0;
    const h = a.h || 0;
    if (w !== b.w || h !== b.h) return false;
    if (!a.pixels || !b.pixels || a.pixels.length !== b.pixels.length) return false;
    for (let i = 0; i < a.pixels.length; i++) {
      if (a.pixels[i] !== b.pixels[i]) return false;
      const aa = a.alpha ? a.alpha[i] : 255;
      const ba = b.alpha ? b.alpha[i] : 255;
      if (aa !== ba) return false;
    }
    return true;
  }

  function toRleC(name, entry) {
    const w = entry.w;
    const h = entry.h;
    const packed = compressRle(entry.pixels, entry.alpha, w, h);
    const rle = packed.rle;
    const rowOffsets = packed.rowOffsets;
    let s = "static const uint16_t " + name + "_rowoff[" + rowOffsets.length + "] PROGMEM = { ";
    s += rowOffsets.join(", ") + " };\n\n";
    s += "static const uint8_t " + name + "_rle[" + rle.length + "] PROGMEM = {\n";
    for (let i = 0; i < rle.length; i++) {
      if (i % 16 === 0) s += "    ";
      s += "0x" + rle[i].toString(16).padStart(2, "0");
      s += i < rle.length - 1 ? ", " : "";
      if (i % 16 === 15) s += "\n";
    }
    if (rle.length % 16 !== 0) s += "\n";
    s += "};\n\n";
    s +=
      "static const lucarne::ImageAsset " +
      name +
      " = { (const uint16_t *)" +
      name +
      "_rle, (const uint8_t *)" +
      name +
      "_rowoff, " +
      w +
      ", " +
      h +
      ", lucarne::ImageStorage::FlashRle, nullptr };\n";
    return s;
  }

  function frameExportC(name, entry) {
    const e = {
      w: entry.w,
      h: entry.h,
      pixels: entry.pixels,
      alpha: entry.alpha,
      storage: "flash",
      source: "",
    };
    if (shouldUseRle(e)) return toRleC(name, e);
    return toC(name, e);
  }

  function frameFlashBytes(fr, packW, packH) {
    const w = fr.w || packW || 16;
    const h = fr.h || packH || 16;
    if (fr.alpha && shouldUseRle({ w, h, pixels: fr.pixels, alpha: fr.alpha })) {
      return rleBytes(fr.pixels, fr.alpha, w, h) + (h + 1) * 2;
    }
    let n = w * h * 2;
    if (fr.alpha) n += w * h;
    return n;
  }

  function cstr(s) {
    return '"' + String(s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }

  function toC(name, entry) {
    const w = entry.w;
    const h = entry.h;
    const storage = entry.storage || "flash";
    const source = entry.source || "";
    const st = storageEnum(storage);

    if (storage === "sd" || storage === "volume" || storage === "web") {
      return (
        "static const lucarne::ImageAsset " +
        name +
        " = { nullptr, nullptr, " +
        w +
        ", " +
        h +
        ", " +
        st +
        ", " +
        cstr(source) +
        " };\n"
      );
    }

    const px = entry.pixels;
    let s = "static const uint16_t " + name + "_data[] PROGMEM = {\n";
    for (let i = 0; i < px.length; i++) {
      if (i % 12 === 0) s += "    ";
      s += "0x" + (px[i] & 0xffff).toString(16).padStart(4, "0");
      s += i < px.length - 1 ? ", " : "";
      if (i % 12 === 11) s += "\n";
    }
    if (px.length % 12 !== 0) s += "\n";
    s += "};\n\n";
    let alphaField = "nullptr";
    if (entry.alpha) {
      s += "static const uint8_t " + name + "_alpha[] PROGMEM = {\n";
      for (let i = 0; i < entry.alpha.length; i++) {
        if (i % 16 === 0) s += "    ";
        s += entry.alpha[i];
        s += i < entry.alpha.length - 1 ? ", " : "";
        if (i % 16 === 15) s += "\n";
      }
      if (entry.alpha.length % 16 !== 0) s += "\n";
      s += "};\n\n";
      alphaField = name + "_alpha";
    }
    s +=
      "static const lucarne::ImageAsset " +
      name +
      " = { " +
      name +
      "_data, " +
      alphaField +
      ", " +
      w +
      ", " +
      h +
      ", " +
      st +
      ", " +
      cstr(source) +
      " };\n";
    return s;
  }

  function toIconC(name, entry) {
    if (entry.pixels) {
      return toC(name, {
        w: entry.w,
        h: entry.h,
        pixels: entry.pixels,
        alpha: entry.alpha,
        storage: "flash",
        source: "",
      });
    }
    const rows = entry.rows;
    let s = "static const uint16_t " + name + "_rows[] PROGMEM = {\n    ";
    for (let i = 0; i < rows.length; i++) {
      s += "0x" + (rows[i] & 0xffff).toString(16);
      s += i < rows.length - 1 ? ", " : "";
    }
    s += "\n};\n\n";
    s += "static const uint16_t *" + name + "() { return " + name + "_rows; }\n";
    return s;
  }

  function shouldExportIconColor(ref, icon) {
    if (!icon || !icon.pixels) return false;
    if (ref && ref.indexOf("emoji:") === 0) return true;
    if (icon.alpha) return true;
    return false;
  }

  function packIconForFlash(icon, ref) {
    if (!icon) return null;
    if (icon.rows && !icon.pixels) return { rows: icon.rows.slice ? icon.rows.slice() : icon.rows };
    if (icon.pixels && shouldExportIconColor(ref, icon)) {
      return {
        pixels: icon.pixels,
        w: icon.w,
        h: icon.h,
        alpha: icon.alpha,
      };
    }
    if (icon.pixels && window.LucarneIconFmt && window.LucarneIconFmt.pixelsToMonoRows) {
      return {
        rows: window.LucarneIconFmt.pixelsToMonoRows(icon.pixels, icon.w, icon.h, icon.alpha, 16),
      };
    }
    return icon;
  }

  function flashBytesIcon(icon) {
    if (!icon) return 0;
    if (icon.rows) return (icon.rows.length || 16) * 2;
    const w = icon.w || 16;
    const h = icon.h || 16;
    let n = w * h * 2;
    if (icon.alpha) n += w * h;
    return n;
  }

  function flashBytesImage(entry) {
    if (!entry || !entry.pixels) return 0;
    let n = entry.w * entry.h * 2;
    if (entry.alpha) n += entry.w * entry.h;
    return n;
  }

  function estimateHeaderBytes(flashBytes) {
    return Math.round(flashBytes * 5.5);
  }

  function intersectRect(ax, ay, aw, ah, bx, by, bw, bh) {
    const x0 = Math.max(ax, bx);
    const y0 = Math.max(ay, by);
    const x1 = Math.min(ax + aw, bx + bw);
    const y1 = Math.min(ay + ah, by + bh);
    if (x1 <= x0 || y1 <= y0) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function panelSize(project) {
    return {
      w: project.panelWidth > 0 ? project.panelWidth : 240,
      h: project.panelHeight > 0 ? project.panelHeight : 280,
    };
  }

  function imageWidgetDrawSize(w, img) {
    const mode = w.scaleMode || "fit";
    if (mode === "native") {
      return {
        w: w.w > 0 ? w.w : img.w,
        h: w.h > 0 ? w.h : img.h,
      };
    }
    return {
      w: w.w > 0 ? w.w : img.w,
      h: w.h > 0 ? w.h : img.h,
    };
  }

  function collectImageUsage(project) {
    const usage = {};
    if (!project || !project.screens || !project.images) return usage;
    const panel = panelSize(project);
    project.screens.forEach((screen) => {
      (screen.widgets || []).forEach((w) => {
        if (w.type !== "image" || !w.imageId) return;
        const img = project.images[w.imageId];
        if (!img) return;
        const id = w.imageId;
        const mode = w.scaleMode || "fit";
        const draw = imageWidgetDrawSize(w, img);
        if (!usage[id]) {
          usage[id] = {
            maxW: 0,
            maxH: 0,
            count: 0,
            hasFit: false,
            hasNative: false,
            cropOx: 0,
            cropOy: 0,
            cropW: 0,
            cropH: 0,
          };
        }
        usage[id].count++;
        if (mode === "native") {
          usage[id].hasNative = true;
          const vis = intersectRect(w.x, w.y, draw.w, draw.h, 0, 0, panel.w, panel.h);
          if (!vis) return;
          const srcX = vis.x - w.x;
          const srcY = vis.y - w.y;
          const u = usage[id];
          if (u.cropW === 0) {
            u.cropOx = srcX;
            u.cropOy = srcY;
            u.cropW = vis.w;
            u.cropH = vis.h;
          } else {
            const x0 = Math.min(u.cropOx, srcX);
            const y0 = Math.min(u.cropOy, srcY);
            const x1 = Math.max(u.cropOx + u.cropW, srcX + vis.w);
            const y1 = Math.max(u.cropOy + u.cropH, srcY + vis.h);
            u.cropOx = x0;
            u.cropOy = y0;
            u.cropW = x1 - x0;
            u.cropH = y1 - y0;
          }
        } else {
          usage[id].hasFit = true;
          if (draw.w > usage[id].maxW) usage[id].maxW = draw.w;
          if (draw.h > usage[id].maxH) usage[id].maxH = draw.h;
        }
      });
    });
    return usage;
  }

  function cropRaster(entry, sx, sy, cw, ch) {
    if (!entry || !entry.pixels) return entry;
    const sw = entry.w;
    const sh = entry.h;
    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;
    if (cw < 1) cw = 1;
    if (ch < 1) ch = 1;
    if (sx + cw > sw) cw = sw - sx;
    if (sy + ch > sh) ch = sh - sy;
    if (sx === 0 && sy === 0 && cw === sw && ch === sh) return entry;
    const pixels = new Uint16Array(cw * ch);
    let alpha = undefined;
    if (entry.alpha) alpha = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const si = (sy + y) * sw + (sx + x);
        const di = y * cw + x;
        pixels[di] = entry.pixels[si];
        if (alpha) alpha[di] = entry.alpha[si];
      }
    }
    return {
      label: entry.label,
      w: cw,
      h: ch,
      pixels,
      alpha,
      storage: entry.storage,
      source: entry.source,
      cropOx: sx,
      cropOy: sy,
    };
  }

  function resizeRaster(entry, dw, dh) {
    if (!entry || !entry.pixels) return entry;
    const sw = entry.w;
    const sh = entry.h;
    if (dw < 1) dw = sw;
    if (dh < 1) dh = sh;
    if (dw === sw && dh === sh) return entry;
    const pixels = new Uint16Array(dw * dh);
    let alpha = undefined;
    if (entry.alpha) alpha = new Uint8Array(dw * dh);
    for (let y = 0; y < dh; y++) {
      const sy = Math.floor((y * sh) / dh);
      for (let x = 0; x < dw; x++) {
        const sx = Math.floor((x * sw) / dw);
        const si = sy * sw + sx;
        const di = y * dw + x;
        pixels[di] = entry.pixels[si];
        if (alpha) alpha[di] = entry.alpha[si];
      }
    }
    return {
      label: entry.label,
      w: dw,
      h: dh,
      pixels,
      alpha,
      storage: entry.storage,
      source: entry.source,
    };
  }

  function imageForExport(project, id, usage) {
    const img = project.images[id];
    if (!img) return null;
    const st = img.storage || "flash";
    const used = usage[id];
    if (!used) return null;
    if (!img.pixels) {
      if (st === "sd" || st === "volume" || st === "web") return img;
      return null;
    }
    if (used.hasNative && !used.hasFit && used.cropW > 0 && used.cropH > 0) {
      const cropped = cropRaster(img, used.cropOx, used.cropOy, used.cropW, used.cropH);
      cropped.exportCropOx = used.cropOx;
      cropped.exportCropOy = used.cropOy;
      return cropped;
    }
    if (used.hasFit) {
      return resizeRaster(img, used.maxW, used.maxH);
    }
    return img;
  }

  function exportImageWidgetRect(w, project, usage) {
    const panel = panelSize(project);
    const img = w.imageId ? project.images[w.imageId] : null;
    if (!img || w.scaleMode !== "native") {
      const draw = img ? imageWidgetDrawSize(w, img) : { w: w.w, h: w.h };
      return { x: w.x, y: w.y, w: draw.w, h: draw.h };
    }
    const draw = imageWidgetDrawSize(w, img);
    const vis = intersectRect(w.x, w.y, draw.w, draw.h, 0, 0, panel.w, panel.h);
    if (!vis) return { x: w.x, y: w.y, w: draw.w, h: draw.h };
    const used = usage[w.imageId];
    if (used && used.hasNative && !used.hasFit && used.cropW > 0) {
      return { x: vis.x, y: vis.y, w: vis.w, h: vis.h };
    }
    return { x: w.x, y: w.y, w: draw.w, h: draw.h };
  }

  function exportTotalBytes(files) {
    if (!files || !files.length) return 0;
    const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    let n = 0;
    files.forEach((f) => {
      if (f.binary) n += f.content.length;
      else if (enc) n += enc.encode(f.content).length;
      else n += f.content.length;
    });
    return n;
  }

  function formatExportSize(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  }

  function flashBytesFont(atlas) {
    if (!atlas || !atlas.glyphs) return 0;
    let n = 0;
    for (let code = atlas.first; code <= atlas.last; code++) {
      const g = atlas.glyphs[code];
      if (g && g.cov) n += g.cov.length;
    }
    n += (atlas.last - atlas.first + 1) * 12;
    return n;
  }

  function exportRgb565Bin(entry) {
    if (!entry || !entry.pixels) return null;
    const raw = new Uint8Array(entry.pixels.buffer);
    let bin = "";
    for (let i = 0; i < raw.length; i++) bin += String.fromCharCode(raw[i]);
    return bin;
  }

  function exportAlphaBin(entry) {
    if (!entry || !entry.alpha) return null;
    let bin = "";
    for (let i = 0; i < entry.alpha.length; i++) bin += String.fromCharCode(entry.alpha[i]);
    return bin;
  }

  function toSdC(name, entry, fileStorage) {
    const w = entry.w;
    const h = entry.h;
    const source = entry.source || "";
    const st =
      fileStorage === "volume" ? "lucarne::ImageStorage::Volume" : "lucarne::ImageStorage::Sd";
    return (
      "static const lucarne::ImageAsset " +
      name +
      " = { nullptr, nullptr, " +
      w +
      ", " +
      h +
      ", " +
      st +
      ", " +
      cstr(source) +
      " };\n"
    );
  }

  function toAnimIconSdC(name, pack, frameSources, fileStorage) {
    const frames = pack.frames || [];
    const delays = pack.delays || [];
    const w = pack.w;
    const h = pack.h;
    const unique = [];
    const uniqueSources = [];
    const seqNames = [];
    let s = "";
    for (let i = 0; i < frames.length; i++) {
      const fr = frames[i];
      let ui = -1;
      for (let j = 0; j < unique.length; j++) {
        if (framesEqual(fr, unique[j])) {
          ui = j;
          break;
        }
      }
      if (ui < 0) {
        ui = unique.length;
        unique.push(fr);
        const fn = name + "_f" + ui;
        const src = frameSources[ui];
        s += toSdC(fn, {
          w: fr.w || w,
          h: fr.h || h,
          source: src,
        }, fileStorage);
        uniqueSources.push(fn);
      }
      seqNames.push(name + "_f" + ui);
    }
    s += "static const uint16_t " + name + "_delays[] PROGMEM = { " + delays.join(", ") + " };\n\n";
    s += "static const lucarne::ImageAsset *const " + name + "_frames[] PROGMEM = {\n";
    seqNames.forEach((fn, i) => {
      s += "    &" + fn + (i < seqNames.length - 1 ? ",\n" : "\n");
    });
    s += "};\n\n";
    s +=
      "static const lucarne::IconAnimAsset " +
      name +
      " = { " +
      w +
      ", " +
      h +
      ", " +
      frames.length +
      ", " +
      (pack.numPlays || 0) +
      ", " +
      name +
      "_delays, " +
      name +
      "_frames };\n";
    return s;
  }

  function flashBytesAnimHeader(pack) {
    if (!pack || !pack.frames) return 0;
    return pack.frames.length * 12 + pack.frames.length * 2 + 64;
  }

  function toAnimIconC(name, pack) {
    const frames = pack.frames || [];
    const delays = pack.delays || [];
    const w = pack.w;
    const h = pack.h;
    const unique = [];
    const seqNames = [];
    let s = "";
    for (let i = 0; i < frames.length; i++) {
      const fr = frames[i];
      let ui = -1;
      for (let j = 0; j < unique.length; j++) {
        if (framesEqual(fr, unique[j])) {
          ui = j;
          break;
        }
      }
      if (ui < 0) {
        ui = unique.length;
        unique.push(fr);
        const fn = name + "_f" + ui;
        s += frameExportC(fn, { w: fr.w || w, h: fr.h || h, pixels: fr.pixels, alpha: fr.alpha });
      }
      seqNames.push(name + "_f" + ui);
    }
    s += "static const uint16_t " + name + "_delays[] PROGMEM = { " + delays.join(", ") + " };\n\n";
    s += "static const lucarne::ImageAsset *const " + name + "_frames[] PROGMEM = {\n";
    seqNames.forEach((fn, i) => {
      s += "    &" + fn + (i < seqNames.length - 1 ? ",\n" : "\n");
    });
    s += "};\n\n";
    s +=
      "static const lucarne::IconAnimAsset " +
      name +
      " = { " +
      w +
      ", " +
      h +
      ", " +
      frames.length +
      ", " +
      (pack.numPlays || 0) +
      ", " +
      name +
      "_delays, " +
      name +
      "_frames };\n";
    return s;
  }

  function flashBytesAnim(pack) {
    if (!pack || !pack.frames) return 0;
    const pw = pack.w || 16;
    const ph = pack.h || 16;
    let n = pack.frames.length * 12;
    const seen = [];
    pack.frames.forEach((fr) => {
      let known = false;
      for (let i = 0; i < seen.length; i++) {
        if (framesEqual(fr, seen[i])) {
          known = true;
          break;
        }
      }
      if (!known) {
        seen.push(fr);
        n += frameFlashBytes(fr, pw, ph);
      }
    });
    n += pack.frames.length * 2;
    return n;
  }

  window.LucarneAssets = {
    IMAGE_STORAGE,
    importFile,
    importIcon,
    atlas,
    iconAtlas,
    serialize,
    serializeIcon,
    deserialize,
    deserializeIcon,
    toC,
    toIconC,
    packIconForFlash,
    flashBytesIcon,
    flashBytesImage,
    estimateHeaderBytes,
    collectImageUsage,
    resizeRaster,
    cropRaster,
    imageForExport,
    exportImageWidgetRect,
    panelSize,
    exportTotalBytes,
    formatExportSize,
    flashBytesFont,
    exportRgb565Bin,
    exportAlphaBin,
    toSdC,
    toAnimIconSdC,
    toAnimIconC,
    flashBytesAnim,
    flashBytesAnimHeader,
    framesEqual,
  };
})();
