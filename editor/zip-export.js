(function () {
  "use strict";

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(data) {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function toBytes(content, binary) {
    if (content instanceof Uint8Array) return content;
    if (binary) {
      const u = new Uint8Array(content.length);
      for (let i = 0; i < content.length; i++) u[i] = content.charCodeAt(i) & 0xff;
      return u;
    }
    return new TextEncoder().encode(content);
  }

  function dosTimeDate() {
    const d = new Date();
    const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
    const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
    return { time, date };
  }

  function buildZip(files) {
    const parts = [];
    const central = [];
    let offset = 0;
    const { time, date } = dosTimeDate();

    files.forEach((f) => {
      const path = String(f.name || "file").replace(/\\/g, "/");
      const nameBytes = new TextEncoder().encode(path);
      const data = toBytes(f.content, f.binary);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length + data.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, time, true);
      lv.setUint16(12, date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      local.set(data, 30 + nameBytes.length);
      parts.push(local);

      const cen = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, time, true);
      cv.setUint16(14, date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(42, offset, true);
      cen.set(nameBytes, 46);
      central.push(cen);
      offset += local.length;
    });

    const centralSize = central.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    const total = parts.reduce((a, p) => a + p.length, 0) + centralSize + 22;
    const out = new Uint8Array(total);
    let p = 0;
    parts.forEach((x) => {
      out.set(x, p);
      p += x.length;
    });
    central.forEach((x) => {
      out.set(x, p);
      p += x.length;
    });
    out.set(end, p);
    return out;
  }

  function downloadZip(files, zipName) {
    const zip = buildZip(files);
    const blob = new Blob([zip], { type: "application/zip" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.LucarneZipExport = { buildZip, downloadZip };
})();
