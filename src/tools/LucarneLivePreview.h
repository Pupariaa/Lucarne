#ifndef LUCARNE_LIVE_PREVIEW_H
#define LUCARNE_LIVE_PREVIEW_H

#include <Arduino.h>
#include "../display/LucarneDisplay.h"

namespace lucarne {

// Streams a framebuffer from Lucarne Studio over a serial link (USB CDC on
// ESP32-S3) and blits it to the display. The host renders the UI; the device
// only decodes and shows it. Uses the public Display API only, so it does not
// touch the rendering engine. Header-only and opt-in: include it from a sketch.
//
// Packet: 'L' 'P' type(1) flags(1) len(4 LE) payload(len) checksum(1 = XOR of payload).
//   FRAME (0x10), host->device: x(2) y(2) w(2) h(2) enc(1) data...
//     enc 0 = raw RGB565 LE; enc 1 = RLE pairs [count(2 LE)][value(2 LE)].
//   HELLO (0x01)/PING (0x03), host->device: triggers an INFO reply.
//   SETUP (0x04), host->device: panelW(2 LE) panelH(2 LE) rotation(1) — native size, rotation 0..3.
//   LOAD_REQ (0x05), host->device: path UTF-8 (device reads file, e.g. SD, replies with LOAD).
//   LOAD (0x06), device->host: flags(1) data... — flags bit0 last, bit1 error.
//   INFO  (0x02), device->host: version(1) driver(1) width(2 LE) height(2 LE) — logical size after rotation.
//   ACK   (0x11), device->host: status(1).
class LivePreview {
  public:
    typedef void (*LoadHandlerFn)(const char *path, LivePreview *self);

    LivePreview(Display &display, Stream &io)
        : _d(display), _io(io), _st(S_MAGIC1), _hdrPos(0), _type(0), _len(0), _payLeft(0),
          _cksum(0), _calcCksum(0), _fhPos(0), _enc(0), _x(0), _y(0), _w(0), _h(0),
          _curCol(0), _curRow(0), _pairPos(0), _pixPos(0), _pixLo(0), _frameOk(false),
          _setupPos(0), _loadPos(0), _loadHandler(nullptr) {}

    void begin() { sendInfo(); }

    void update() {
        while (_io.available() > 0) {
            feed((uint8_t)_io.read());
        }
    }

    void setLoadHandler(LoadHandlerFn fn) { _loadHandler = fn; }

    void sendLoadChunk(const uint8_t *data, uint32_t len, uint8_t flags) {
        uint8_t pl[513];
        pl[0] = flags;
        uint32_t n = len;
        if (n > 512) n = 512;
        if (n && data) memcpy(pl + 1, data, n);
        sendPacket(T_LOAD, pl, 1 + n);
    }

  private:
    enum State : uint8_t {
        S_MAGIC1,
        S_MAGIC2,
        S_HDR,
        S_FRAME_HDR,
        S_FRAME_RLE,
        S_FRAME_RAW,
        S_SETUP,
        S_LOAD_PATH,
        S_SKIP,
        S_CKSUM
    };

    static const uint8_t PROTO_VERSION = 2;
    static const uint8_t T_HELLO = 0x01;
    static const uint8_t T_INFO = 0x02;
    static const uint8_t T_PING = 0x03;
    static const uint8_t T_SETUP = 0x04;
    static const uint8_t T_LOAD_REQ = 0x05;
    static const uint8_t T_LOAD = 0x06;
    static const uint8_t T_FRAME = 0x10;
    static const uint8_t T_ACK = 0x11;

    void feed(uint8_t b) {
        switch (_st) {
            case S_MAGIC1:
                if (b == 'L') _st = S_MAGIC2;
                break;
            case S_MAGIC2:
                if (b == 'P') {
                    _st = S_HDR;
                    _hdrPos = 0;
                } else if (b != 'L') {
                    _st = S_MAGIC1;
                }
                break;
            case S_HDR:
                _hdr[_hdrPos++] = b;
                if (_hdrPos == 6) {
                    _type = _hdr[0];
                    _len = (uint32_t)_hdr[2] | ((uint32_t)_hdr[3] << 8) |
                           ((uint32_t)_hdr[4] << 16) | ((uint32_t)_hdr[5] << 24);
                    _payLeft = _len;
                    _calcCksum = 0;
                    beginPayload();
                }
                break;
            case S_FRAME_HDR:
                frameHdrByte(b);
                break;
            case S_FRAME_RLE:
                frameRleByte(b);
                break;
            case S_FRAME_RAW:
                frameRawByte(b);
                break;
            case S_SETUP:
                setupByte(b);
                break;
            case S_LOAD_PATH:
                loadPathByte(b);
                break;
            case S_SKIP:
                _calcCksum ^= b;
                if (--_payLeft == 0) _st = S_CKSUM;
                break;
            case S_CKSUM:
                _cksum = b;
                onComplete();
                _st = S_MAGIC1;
                break;
        }
    }

    void beginPayload() {
        if (_payLeft == 0) {
            _st = S_CKSUM;
            return;
        }
        if (_type == T_FRAME) {
            _fhPos = 0;
            _frameOk = false;
            _st = S_FRAME_HDR;
        } else if (_type == T_SETUP) {
            _setupPos = 0;
            _st = S_SETUP;
        } else if (_type == T_LOAD_REQ) {
            _loadPos = 0;
            _st = S_LOAD_PATH;
        } else {
            _st = S_SKIP;
        }
    }

    void setupByte(uint8_t b) {
        _calcCksum ^= b;
        if (_setupPos < sizeof(_setupPl)) _setupPl[_setupPos++] = b;
        if (--_payLeft == 0) _st = S_CKSUM;
    }

    void loadPathByte(uint8_t b) {
        _calcCksum ^= b;
        if (_loadPos < sizeof(_loadPl) - 1) _loadPl[_loadPos++] = b;
        if (--_payLeft == 0) _st = S_CKSUM;
    }

    void frameHdrByte(uint8_t b) {
        _calcCksum ^= b;
        _fh[_fhPos++] = b;
        _payLeft--;
        if (_fhPos == 9) {
            _x = (int16_t)rd16(_fh, 0);
            _y = (int16_t)rd16(_fh, 2);
            _w = (int16_t)rd16(_fh, 4);
            _h = (int16_t)rd16(_fh, 6);
            _enc = _fh[8];
            _curCol = 0;
            _curRow = 0;
            _pairPos = 0;
            _pixPos = 0;
            _frameOk = true;
            if (_payLeft == 0) {
                _st = S_CKSUM;
            } else {
                _st = (_enc == 1) ? S_FRAME_RLE : S_FRAME_RAW;
            }
            return;
        }
        if (_payLeft == 0) _st = S_CKSUM;
    }

    void frameRleByte(uint8_t b) {
        _calcCksum ^= b;
        _pair[_pairPos++] = b;
        _payLeft--;
        if (_pairPos == 4) {
            _pairPos = 0;
            uint16_t count = (uint16_t)(_pair[0] | (_pair[1] << 8));
            uint16_t value = (uint16_t)(_pair[2] | (_pair[3] << 8));
            emitRun(count, value);
        }
        if (_payLeft == 0) _st = S_CKSUM;
    }

    void frameRawByte(uint8_t b) {
        _calcCksum ^= b;
        _payLeft--;
        if ((_pixPos & 1) == 0) {
            _pixLo = b;
        } else {
            emitRun(1, (uint16_t)(_pixLo | (b << 8)));
        }
        _pixPos++;
        if (_payLeft == 0) _st = S_CKSUM;
    }

    void emitRun(uint16_t count, uint16_t value) {
        while (count > 0 && _curRow < _h) {
            int16_t spanW = (int16_t)(_w - _curCol);
            if (spanW > (int16_t)count) spanW = (int16_t)count;
            if (spanW <= 0) break;
            _d.fillRect((int16_t)(_x + _curCol), (int16_t)(_y + _curRow), spanW, 1, value);
            _curCol = (int16_t)(_curCol + spanW);
            count = (uint16_t)(count - spanW);
            if (_curCol >= _w) {
                _curCol = 0;
                _curRow++;
            }
        }
    }

    void onComplete() {
        if (_calcCksum != _cksum) return;
        if (_type == T_HELLO || _type == T_PING) {
            sendInfo();
        } else if (_type == T_SETUP && _setupPos >= 5) {
            int16_t pw = (int16_t)rd16(_setupPl, 0);
            int16_t ph = (int16_t)rd16(_setupPl, 2);
            uint8_t rot = (uint8_t)(_setupPl[4] & 3);
            if (pw > 0 && ph > 0) {
                _d.applyPanelConfig(pw, ph, rot);
            }
            sendInfo();
        } else if (_type == T_LOAD_REQ) {
            _loadPl[_loadPos] = 0;
            if (_loadHandler) {
                _loadHandler((const char *)_loadPl, this);
            } else {
                sendLoadChunk(nullptr, 0, 2);
            }
        } else if (_type == T_FRAME && _frameOk) {
            _d.display();
            uint8_t status = 0;
            sendPacket(T_ACK, &status, 1);
        }
    }

    void sendInfo() {
        uint8_t pl[6];
        pl[0] = PROTO_VERSION;
        pl[1] = 0;
        wr16(pl, 2, (uint16_t)_d.width());
        wr16(pl, 4, (uint16_t)_d.height());
        sendPacket(T_INFO, pl, 6);
    }

    void sendPacket(uint8_t type, const uint8_t *payload, uint32_t len) {
        uint8_t head[8];
        head[0] = 'L';
        head[1] = 'P';
        head[2] = type;
        head[3] = 0;
        head[4] = (uint8_t)(len & 0xff);
        head[5] = (uint8_t)((len >> 8) & 0xff);
        head[6] = (uint8_t)((len >> 16) & 0xff);
        head[7] = (uint8_t)((len >> 24) & 0xff);
        _io.write(head, 8);
        uint8_t x = 0;
        for (uint32_t i = 0; i < len; i++) x ^= payload[i];
        if (len) _io.write(payload, len);
        _io.write(&x, 1);
    }

    static uint16_t rd16(const uint8_t *p, int o) {
        return (uint16_t)(p[o] | (p[o + 1] << 8));
    }
    static void wr16(uint8_t *p, int o, uint16_t v) {
        p[o] = (uint8_t)(v & 0xff);
        p[o + 1] = (uint8_t)((v >> 8) & 0xff);
    }

    Display &_d;
    Stream &_io;
    State _st;
    uint8_t _hdr[6];
    uint8_t _hdrPos;
    uint8_t _type;
    uint32_t _len;
    uint32_t _payLeft;
    uint8_t _cksum;
    uint8_t _calcCksum;
    uint8_t _fh[9];
    uint8_t _fhPos;
    uint8_t _enc;
    int16_t _x;
    int16_t _y;
    int16_t _w;
    int16_t _h;
    int16_t _curCol;
    int16_t _curRow;
    uint8_t _pair[4];
    uint8_t _pairPos;
    uint32_t _pixPos;
    uint8_t _pixLo;
    bool _frameOk;
    uint8_t _setupPl[8];
    uint8_t _setupPos;
    uint8_t _loadPl[256];
    uint8_t _loadPos;
    LoadHandlerFn _loadHandler;
};

}

#endif
