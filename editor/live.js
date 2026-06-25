(function () {
  "use strict";

  const MAGIC0 = 0x4c;
  const MAGIC1 = 0x50;
  const T_HELLO = 0x01;
  const T_INFO = 0x02;
  const T_FRAME = 0x10;

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

    function isConnected() {
      return connected;
    }

    function deviceDims() {
      return deviceW && deviceH ? { w: deviceW, h: deviceH } : null;
    }

    function notify() {
      if (opts.onState) opts.onState(connected);
    }

    async function connect() {
      if (!("serial" in navigator)) {
        throw new Error("Web Serial not supported, use Chrome or Edge");
      }
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      writer = port.writable.getWriter();
      connected = true;
      readAbort = false;
      readLoop();
      await sendPacket(T_HELLO, new Uint8Array(0));
      notify();
    }

    async function disconnect() {
      readAbort = true;
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
      notify();
    }

    async function readLoop() {
      const parse = makeParser((w, h) => {
        deviceW = w;
        deviceH = h;
      });
      try {
        reader = port.readable.getReader();
        while (!readAbort) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) parse(value);
        }
      } catch (e) {
        // read error, fall through to cleanup
      } finally {
        try {
          if (reader) reader.releaseLock();
        } catch (e) {}
        if (connected && !readAbort) disconnect();
      }
    }

    function makeParser(onInfo) {
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
              onInfo(payload[2] | (payload[3] << 8), payload[4] | (payload[5] << 8));
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

    function encodeRLE(fb) {
      const pairs = [];
      const n = fb.length;
      let i = 0;
      while (i < n) {
        const v = fb[i] & 0xffff;
        let c = 1;
        while (i + c < n && (fb[i + c] & 0xffff) === v && c < 0xffff) c++;
        pairs.push(c & 0xff, (c >> 8) & 0xff, v & 0xff, (v >> 8) & 0xff);
        i += c;
      }
      return Uint8Array.from(pairs);
    }

    function buildFrame(disp) {
      const w = disp.width;
      const h = disp.height;
      const rle = encodeRLE(disp.fb);
      const payload = new Uint8Array(9 + rle.length);
      payload[0] = 0;
      payload[1] = 0;
      payload[2] = 0;
      payload[3] = 0;
      payload[4] = w & 0xff;
      payload[5] = (w >> 8) & 0xff;
      payload[6] = h & 0xff;
      payload[7] = (h >> 8) & 0xff;
      payload[8] = 1;
      payload.set(rle, 9);
      return payload;
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
        await sendPacket(T_FRAME, buildFrame(disp));
      } catch (e) {
        // write failed, drop this frame
      }
      busy = false;
      if (pending) pump();
    }

    return { connect, disconnect, isConnected, deviceDims, sendDisplay };
  }

  window.LucarneLive = { init };
})();
