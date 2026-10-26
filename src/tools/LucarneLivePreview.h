#ifndef LUCARNE_LIVE_PREVIEW_H
#define LUCARNE_LIVE_PREVIEW_H

#include <Arduino.h>
#include "../core/LucarneGfx.h"
#include "../core/LucarneTypes.h"
#include "../display/LucarneDisplay.h"

#ifndef LUCARNE_LIVE_MAX_FRAME
#define LUCARNE_LIVE_MAX_FRAME 49152
#endif

namespace lucarne {

// Streams a framebuffer from Lucarne Studio over a serial link (USB CDC on
// ESP32-S3) and blits it to the display. The host renders the UI; the device
// only decodes and shows it. Uses the public Display API only, so it does not
// touch the rendering engine. Header-only and opt-in: include it from a sketch.
//
// Packet: 'L' 'P' type(1) flags(1) len(4 LE) payload(len) checksum(1 = XOR of payload).
//   flags bit0: present after this FRAME (batch strips; use with BufferMode::Full).
//   FRAME (0x10), host->device: x(2) y(2) w(2) h(2) enc(1) data...
//     enc 0 = raw RGB565 LE; enc 1 = RLE pairs [count(2 LE)][value(2 LE)].
//   HELLO (0x01)/PING (0x03), host->device: triggers an INFO reply.
//   SETUP (0x04), host->device: panelW(2 LE) panelH(2 LE) rotation(1) — native size, rotation 0..3.
//   LOAD_REQ (0x05), host->device: path UTF-8 (device reads file, e.g. SD, replies with LOAD).
//   LOAD (0x06), device->host: flags(1) data... — flags bit0 last, bit1 error.
//   HWCONFIG (0x07), host->device: cs(1) dc(1) rst(1) mosi(1) miso(1) sclk(1) bl(1) [int8_t, -1=unused]
//     spiHz(4 LE) spiMode(1) colorOrder(1, 0=RGB/1=BGR) invert(1) panelW(2 LE) panelH(2 LE) rotation(1)
//     blActiveLow(1, 0=HIGH on, 1=LOW on). Payload 19 bytes omits blActiveLow (defaults false).
//     Re-runs Display::begin() with these pins/options via the reconfigure handler (see
//     setReconfigureHandler), so a single precompiled binary works with any GPIO wiring —
//     Lucarne Studio's Live wizard sends this right after connecting, using the pins from
//     the project's Hardware tab. Replies ACK once applied (or on failure/no handler).
//   INFO  (0x02), device->host: version(1) driver(1) width(2 LE) height(2 LE) — logical size after rotation.
//   ACK   (0x11), device->host: status(1) — 0 ok, 1 no handler registered, 2 begin() failed.
class LivePreview {
  public:
    typedef void (*LoadHandlerFn)(const char *path, LivePreview *self);
    typedef bool (*ReconfigureFn)(const DisplayPins &pins, const DisplayOptions &options, LivePreview *self);
    typedef bool (*OledReconfigureFn)(const I2cDisplayPins &pins, const DisplayOptions &options, LivePreview *self);
    typedef bool (*MatrixReconfigureFn)(const MatrixDisplayPins &pins, const MatrixDisplayOptions &matrix,
                                        const DisplayOptions &options, LivePreview *self);

    LivePreview(Gfx &display, Stream &io, uint8_t driverId = 0)
        : _d(display), _io(io), _driverId(driverId), _st(S_MAGIC1), _hdrPos(0), _type(0), _pktFlags(0), _len(0),
          _payLeft(0), _cksum(0), _calcCksum(0), _fhPos(0), _enc(0), _x(0), _y(0), _w(0), _h(0), _curCol(0),
          _curRow(0), _pairPos(0), _pixPos(0), _pixLo(0), _frameOk(false), _rawRow(0), _rawCol(0),
          _presentPending(false), _ackAfterPresent(false), _txArmed(false), _lastRxMs(0), _setupPos(0), _loadPos(0),
          _loadHandler(nullptr),
          _hwConfigPos(0),
          _oledConfigPos(0), _matrixConfigPos(0), _reconfigureHandler(nullptr), _oledReconfigureHandler(nullptr),
          _matrixReconfigureHandler(nullptr), _hostBytes(0) {}

    void begin() { sendInfo(); }

    // Called when a HWCONFIG packet is accepted, to re-run Display::begin()
    // with the pins/options Lucarne Studio just sent. Return true on
    // success. Without a handler, HWCONFIG is accepted but ACKed as a no-op
    // (status 1), so sketches keep their compiled-in pins.
    void setReconfigureHandler(ReconfigureFn fn) { _reconfigureHandler = fn; }
    void setOledReconfigureHandler(OledReconfigureFn fn) { _oledReconfigureHandler = fn; }
    void setMatrixReconfigureHandler(MatrixReconfigureFn fn) { _matrixReconfigureHandler = fn; }
    bool hostSeen() const { return _hostBytes != 0; }

    void update() {
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
        if (!_txArmed) {
            _txArmed = true;
            Serial.setTxTimeoutMs(20);
        }
#endif
        if (_st != S_MAGIC1 && _lastRxMs != 0 && (uint32_t)(millis() - _lastRxMs) > 200) {
            _st = S_MAGIC1;
            _presentPending = false;
            _ackAfterPresent = false;
        }
        for (int guard = 0; guard < 4096; guard++) {
            int b = _io.read();
            if (b < 0) break;
            feed((uint8_t)b);
            if (_presentPending) break;
        }
        if (_presentPending) {
            _presentPending = false;
            if (_d.bufferMode() == BufferMode::Full && _d.hasBuffer())
                _d.presentFull();
            else
                _d.presentDirty();
            _d.flushWait();
        }
        if (_ackAfterPresent) {
            _ackAfterPresent = false;
            uint8_t status = 0;
            sendPacket(T_ACK, &status, 1);
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
        S_HWCONFIG,
        S_HWCONFIG_OLED,
        S_HWCONFIG_MATRIX,
        S_SKIP,
        S_CKSUM
    };

    static const uint8_t PROTO_VERSION = 6;
    static const uint8_t T_HELLO = 0x01;
    static const uint8_t T_INFO = 0x02;
    static const uint8_t T_PING = 0x03;
    static const uint8_t T_SETUP = 0x04;
    static const uint8_t T_LOAD_REQ = 0x05;
    static const uint8_t T_LOAD = 0x06;
    static const uint8_t T_HWCONFIG = 0x07;
    static const uint8_t T_HWCONFIG_OLED = 0x08;
    static const uint8_t T_HWCONFIG_MATRIX = 0x09;
    static const uint8_t T_FRAME = 0x10;
    static const uint8_t T_ACK = 0x11;
    static const int16_t RAW_LINE_MAX = 480;

    uint16_t _rawLine[RAW_LINE_MAX];
    int16_t _rawRow;
    int16_t _rawCol;
    bool _presentPending;
    bool _ackAfterPresent;
    bool _txArmed;
    uint32_t _lastRxMs;

    void feed(uint8_t b) {
        _hostBytes++;
        _lastRxMs = millis();
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
                    _pktFlags = _hdr[1];
                    _len = (uint32_t)_hdr[2] | ((uint32_t)_hdr[3] << 8) |
                           ((uint32_t)_hdr[4] << 16) | ((uint32_t)_hdr[5] << 24);
                    if (_len > (uint32_t)LUCARNE_LIVE_MAX_FRAME) {
                        _st = (b == 'L') ? S_MAGIC2 : S_MAGIC1;
                        break;
                    }
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
            case S_HWCONFIG:
                hwConfigByte(b);
                break;
            case S_HWCONFIG_OLED:
                oledConfigByte(b);
                break;
            case S_HWCONFIG_MATRIX:
                matrixConfigByte(b);
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
        } else if (_type == T_HWCONFIG) {
            _hwConfigPos = 0;
            _st = S_HWCONFIG;
        } else if (_type == T_HWCONFIG_OLED) {
            _oledConfigPos = 0;
            _st = S_HWCONFIG_OLED;
        } else if (_type == T_HWCONFIG_MATRIX) {
            _matrixConfigPos = 0;
            _st = S_HWCONFIG_MATRIX;
        } else {
            _st = S_SKIP;
        }
    }

    void setupByte(uint8_t b) {
        _calcCksum ^= b;
        if (_setupPos < sizeof(_setupPl)) _setupPl[_setupPos++] = b;
        if (--_payLeft == 0) _st = S_CKSUM;
    }

    void hwConfigByte(uint8_t b) {
        _calcCksum ^= b;
        if (_hwConfigPos < sizeof(_hwConfigPl)) _hwConfigPl[_hwConfigPos++] = b;
        if (--_payLeft == 0) _st = S_CKSUM;
    }

    void oledConfigByte(uint8_t b) {
        _calcCksum ^= b;
        if (_oledConfigPos < sizeof(_oledConfigPl)) _oledConfigPl[_oledConfigPos++] = b;
        if (--_payLeft == 0) _st = S_CKSUM;
    }

    void matrixConfigByte(uint8_t b) {
        _calcCksum ^= b;
        if (_matrixConfigPos < sizeof(_matrixConfigPl)) _matrixConfigPl[_matrixConfigPos++] = b;
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
            _rawRow = 0;
            _rawCol = 0;
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

    void commitRawLine(int16_t count) {
        if (count <= 0 || count > _w || count > RAW_LINE_MAX)
            return;
        _d.writeRowRgb565Le(_x, (int16_t)(_y + _rawRow), count, _rawLine);
        _rawCol = 0;
        _rawRow++;
    }

    void frameRawByte(uint8_t b) {
        _calcCksum ^= b;
        _payLeft--;
        if ((_pixPos & 1) == 0) {
            _pixLo = b;
        } else {
            uint16_t color = (uint16_t)(_pixLo | (b << 8));
            if (_w > 0 && _w <= RAW_LINE_MAX && _rawCol < _w) {
                _rawLine[_rawCol++] = color;
                if (_rawCol >= _w)
                    commitRawLine(_w);
            } else {
                emitRun(1, color);
            }
        }
        _pixPos++;
        if (_payLeft == 0)
            _st = S_CKSUM;
    }

    void flushRawLine() {
        if (_rawCol > 0 && _rawCol <= _w && _w <= RAW_LINE_MAX)
            commitRawLine(_rawCol);
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
            (void)pw;
            (void)ph;
            (void)rot;
            sendInfo();
        } else if (_type == T_LOAD_REQ) {
            _loadPl[_loadPos] = 0;
            if (_loadHandler) {
                _loadHandler((const char *)_loadPl, this);
            } else {
                sendLoadChunk(nullptr, 0, 2);
            }
        } else if (_type == T_HWCONFIG && _hwConfigPos >= 19) {
            DisplayPins pins;
            pins.cs = (int8_t)_hwConfigPl[0];
            pins.dc = (int8_t)_hwConfigPl[1];
            pins.rst = (int8_t)_hwConfigPl[2];
            pins.mosi = (int8_t)_hwConfigPl[3];
            pins.miso = (int8_t)_hwConfigPl[4];
            pins.sclk = (int8_t)_hwConfigPl[5];
            pins.bl = (int8_t)_hwConfigPl[6];
            DisplayOptions options;
            options.spiHz = (uint32_t)_hwConfigPl[7] | ((uint32_t)_hwConfigPl[8] << 8) |
                            ((uint32_t)_hwConfigPl[9] << 16) | ((uint32_t)_hwConfigPl[10] << 24);
            options.spiMode = _hwConfigPl[11];
            options.colorOrder = _hwConfigPl[12] ? ColorOrder::BGR : ColorOrder::RGB;
            options.invert = _hwConfigPl[13] != 0;
            options.panelWidth = (int16_t)(_hwConfigPl[14] | (_hwConfigPl[15] << 8));
            options.panelHeight = (int16_t)(_hwConfigPl[16] | (_hwConfigPl[17] << 8));
            options.rotation = (uint8_t)(_hwConfigPl[18] & 3);
            options.blActiveLow = _hwConfigPos >= 20 && _hwConfigPl[19] != 0;
            uint8_t status = 1;
            if (_reconfigureHandler) {
                status = _reconfigureHandler(pins, options, this) ? 0 : 2;
            }
            sendPacket(T_ACK, &status, 1);
            if (status == 0)
                sendInfo();
        } else if (_type == T_HWCONFIG_OLED && _oledConfigPos >= 12) {
            I2cDisplayPins pins;
            pins.sda = (int8_t)_oledConfigPl[0];
            pins.scl = (int8_t)_oledConfigPl[1];
            pins.rst = (int8_t)_oledConfigPl[2];
            pins.addr = _oledConfigPl[3];
            DisplayOptions options;
            options.panelWidth = (int16_t)rd16(_oledConfigPl, 4);
            options.panelHeight = (int16_t)rd16(_oledConfigPl, 6);
            options.rotation = (uint8_t)(_oledConfigPl[8] & 3);
            options.invert = _oledConfigPl[9] != 0;
            uint8_t status = 1;
            if (_oledReconfigureHandler)
                status = _oledReconfigureHandler(pins, options, this) ? 0 : 2;
            sendPacket(T_ACK, &status, 1);
            if (status == 0)
                sendInfo();
        } else if (_type == T_HWCONFIG_MATRIX && _matrixConfigPos >= 21) {
            MatrixDisplayPins pins;
            pins.rs = (int8_t)_matrixConfigPl[0];
            pins.en = (int8_t)_matrixConfigPl[1];
            pins.d4 = (int8_t)_matrixConfigPl[2];
            pins.d5 = (int8_t)_matrixConfigPl[3];
            pins.d6 = (int8_t)_matrixConfigPl[4];
            pins.d7 = (int8_t)_matrixConfigPl[5];
            pins.rw = (int8_t)_matrixConfigPl[6];
            pins.bl = (int8_t)_matrixConfigPl[7];
            MatrixDisplayOptions matrix;
            matrix.cols = _matrixConfigPl[8];
            matrix.rows = _matrixConfigPl[9];
            DisplayOptions options;
            options.panelWidth = (int16_t)rd16(_matrixConfigPl, 10);
            options.panelHeight = (int16_t)rd16(_matrixConfigPl, 12);
            options.rotation = (uint8_t)(_matrixConfigPl[18] & 3);
            options.blActiveLow = _matrixConfigPl[19] != 0;
            uint8_t status = 1;
            if (_matrixReconfigureHandler)
                status = _matrixReconfigureHandler(pins, matrix, options, this) ? 0 : 2;
            sendPacket(T_ACK, &status, 1);
            if (status == 0)
                sendInfo();
        } else if (_type == T_FRAME && _frameOk) {
            if (_enc == 0)
                flushRawLine();
            if (_pktFlags & 1) {
                _presentPending = true;
                _ackAfterPresent = true;
            } else {
                uint8_t status = 0;
                sendPacket(T_ACK, &status, 1);
            }
        }
    }

    void sendInfo() {
        uint8_t pl[10];
        pl[0] = PROTO_VERSION;
        pl[1] = _driverId;
        wr16(pl, 2, (uint16_t)_d.width());
        wr16(pl, 4, (uint16_t)_d.height());
        uint16_t maxPay = (uint16_t)LUCARNE_LIVE_MAX_FRAME;
        wr16(pl, 6, maxPay);
        uint8_t caps = 0;
        if (_d.bufferMode() == BufferMode::Full && _d.hasBuffer())
            caps |= 1;
        caps |= 2;
        pl[8] = caps;
        pl[9] = 0;
        sendPacket(T_INFO, pl, 10);
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

    Gfx &_d;
    Stream &_io;
    uint8_t _driverId;
    State _st;
    uint8_t _hdr[6];
    uint8_t _hdrPos;
    uint8_t _type;
    uint8_t _pktFlags;
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
    uint8_t _hwConfigPl[20];
    uint8_t _hwConfigPos;
    uint8_t _oledConfigPl[12];
    uint8_t _oledConfigPos;
    uint8_t _matrixConfigPl[21];
    uint8_t _matrixConfigPos;
    ReconfigureFn _reconfigureHandler;
    OledReconfigureFn _oledReconfigureHandler;
    MatrixReconfigureFn _matrixReconfigureHandler;
    uint32_t _hostBytes;
};

}

#endif
