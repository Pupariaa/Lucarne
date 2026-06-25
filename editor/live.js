(function () {
  "use strict";

  const MAGIC0 = 0x4c;
  const MAGIC1 = 0x50;
  const T_HELLO = 0x01;
  const T_INFO = 0x02;
  const T_SETUP = 0x04;
  const T_LOAD_REQ = 0x05;
  const T_LOAD = 0x06;
  const T_FRAME = 0x10;

  const LOAD_LAST = 1;
  const LOAD_ERR = 2;

  function init(opts) {
    opts = opts || {};
    let port = null;
    let writer = null;
    let reader = null;
    let connected = false;
    let readAbort = false;
    let deviceW = 0;
    let deviceH = 0;

    let busy = false;
    let pending = null;

    let loadChunks = null;
    let loadResolve = null;
    let loadReject = null;
    let baudRate = typeof opts.baudRate === "number" ? opts.baudRate : 2000000;

    function setBaudRate(b) {
      const v = parseInt(b, 10);
      if (v >= 115200 && v <= 3000000) baudRate = v;
    }

    function getBaudRate() {
      return baudRate;
    }

    let lastFb = null;

    function isConnected() {
      return connected;
    }

    function deviceDims() {
      return deviceW && deviceH ? { w: deviceW, h: deviceH } : null;
    }

    function notify() {
      if (opts.onState) opts.onState(connected);
    }

    function notifyInfo() {
      if (opts.onInfo && deviceW && deviceH) opts.onInfo(deviceW, deviceH);
    }

    function resetLoad() {
      loadChunks = null;
      loadResolve = null;
      loadReject = null;
    }

    function finishLoad(err, text) {
      const resolve = loadResolve;
      const reject = loadReject;
      resetLoad();
      if (err) reject(err);
      else resolve(text);
    }

    async function connect() {
      if (!("serial" in navigator)) {
        throw new Error("Web Serial not supported, use Chrome or Edge");
      }
      port = await navigator.serial.requestPort();
      await port.open({ baudRate });
      writer = port.writable.getWriter();
      connected = true;
      readAbort = false;
      readLoop();
      await sendPacket(T_HELLO, new Uint8Array(0));
      notify();
    }

    async function disconnect() {
      readAbort = true;
      if (loadReject) finishLoad(new Error("Disconnected"));
      try {
        if (reader) await reader.cancel();
      } catch (e) {}
      try {
        if (writer) writer.releaseLock();
      } catch (e) {}
      try {
        if (port) await port.close();
      } catch (e) {}
      reader = null;
      writer = null;
      port = null;
      connected = false;
      deviceW = 0;
      deviceH = 0;
      busy = false;
      pending = null;
      lastFb = null;
      notify();
    }

    async function readLoop() {
      const parse = makeParser({
        onInfo(w, h) {
          deviceW = w;
          deviceH = h;
          notifyInfo();
        },
        onLoad(flags, data) {
          if (!loadChunks) return;
          if (flags & LOAD_ERR) {
            finishLoad(new Error("SD read failed"));
            return;
          }
          if (data.length) {
            for (let i = 0; i < data.length; i++) loadChunks.push(data[i]);
          }
          if (flags & LOAD_LAST) {
            const bytes = Uint8Array.from(loadChunks);
            const text = new TextDecoder().decode(bytes);
            finishLoad(null, text);
          }
        },
      });
      try {
        reader = port.readable.getReader();
        while (!readAbort) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) parse(value);
        }
      } catch (e) {
        if (loadReject) finishLoad(e);
      } finally {
        try {
          if (reader) reader.releaseLock();
        } catch (e) {}
        if (connected && !readAbort) disconnect();
      }
    }

    function makeParser(handlers) {
      let st = 0;
      let hdr = [];
      let type = 0;
      let left = 0;
      let payload = [];
      return function (chunk) {
        for (let i = 0; i < chunk.length; i++) {
          const b = chunk[i];
          if (st === 0) {
            if (b === MAGIC0) st = 1;
          } else if (st === 1) {
            if (b === MAGIC1) {
              st = 2;
              hdr = [];
            } else if (b !== MAGIC0) {
              st = 0;
            }
          } else if (st === 2) {
            hdr.push(b);
            if (hdr.length === 6) {
              type = hdr[0];
              left = hdr[2] | (hdr[3] << 8) | (hdr[4] << 16) | (hdr[5] << 24);
              payload = [];
              st = left > 0 ? 3 : 4;
            }
          } else if (st === 3) {
            payload.push(b);
            if (--left === 0) st = 4;
          } else if (st === 4) {
            if (type === T_INFO && payload.length >= 6) {
              handlers.onInfo(payload[2] | (payload[3] << 8), payload[4] | (payload[5] << 8));
            } else if (type === T_LOAD && payload.length >= 1) {
              const flags = payload[0];
              const data = payload.slice(1);
              handlers.onLoad(flags, data);
            }
            st = 0;
          }
        }
      };
    }

    async function sendPacket(type, payload) {
      if (!writer) return;
      const len = payload.length;
      const buf = new Uint8Array(8 + len + 1);
      buf[0] = MAGIC0;
      buf[1] = MAGIC1;
      buf[2] = type;
      buf[3] = 0;
      buf[4] = len & 0xff;
      buf[5] = (len >> 8) & 0xff;
      buf[6] = (len >> 16) & 0xff;
      buf[7] = (len >>> 24) & 0xff;
      buf.set(payload, 8);
      let x = 0;
      for (let i = 0; i < len; i++) x ^= payload[i];
      buf[8 + len] = x;
      await writer.write(buf);
    }

    async function sendSetup(panelW, panelH, rotation) {
      if (!connected) return;
      const payload = new Uint8Array(5);
      payload[0] = panelW & 0xff;
      payload[1] = (panelW >> 8) & 0xff;
      payload[2] = panelH & 0xff;
      payload[3] = (panelH >> 8) & 0xff;
      payload[4] = rotation & 3;
      await sendPacket(T_SETUP, payload);
    }

    function loadFromSd(path) {
      if (!connected) return Promise.reject(new Error("Not connected"));
      if (loadResolve) return Promise.reject(new Error("Load already in progress"));
      return new Promise((resolve, reject) => {
        loadChunks = [];
        loadResolve = (text) => {
          try {
            resolve(JSON.parse(text));
          } catch (e) {
            reject(new Error("Invalid JSON from SD"));
          }
        };
        loadReject = reject;
        const enc = new TextEncoder().encode(path);
        sendPacket(T_LOAD_REQ, enc).catch(reject);
      });
    }

    function encodeRLEBuffer(buf) {
      const pairs = [];
      const n = buf.length;
      let i = 0;
      while (i < n) {
        const v = buf[i] & 0xffff;
        let c = 1;
        while (i + c < n && (buf[i + c] & 0xffff) === v && c < 0xffff) c++;
        pairs.push(c & 0xff, (c >> 8) & 0xff, v & 0xff, (v >> 8) & 0xff);
        i += c;
      }
      return Uint8Array.from(pairs);
    }

    function encodeRawRGB565(fb, stride, x, y, rw, rh) {
      const out = new Uint8Array(rw * rh * 2);
      let o = 0;
      for (let row = 0; row < rh; row++) {
        const src = (y + row) * stride + x;
        for (let col = 0; col < rw; col++) {
          const v = fb[src + col] & 0xffff;
          out[o++] = v & 0xff;
          out[o++] = (v >> 8) & 0xff;
        }
      }
      return out;
    }

    function encodeRLERegion(fb, stride, x, y, rw, rh) {
      const tmp = new Uint16Array(rw * rh);
      let t = 0;
      for (let row = 0; row < rh; row++) {
        const src = (y + row) * stride + x;
        for (let col = 0; col < rw; col++) tmp[t++] = fb[src + col];
      }
      return encodeRLEBuffer(tmp);
    }

    const MAX_PAYLOAD = 28000;
    const STRIP_H = 40;

    function buildRegionPayload(disp, x, y, rw, rh) {
      const fb = disp.fb;
      const stride = disp.width;
      const raw = encodeRawRGB565(fb, stride, x, y, rw, rh);
      const rle = encodeRLERegion(fb, stride, x, y, rw, rh);
      const enc = rle.length < raw.length ? 1 : 0;
      const data = enc ? rle : raw;
      const payload = new Uint8Array(9 + data.length);
      payload[0] = x & 0xff;
      payload[1] = (x >> 8) & 0xff;
      payload[2] = y & 0xff;
      payload[3] = (y >> 8) & 0xff;
      payload[4] = rw & 0xff;
      payload[5] = (rw >> 8) & 0xff;
      payload[6] = rh & 0xff;
      payload[7] = (rh >> 8) & 0xff;
      payload[8] = enc;
      payload.set(data, 9);
      return payload;
    }

    function findDirtyBounds(last, cur, w, h) {
      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      let changed = 0;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const i = py * w + px;
          if (last[i] !== cur[i]) {
            changed++;
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
        }
      }
      if (changed === 0) return null;
      if (changed > w * h * 0.35) return { x: 0, y: 0, w, h };
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

    function splitRegions(disp, x, y, rw, rh) {
      const frames = [];
      if (rw * rh * 2 <= MAX_PAYLOAD) {
        frames.push(buildRegionPayload(disp, x, y, rw, rh));
        return frames;
      }
      for (let sy = 0; sy < rh; sy += STRIP_H) {
        const sh = Math.min(STRIP_H, rh - sy);
        frames.push(buildRegionPayload(disp, x, y + sy, rw, sh));
      }
      return frames;
    }

    function buildFrames(disp) {
      const w = disp.width;
      const h = disp.height;
      const n = w * h;
      if (!lastFb || lastFb.length !== n) {
        lastFb = new Uint16Array(disp.fb);
        return splitRegions(disp, 0, 0, w, h);
      }
      const bounds = findDirtyBounds(lastFb, disp.fb, w, h);
      lastFb.set(disp.fb);
      if (!bounds) return [];
      return splitRegions(disp, bounds.x, bounds.y, bounds.w, bounds.h);
    }

    function sendDisplay(disp) {
      if (!connected) return;
      pending = disp;
      pump();
    }

    async function pump() {
      if (busy || !pending || !connected) return;
      busy = true;
      const disp = pending;
      pending = null;
      try {
        const frames = buildFrames(disp);
        for (let i = 0; i < frames.length; i++) {
          await sendPacket(T_FRAME, frames[i]);
        }
      } catch (e) {}
      busy = false;
      if (pending) pump();
    }

    function resetFrame() {
      lastFb = null;
    }

    return { connect, disconnect, isConnected, deviceDims, sendSetup, sendDisplay, loadFromSd, resetFrame, setBaudRate, getBaudRate };
  }

  window.LucarneLive = { init };
})();
