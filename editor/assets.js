(function () {
  "use strict";

  const IMAGE_STORAGE = [
    { value: "flash", label: "Projet.h (flash)" },
    { value: "sd", label: "SD card" },
    { value: "web", label: "Web server" },
    { value: "psram", label: "External RAM" },
  ];

  function rgb888to565(r, g, b) {
    return (((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)) & 0xffff;
  }

  function importFile(file) {
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
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;
        const pixels = new Uint16Array(w * h);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          pixels[p] = rgb888to565(data[i], data[i + 1], data[i + 2]);
        }
        URL.revokeObjectURL(url);
        resolve({
          w,
          h,
          pixels,
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

  function importIcon(file) {
    const SIZE = window.LucarneIconFmt ? window.LucarneIconFmt.ICON_SIZE : 32;
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

  function atlas(entry) {
    if (!entry || !entry.pixels) return null;
    return { w: entry.w, h: entry.h, pixels: entry.pixels };
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
    return {
      label: obj.label || "",
      w: obj.w,
      h: obj.h,
      pixels,
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
    if (s === "sd") return "ImageStorage::Sd";
    if (s === "web") return "ImageStorage::Web";
    if (s === "psram") return "ImageStorage::Psrav";
    return "ImageStorage::Flash";
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

    if (storage === "sd" || storage === "web") {
      return (
        "static const lucarne::ImageAsset " +
        name +
        " = { nullptr, " +
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
    s +=
      "static const lucarne::ImageAsset " +
      name +
      " = { " +
      name +
      "_data, " +
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

  function exportRgb565Bin(entry) {
    if (!entry || !entry.pixels) return null;
    const raw = new Uint8Array(entry.pixels.buffer);
    let bin = "";
    for (let i = 0; i < raw.length; i++) bin += String.fromCharCode(raw[i]);
    return bin;
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
    exportRgb565Bin,
  };
})();
