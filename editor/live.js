(function () {
  "use strict";

  const MAGIC0 = 0x4c;
  const MAGIC1 = 0x50;
  const T_HELLO = 0x01;
  const T_INFO = 0x02;
  const T_PING = 0x03;
  const T_SETUP = 0x04;
  const T_LOAD_REQ = 0x05;
  const T_LOAD = 0x06;
  const T_HWCONFIG = 0x07;
  const T_HWCONFIG_OLED = 0x08;
  const T_HWCONFIG_MATRIX = 0x09;
  const T_FRAME = 0x10;
  const T_ACK = 0x11;

  const HWCONFIG_ACK_MS = 12000;

  const ACK_MS = 45000;

  const LOAD_LAST = 1;
  const LOAD_ERR = 2;

  const USB_FILTERS = [
    { usbVendorId: 0x303a },
    { usbVendorId: 0x1a86 },
    { usbVendorId: 0x10c4 },
    { usbVendorId: 0x0403 },
    { usbVendorId: 0x2341 },
  ];

  const HANDSHAKE_MS = 4000;
  const HANDSHAKE_TOTAL_MS = 12000;
  const HANDSHAKE_TRY_MS = 1500;

  function init(opts) {
    opts = opts || {};
    let port = null;
    let writer = null;
    let reader = null;
    let connected = false;
    let readAbort = false;
    let deviceW = 0;
    let deviceH = 0;
    let deviceProtoVersion = 0;

    let busy = false;
    let pending = null;
    let readGen = 0;
    let parserReset = function () {};

    let loadChunks = null;
    let loadResolve = null;
    let loadReject = null;
    let baudRate = typeof opts.baudRate === "number" ? opts.baudRate : 2000000;

    let infoWaitResolve = null;
    let infoWaitReject = null;
    let ackResolve = null;
    let ackReject = null;
    let ackGate = "closed";
    let queuedAck = null;
    let reopening = false;
    let restartPending = false;
    let lastRecycle = 0;
    let lastWant = 0;
    let watch = 0;
    let hwConfigChain = Promise.resolve();
    let streamReady = false;

    function setBaudRate(b) {
      const v = parseInt(b, 10);
      if (v >= 115200 && v <= 3000000) baudRate = v;
      if (connected) applyStreamProfile();
    }

    function getBaudRate() {
      return baudRate;
    }

    let lastFb = null;
    let forceFullNext = true;
    let pumpGeneration = 0;
    let streamTune = { maxPayload: 16384, stripH: 32, fullEvery: 12, dirtyRatio: 0.3, ackMs: 45000 };
    let framesSinceFull = 0;

    function isConnected() {
      return connected;
    }

    function deviceDims() {
      return deviceW && deviceH ? { w: deviceW, h: deviceH } : null;
    }

    function getProtoVersion() {
      return deviceProtoVersion;
    }

    function notify() {
      if (opts.onState) opts.onState(connected);
    }

    function notifyInfo() {
      if (opts.onInfo && deviceW && deviceH) opts.onInfo(deviceW, deviceH);
    }

    function clearInfoWait() {
      infoWaitResolve = null;
      infoWaitReject = null;
    }

    function applyStreamProfile() {
      const LP = window.LucarneLiveProfiles;
      const project = opts.getProject ? opts.getProject() : null;
      const info = {
        maxPayload: deviceMaxPayload,
        stripH: 0,
        fullEvery: 0,
      };
      streamTune = LP ? LP.resolve(project, baudRate, info) : streamTune;
      const advertised = deviceMaxPayload > 0 ? deviceMaxPayload : 4096;
      const cap = Math.min(advertised, 4096);
      streamTune.maxPayload = Math.min(streamTune.maxPayload || cap, cap);
    }

    let deviceMaxPayload = 0;
    let deviceDriverId = 0;
    let sawInfo = false;

    function onDeviceInfo(ver, w, h, extra) {
      deviceProtoVersion = ver | 0;
      deviceW = w;
      deviceH = h;
      deviceMaxPayload = extra && extra.maxPayload ? extra.maxPayload : 0;
      deviceDriverId = extra && extra.driverId ? extra.driverId : 0;
      sawInfo = true;
      applyStreamProfile();
      notifyInfo();
      if (infoWaitResolve) {
        const resolve = infoWaitResolve;
        clearInfoWait();
        resolve({ w, h, ver: deviceProtoVersion });
      }
    }

    function clearAckWait() {
      ackResolve = null;
      ackReject = null;
    }

    function onAck(status) {
      if (ackGate === "writing") {
        queuedAck = status;
        return;
      }
      if (ackGate !== "open" || !ackResolve) return;
      const resolve = ackResolve;
      const reject = ackReject;
      ackGate = "closed";
      clearAckWait();
      if (status === 2) reject(new Error("Display begin failed on device"));
      else resolve(status === undefined ? 0 : status);
    }

    function waitAck(ms) {
      ackGate = "closed";
      queuedAck = null;
      clearAckWait();
      return new Promise((resolve, reject) => {
        ackResolve = resolve;
        ackReject = reject;
        setTimeout(() => {
          if (!ackReject) return;
          ackGate = "closed";
          queuedAck = null;
          clearAckWait();
          reject(new Error("Device ACK timeout — frame incomplete"));
        }, ms);
      });
    }

    function waitForInfo(ms) {
      clearInfoWait();
      return new Promise((resolve, reject) => {
        infoWaitResolve = resolve;
        infoWaitReject = reject;
        setTimeout(() => {
          if (!infoWaitReject) return;
          clearInfoWait();
          reject(
            new Error(
              "Device did not answer — flash LucarnePreview.ino, enable USB CDC On Boot, close Arduino Serial Monitor, pick the USB port (not Bluetooth)"
            )
          );
        }, ms);
      });
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

    async function pickPort() {
      if (!("serial" in navigator)) {
        throw new Error("Web Serial not supported — use Chrome or Edge on desktop");
      }
      if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
        throw new Error("Web Serial needs HTTPS or localhost");
      }
      try {
        return await navigator.serial.requestPort({ filters: USB_FILTERS });
      } catch (e) {
        if (e && e.name === "NotFoundError") {
          throw new Error("No port selected");
        }
        if (e && e.name === "SecurityError") {
          throw e;
        }
        try {
          return await navigator.serial.requestPort();
        } catch (e2) {
          if (e2 && e2.name === "NotFoundError") throw new Error("No port selected");
          throw e2;
        }
      }
    }

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function connect() {
      if (connected) return;
      port = await pickPort();
      try {
        await port.open({ baudRate });
      } catch (e) {
        port = null;
        if (e && e.name === "InvalidStateError") {
          throw new Error("Port already open — close Arduino Serial Monitor and retry");
        }
        throw new Error(e && e.message ? e.message : "Could not open port");
      }
      writer = port.writable.getWriter();
      connected = true;
      streamReady = false;
      readAbort = false;
      sawInfo = false;
      readLoop();
      const deadline = Date.now() + HANDSHAKE_TOTAL_MS;
      let answered = false;
      try {
        while (!answered && Date.now() < deadline) {
          if (sawInfo) {
            answered = true;
            break;
          }
          const slice = Math.min(HANDSHAKE_TRY_MS, Math.max(400, deadline - Date.now()));
          const infoPromise = waitForInfo(slice);
          try {
            await sendPacket(T_HELLO, new Uint8Array(0));
            await infoPromise;
            answered = true;
          } catch (e) {
            if (!connected) throw e;
            if (sawInfo) answered = true;
          }
        }
        if (!answered) {
          throw new Error(
            "Device did not answer at " +
              baudRate +
              " baud. On ESP32-S3 pick \"USB JTAG/serial debug unit\" (the same port as Flash), close Serial Monitor, and reflash the SSD1315 receiver."
          );
        }
      } catch (e) {
        await disconnect();
        throw e;
      }
      notify();
    }

    async function disconnect() {
      readAbort = true;
      clearInfoWait();
      clearAckWait();
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
      streamReady = false;
      deviceW = 0;
      deviceH = 0;
      deviceProtoVersion = 0;
      deviceMaxPayload = 0;
      deviceDriverId = 0;
      busy = false;
      pending = null;
      lastFb = null;
      forceFullNext = true;
      framesSinceFull = 0;
      hwConfigChain = Promise.resolve();
      if (watch) {
        clearInterval(watch);
        watch = 0;
      }
      notify();
    }

    async function readLoop() {
      const gen = ++readGen;
      const parse = makeParser({
        onInfo(ver, w, h, extra) {
          onDeviceInfo(ver, w, h, extra);
        },
        onAck(status) {
          onAck(status);
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
      parserReset = function () {
        if (gen === readGen && parse.reset) parse.reset();
      };
      let localReader = null;
      try {
        localReader = port.readable.getReader();
        reader = localReader;
        while (gen === readGen && !readAbort) {
          const { value, done } = await localReader.read();
          if (done || gen !== readGen) break;
          if (value) parse(value);
        }
      } catch (e) {
        if (gen !== readGen) return;
        if (loadReject) finishLoad(e);
        if (!readAbort && opts.onError) opts.onError(e);
      } finally {
        try {
          if (localReader) localReader.releaseLock();
        } catch (e) {}
        if (gen !== readGen) return;
        if (connected && !readAbort) disconnect();
      }
    }

    function makeParser(handlers) {
      let st = 0;
      let hdr = [];
      let type = 0;
      let left = 0;
      let payload = [];
      let xsum = 0;
      function push(chunk) {
        for (let i = 0; i < chunk.length; i++) {
          const b = chunk[i];
          if (st === 0) {
            if (b === MAGIC0) st = 1;
          } else if (st === 1) {
            if (b === MAGIC1) {
              st = 2;
              hdr = [];
            } else if (b === MAGIC0) {
              st = 1;
            } else {
              st = 0;
            }
          } else if (st === 2) {
            hdr.push(b);
            if (hdr.length === 6) {
              type = hdr[0];
              left = hdr[2] | (hdr[3] << 8) | (hdr[4] << 16) | (hdr[5] << 24);
              payload = [];
              xsum = 0;
              if (left > 600) {
                st = 0;
              } else {
                st = left > 0 ? 3 : 4;
              }
            }
          } else if (st === 3) {
            payload.push(b);
            xsum ^= b;
            if (--left === 0) st = 4;
          } else if (st === 4) {
            if (xsum !== b) {
              st = b === MAGIC0 ? 1 : 0;
              continue;
            }
            if (type === T_INFO && payload.length >= 6) {
              const extra = { maxPayload: 0, caps: 0, driverId: payload[1] || 0 };
              if (payload.length >= 10) {
                extra.maxPayload = payload[6] | (payload[7] << 8);
                extra.caps = payload[8];
              }
              handlers.onInfo(
                payload[0],
                payload[2] | (payload[3] << 8),
                payload[4] | (payload[5] << 8),
                extra
              );
            } else if (type === T_ACK) {
              handlers.onAck(payload.length >= 1 ? payload[0] : 0);
            } else if (type === T_LOAD && payload.length >= 1) {
              const flags = payload[0];
              const data = payload.slice(1);
              handlers.onLoad(flags, data);
            }
            st = 0;
          }
        }
      };
      push.reset = function () {
        st = 0;
        hdr = [];
        type = 0;
        left = 0;
        payload = [];
        xsum = 0;
      };
      return push;
    }

    async function recycleSession() {
      if (reopening || !port || !connected) return;
      const now = Date.now();
      if (now - lastRecycle < 3000) return;
      lastRecycle = now;
      reopening = true;
      pumpGeneration++;
      readGen++;
      ackGate = "closed";
      queuedAck = null;
      clearAckWait();
      clearInfoWait();
      streamReady = false;
      const oldWriter = writer;
      const oldReader = reader;
      writer = null;
      reader = null;
      try {
        if (oldWriter) {
          const abortP = oldWriter.abort();
          if (abortP && abortP.catch) abortP.catch(function () {});
          await Promise.race([abortP || Promise.resolve(), sleep(400)]);
        }
        if (oldReader) {
          const cancelP = oldReader.cancel();
          if (cancelP && cancelP.catch) cancelP.catch(function () {});
          await Promise.race([cancelP || Promise.resolve(), sleep(400)]);
        }
        try {
          await port.close();
        } catch (e) {}
        await sleep(400);
        if (!connected || !port) {
          streamReady = false;
          return;
        }
        let opened = false;
        for (let attempt = 0; attempt < 8 && !opened; attempt++) {
          try {
            await port.open({ baudRate });
            opened = true;
          } catch (e) {
            await sleep(300);
          }
        }
        if (!opened) {
          try {
            await disconnect();
          } catch (e) {}
          return;
        }
        writer = port.writable.getWriter();
        sawInfo = false;
        readAbort = false;
        readLoop();
        const deadline = Date.now() + 8000;
        while (!sawInfo && connected && Date.now() < deadline) {
          const infoPromise = waitForInfo(800);
          try {
            await sendPacket(T_HELLO, new Uint8Array(0));
            await infoPromise;
          } catch (e) {
            if (sawInfo) break;
          }
        }
        forceFullNext = true;
        lastFb = null;
        framesSinceFull = 0;
        streamReady = true;
        if (sawInfo && opts.onRestart) restartPending = true;
      } catch (e) {
        streamReady = false;
        writer = null;
      } finally {
        reopening = false;
      }
    }

    async function recoverLink() {
      if (reopening || !connected || !writer) return;
      reopening = true;
      ackGate = "closed";
      queuedAck = null;
      clearAckWait();
      parserReset();
      try {
        await sleep(500);
        for (let i = 0; i < 4 && connected && writer; i++) {
          parserReset();
          clearInfoWait();
          const infoPromise = waitForInfo(700);
          try {
            await sendPacket(T_HELLO, new Uint8Array(0));
            await infoPromise;
            break;
          } catch (e) {
            await sleep(250);
          }
        }
      } catch (e) {
      } finally {
        reopening = false;
        if (connected && writer) streamReady = true;
        forceFullNext = true;
        lastFb = null;
        framesSinceFull = 0;
      }
    }

    async function writePacketBuf(buf) {
      if (!writer) throw new Error("Live writer closed");
      const current = writer;
      let timer = null;
      const writeP = current.write(buf);
      writeP.catch(function () {});
      try {
        await Promise.race([
          writeP,
          new Promise(function (_, reject) {
            timer = setTimeout(function () {
              reject(new Error("USB write stalled"));
            }, 2000);
          }),
        ]);
      } catch (e) {
        if (timer) clearTimeout(timer);
        throw e;
      }
      if (timer) clearTimeout(timer);
    }

    async function sendPacket(type, payload, flags) {
      if (!writer) throw new Error("Live writer closed");
      const len = payload.length;
      const buf = new Uint8Array(8 + len + 1);
      buf[0] = MAGIC0;
      buf[1] = MAGIC1;
      buf[2] = type;
      buf[3] = flags || 0;
      buf[4] = len & 0xff;
      buf[5] = (len >> 8) & 0xff;
      buf[6] = (len >> 16) & 0xff;
      buf[7] = (len >>> 24) & 0xff;
      buf.set(payload, 8);
      let x = 0;
      for (let i = 0; i < len; i++) x ^= payload[i];
      buf[8 + len] = x;
      await writePacketBuf(buf);
    }

    function presentDrainMs(w, h) {
      if (deviceProtoVersion >= 6) return 0;
      const pixels = Math.max(1, (w | 0) * (h | 0));
      const project = opts.getProject ? opts.getProject() : null;
      const S = window.LucarneState;
      const family = S && project && S.deviceFamily ? S.deviceFamily(project) : "";
      if (family === "oled_mono") return Math.min(700, 100 + Math.round(pixels / 20));
      if (family === "matrix") return Math.min(400, 40 + Math.round(pixels / 30));
      return Math.min(900, 50 + Math.round(pixels / 200));
    }

    async function sendSetup(panelW, panelH, rotation) {
      if (!connected) return;
      const payload = new Uint8Array(5);
      payload[0] = panelW & 0xff;
      payload[1] = (panelW >> 8) & 0xff;
      payload[2] = panelH & 0xff;
      payload[3] = (panelH >> 8) & 0xff;
      payload[4] = rotation & 3;
      const infoPromise = waitForInfo(4000);
      await sendPacket(T_SETUP, payload);
      await infoPromise;
    }

    async function syncDeviceInfo() {
      if (!connected) return;
      const infoPromise = waitForInfo(4000);
      await sendPacket(T_PING, new Uint8Array(0));
      try {
        await infoPromise;
      } catch (e) {
        if (deviceW && deviceH) return;
        throw e;
      }
    }

    async function waitPumpIdle(maxMs) {
      const deadline = Date.now() + (maxMs || ACK_MS);
      while (busy && connected && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    async function sendAndWaitAck(type, payload, flags, ms) {
      const ackPromise = waitAck(ms);
      ackPromise.catch(function () {});
      ackGate = "writing";
      try {
        await sendPacket(type, payload, flags);
      } catch (e) {
        ackGate = "closed";
        queuedAck = null;
        const reject = ackReject;
        clearAckWait();
        if (reject) reject(e);
        throw e;
      }
      parserReset();
      const late = queuedAck;
      queuedAck = null;
      ackGate = "open";
      if (late !== null) onAck(late);
      return ackPromise;
    }

    async function sendHwConfigPacketOnce(type, payload) {
      if (!connected) return;
      if (type === T_HWCONFIG && deviceProtoVersion > 0 && deviceProtoVersion < 3) return;
      await waitPumpIdle(ACK_MS);
      if (!connected) return;
      streamReady = false;
      lastFb = null;
      busy = true;
      try {
        let lastErr = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const st = await sendAndWaitAck(type, payload, 0, 3000);
            if (st === 1) throw new Error("Receiver ignored HWCONFIG (flash matching LucarnePreview receiver)");
            return;
          } catch (e) {
            lastErr = e;
            if (!connected) throw e;
            const msg = e && e.message ? e.message : "";
            if (msg.indexOf("ignored") >= 0 || msg.indexOf("begin failed") >= 0) throw e;
          }
        }
        throw lastErr || new Error("Device ACK timeout — frame incomplete");
      } finally {
        busy = false;
        if (connected && writer) streamReady = true;
        if (pending && connected) pump();
      }
    }

    async function sendHwConfigOnce(cfg) {
      const plen = deviceProtoVersion >= 4 || deviceProtoVersion === 0 ? 20 : 19;
      const payload = new Uint8Array(plen);
      payload[0] = cfg.cs & 0xff;
      payload[1] = cfg.dc & 0xff;
      payload[2] = cfg.rst & 0xff;
      payload[3] = cfg.mosi & 0xff;
      payload[4] = cfg.miso & 0xff;
      payload[5] = cfg.sclk & 0xff;
      payload[6] = cfg.bl & 0xff;
      const hz = cfg.spiHz >>> 0;
      payload[7] = hz & 0xff;
      payload[8] = (hz >> 8) & 0xff;
      payload[9] = (hz >> 16) & 0xff;
      payload[10] = (hz >>> 24) & 0xff;
      payload[11] = cfg.spiMode & 0xff;
      payload[12] = cfg.colorOrder === "BGR" ? 1 : 0;
      payload[13] = cfg.invert ? 1 : 0;
      payload[14] = cfg.panelWidth & 0xff;
      payload[15] = (cfg.panelWidth >> 8) & 0xff;
      payload[16] = cfg.panelHeight & 0xff;
      payload[17] = (cfg.panelHeight >> 8) & 0xff;
      payload[18] = cfg.rotation & 3;
      if (plen >= 20) payload[19] = cfg.blActiveLow ? 1 : 0;
      await sendHwConfigPacketOnce(T_HWCONFIG, payload);
    }

    async function sendHwConfigOledOnce(cfg) {
      const payload = new Uint8Array(12);
      payload[0] = cfg.sda & 0xff;
      payload[1] = cfg.scl & 0xff;
      payload[2] = cfg.rst & 0xff;
      payload[3] = cfg.addr & 0xff;
      payload[4] = cfg.panelWidth & 0xff;
      payload[5] = (cfg.panelWidth >> 8) & 0xff;
      payload[6] = cfg.panelHeight & 0xff;
      payload[7] = (cfg.panelHeight >> 8) & 0xff;
      payload[8] = cfg.rotation & 3;
      payload[9] = cfg.invert ? 1 : 0;
      payload[10] = 0;
      payload[11] = 0;
      await sendHwConfigPacketOnce(T_HWCONFIG_OLED, payload);
    }

    async function sendHwConfigMatrixOnce(cfg) {
      const payload = new Uint8Array(21);
      payload[0] = cfg.rs & 0xff;
      payload[1] = cfg.en & 0xff;
      payload[2] = cfg.d4 & 0xff;
      payload[3] = cfg.d5 & 0xff;
      payload[4] = cfg.d6 & 0xff;
      payload[5] = cfg.d7 & 0xff;
      payload[6] = cfg.rw & 0xff;
      payload[7] = cfg.bl & 0xff;
      payload[8] = cfg.cols & 0xff;
      payload[9] = cfg.rows & 0xff;
      payload[10] = cfg.panelWidth & 0xff;
      payload[11] = (cfg.panelWidth >> 8) & 0xff;
      payload[12] = cfg.panelHeight & 0xff;
      payload[13] = (cfg.panelHeight >> 8) & 0xff;
      payload[14] = 0;
      payload[15] = 0;
      payload[16] = 0;
      payload[17] = 0;
      payload[18] = cfg.rotation & 3;
      payload[19] = cfg.blActiveLow ? 1 : 0;
      payload[20] = 0;
      await sendHwConfigPacketOnce(T_HWCONFIG_MATRIX, payload);
    }

    function queueHw(fn) {
      if (!connected) return Promise.resolve();
      hwConfigChain = hwConfigChain.then(fn);
      return hwConfigChain;
    }

    function sendHwConfig(cfg) {
      return queueHw(() => sendHwConfigOnce(cfg));
    }

    function sendHwConfigOled(cfg) {
      return queueHw(() => sendHwConfigOledOnce(cfg));
    }

    function sendHwConfigMatrix(cfg) {
      return queueHw(() => sendHwConfigMatrixOnce(cfg));
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

    function buildRegionPayload(disp, x, y, rw, rh) {
      const fb = disp.fb;
      const stride = disp.width;
      const raw = encodeRawRGB565(fb, stride, x, y, rw, rh);
      const rle = encodeRLERegion(fb, stride, x, y, rw, rh);
      const useRle = rle.length < raw.length;
      const data = useRle ? rle : raw;
      const enc = useRle ? 1 : 0;
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
        const row = py * w;
        let rowHit = false;
        for (let px = 0; px < w; px++) {
          if (last[row + px] !== cur[row + px]) {
            rowHit = true;
            changed++;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
          }
        }
        if (rowHit) {
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
      if (changed === 0) return null;
      const ratio = streamTune.dirtyRatio > 0 ? streamTune.dirtyRatio : 0.3;
      if (changed > w * h * ratio) return { x: 0, y: 0, w, h };
      minX = Math.max(0, minX - 2);
      minY = Math.max(0, minY - 2);
      maxX = Math.min(w - 1, maxX + 2);
      maxY = Math.min(h - 1, maxY + 2);
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

    function splitRegions(disp, x, y, rw, rh) {
      const frames = [];
      const maxPayload = streamTune.maxPayload > 0 ? streamTune.maxPayload : 16384;
      const stripH = streamTune.stripH > 0 ? streamTune.stripH : 32;
      const maxData = Math.max(16, maxPayload - 9);
      const rowBytes = Math.max(2, rw * 2);
      const rowsFit = Math.max(1, Math.floor(maxData / rowBytes));
      const step = Math.min(stripH, rowsFit);
      if (rw * rh * 2 <= maxData) {
        frames.push(buildRegionPayload(disp, x, y, rw, rh));
        return frames;
      }
      for (let sy = 0; sy < rh; sy += step) {
        const sh = Math.min(step, rh - sy);
        frames.push(buildRegionPayload(disp, x, y + sy, rw, sh));
      }
      return frames;
    }

    function buildFrames(disp, opts) {
      opts = opts || {};
      const w = disp.width;
      const h = disp.height;
      const n = w * h;
      const snap = new Uint16Array(disp.fb);
      const needFull =
        opts.forceFull ||
        forceFullNext ||
        !lastFb ||
        lastFb.length !== n ||
        framesSinceFull >= (streamTune.fullEvery > 0 ? streamTune.fullEvery : 12);
      if (needFull) {
        return { frames: splitRegions(disp, 0, 0, w, h), snapshot: snap, full: true };
      }
      const bounds = findDirtyBounds(lastFb, disp.fb, w, h);
      if (!bounds) return { frames: [], snapshot: null, full: false };
      return {
        frames: splitRegions(disp, bounds.x, bounds.y, bounds.w, bounds.h),
        snapshot: snap,
        full: false,
      };
    }

    function sendDisplay(disp) {
      if (!connected || !writer || !disp || !disp.fb) return;
      lastWant = Date.now();
      pending = {
        width: disp.width,
        height: disp.height,
        fb: new Uint16Array(disp.fb),
      };
      armWatch();
      if (!streamReady || reopening) return;
      pump();
    }

    function armWatch() {
      if (watch) return;
      watch = setInterval(function () {
        if (!connected || !writer || reopening) return;
        if (pending && !busy && (!streamReady || Date.now() - lastWant > 1000)) {
          streamReady = true;
          forceFullNext = true;
          lastFb = null;
          pump();
        }
      }, 800);
    }

    function setStreamReady(ready) {
      streamReady = !!ready;
      if (!streamReady) {
        lastFb = null;
        forceFullNext = true;
        framesSinceFull = 0;
      } else {
        applyStreamProfile();
      }
    }

    function requestFullRefresh() {
      forceFullNext = true;
      lastFb = null;
      framesSinceFull = 0;
    }

    async function pump() {
      if (busy || !pending || !connected) return;
      busy = true;
      const disp = pending;
      pending = null;
      const gen = ++pumpGeneration;
      const ackMs = 2500;
      try {
        const built = buildFrames(disp, { forceFull: false });
        if (built.frames.length === 0) return;
        for (let i = 0; i < built.frames.length; i++) {
          if (!connected || gen !== pumpGeneration) throw new Error("Live stream superseded");
          const present = i === built.frames.length - 1 ? 1 : 0;
          await sendAndWaitAck(T_FRAME, built.frames[i], present, ackMs);
        }
        const drain = presentDrainMs(disp.width, disp.height);
        if (drain > 0) await sleep(drain);
        if (built.snapshot) {
          lastFb = built.snapshot;
          if (built.full) {
            framesSinceFull = 0;
            forceFullNext = false;
          } else {
            framesSinceFull++;
          }
        }
      } catch (e) {
        lastFb = null;
        forceFullNext = true;
        framesSinceFull = 0;
        const msg = e && e.message ? e.message : "";
        if (msg.indexOf("ACK timeout") >= 0) {
          try {
            await recoverLink();
          } catch (e2) {}
        } else if (msg.indexOf("stalled") >= 0 || msg.indexOf("writer closed") >= 0) {
          try {
            await recycleSession();
          } catch (e2) {}
        } else if (msg.indexOf("superseded") < 0 && opts.onError) {
          opts.onError(e);
        }
      } finally {
        busy = false;
        if (restartPending && connected && opts.onRestart) {
          restartPending = false;
          opts.onRestart();
        } else if (pending && connected) {
          pump();
        }
      }
    }

    function resetFrame() {
      requestFullRefresh();
    }

    return {
      connect,
      disconnect,
      isConnected,
      deviceDims,
      getProtoVersion,
      getDeviceDriverId: () => deviceDriverId,
      setStreamReady,
      syncDeviceInfo,
      sendSetup,
      sendHwConfig,
      sendHwConfigOled,
      sendHwConfigMatrix,
      sendDisplay,
      loadFromSd,
      resetFrame,
      requestFullRefresh,
      setBaudRate,
      getBaudRate,
    };
  }

  window.LucarneLive = { init };
})();
