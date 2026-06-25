#include "LucarneDisplay.h"
#include "LucarneST77xx.h"
#include <stdlib.h>
#include <string.h>

#if defined(ESP32)
#include "esp_heap_caps.h"
#endif

namespace lucarne {

static inline uint16_t be16(uint16_t c) {
    return (uint16_t)((c << 8) | (c >> 8));
}

Display::Display()
    : Gfx(0, 0), _spi(nullptr), _spiSettings(27000000, MSBFIRST, SPI_MODE0),
      _bufMode(BufferMode::Full), _bufMem(BufferMemory::Auto), _bufMaxBytes(0),
      _buffer(nullptr), _lineBuf(nullptr), _bufferDmaSafe(true), _panelW(0), _panelH(0), _colStart(0), _rowStart(0),
      _colStart2(0), _rowStart2(0), _xstart(0), _ystart(0), _madctl(0),
      _dx0(0), _dy0(0), _dx1(0), _dy1(0), _dirty(false), _txDepth(0) {}

Display::~Display() {
    freeBuffer();
}

bool Display::begin(const DisplayPins &pins, const DisplayOptions &options,
                    const BufferOptions &buffer, SPIClass *spi) {
    _spi = spi;
    _pins = pins;
    _opt = options;
    _bufMode = buffer.mode;
    _bufMem = buffer.memory;
    _bufMaxBytes = buffer.maxBytes;
    _buffer = nullptr;
    _txDepth = 0;
    _dirty = false;
    uint8_t spiMode = SPI_MODE0;
    switch (options.spiMode) {
        case 1:
            spiMode = SPI_MODE1;
            break;
        case 2:
            spiMode = SPI_MODE2;
            break;
        case 3:
            spiMode = SPI_MODE3;
            break;
        default:
            spiMode = SPI_MODE0;
            break;
    }
    _spiSettings = SPISettings(options.spiHz, MSBFIRST, spiMode);

    _panelW = options.panelWidth;
    _panelH = options.panelHeight;

    if (_pins.cs >= 0) {
        pinMode(_pins.cs, OUTPUT);
        digitalWrite(_pins.cs, HIGH);
    }
    if (_pins.dc >= 0) {
        pinMode(_pins.dc, OUTPUT);
        digitalWrite(_pins.dc, HIGH);
    }
    if (_pins.rst >= 0) {
        pinMode(_pins.rst, OUTPUT);
        digitalWrite(_pins.rst, HIGH);
    }
    if (_pins.bl >= 0) {
        pinMode(_pins.bl, OUTPUT);
    }
    backlight(false);

#if defined(ESP32)
    _spi->begin(_pins.sclk, -1, _pins.mosi, -1);
#else
    _spi->begin();
#endif

    hardwareReset();

    setupOffsets();
    if (options.colStart >= 0) _colStart = options.colStart;
    if (options.rowStart >= 0) _rowStart = options.rowStart;
    if (options.colStart2 >= 0) _colStart2 = options.colStart2;
    if (options.rowStart2 >= 0) _rowStart2 = options.rowStart2;

    _spi->beginTransaction(_spiSettings);
    if (_pins.cs >= 0) digitalWrite(_pins.cs, LOW);
    initPanel();
    if (_pins.cs >= 0) digitalWrite(_pins.cs, HIGH);
    _spi->endTransaction();

    setRotation(options.rotation);
    invertDisplay(options.invert);

    if (_bufMode == BufferMode::Full) {
        if (!allocBuffer()) {
            _bufMode = BufferMode::None;
            if (_opt.debug) {
                Serial.println("Lucarne: framebuffer unavailable, falling back to direct mode");
            }
        }
    }

    fillScreen(Color::Black);
    display();
    backlight(true);

    if (_opt.debug) {
        Serial.print("Lucarne: ");
        Serial.print(_width);
        Serial.print("x");
        Serial.print(_height);
        Serial.print(" bufMode=");
        Serial.print(_bufMode == BufferMode::Full ? "full" : "none");
        Serial.print(" dmaSafe=");
        Serial.print(_bufferDmaSafe ? 1 : 0);
        Serial.print(" madctl=0x");
        Serial.print(_madctl, HEX);
        Serial.print(" xstart=");
        Serial.print(_xstart);
        Serial.print(" ystart=");
        Serial.println(_ystart);
    }
    return true;
}

void Display::hardwareReset() {
    if (_pins.rst < 0) return;
    digitalWrite(_pins.rst, HIGH);
    delay(20);
    digitalWrite(_pins.rst, LOW);
    delay(20);
    digitalWrite(_pins.rst, HIGH);
    delay(150);
}

void Display::writeCommand(uint8_t cmd) {
    if (_pins.dc >= 0) digitalWrite(_pins.dc, LOW);
    _spi->transfer(cmd);
}

void Display::writeData(uint8_t data) {
    if (_pins.dc >= 0) digitalWrite(_pins.dc, HIGH);
    _spi->transfer(data);
}

void Display::writeData16(uint16_t data) {
    if (_pins.dc >= 0) digitalWrite(_pins.dc, HIGH);
    _spi->transfer((uint8_t)(data >> 8));
    _spi->transfer((uint8_t)(data & 0xFF));
}

void Display::sendCommand(uint8_t cmd, const uint8_t *data, uint8_t len) {
    writeCommand(cmd);
    for (uint8_t i = 0; i < len; i++) {
        writeData(data[i]);
    }
}

void Display::setAddrWindow(int16_t x, int16_t y, int16_t w, int16_t h) {
    uint16_t x0 = (uint16_t)(x + _xstart);
    uint16_t x1 = (uint16_t)(x + w - 1 + _xstart);
    uint16_t y0 = (uint16_t)(y + _ystart);
    uint16_t y1 = (uint16_t)(y + h - 1 + _ystart);
    writeCommand(ST77XX_CASET);
    writeData16(x0);
    writeData16(x1);
    writeCommand(ST77XX_RASET);
    writeData16(y0);
    writeData16(y1);
    writeCommand(ST77XX_RAMWR);
}

void Display::setRotation(uint8_t r) {
    computeRotation((uint8_t)(r & 3));
    _opt.rotation = (uint8_t)(r & 3);
    _spi->beginTransaction(_spiSettings);
    if (_pins.cs >= 0) digitalWrite(_pins.cs, LOW);
    writeCommand(ST77XX_MADCTL);
    writeData(_madctl);
    if (_pins.cs >= 0) digitalWrite(_pins.cs, HIGH);
    _spi->endTransaction();
}

void Display::applyPanelConfig(int16_t panelW, int16_t panelH, uint8_t rotation) {
    _panelW = panelW;
    _panelH = panelH;
    setupOffsets();
    if (_opt.colStart >= 0) _colStart = _opt.colStart;
    if (_opt.rowStart >= 0) _rowStart = _opt.rowStart;
    if (_opt.colStart2 >= 0) _colStart2 = _opt.colStart2;
    if (_opt.rowStart2 >= 0) _rowStart2 = _opt.rowStart2;
    setRotation(rotation);
    fillScreen(0);
    if (_bufMode == BufferMode::Full && _buffer) {
        _dirty = true;
        display();
    }
}

void Display::invertDisplay(bool invert) {
    _spi->beginTransaction(_spiSettings);
    if (_pins.cs >= 0) digitalWrite(_pins.cs, LOW);
    writeCommand(invert ? ST77XX_INVON : ST77XX_INVOFF);
    if (_pins.cs >= 0) digitalWrite(_pins.cs, HIGH);
    _spi->endTransaction();
}

void Display::backlight(bool on) {
    if (_pins.bl < 0) return;
    bool level = on ^ _opt.blActiveLow;
    digitalWrite(_pins.bl, level ? HIGH : LOW);
}

void Display::startWrite() {
    if (_bufMode == BufferMode::Full) return;
    if (_txDepth++ == 0) {
        _spi->beginTransaction(_spiSettings);
        if (_pins.cs >= 0) digitalWrite(_pins.cs, LOW);
    }
}

void Display::endWrite() {
    if (_bufMode == BufferMode::Full) return;
    if (_txDepth > 0 && --_txDepth == 0) {
        if (_pins.cs >= 0) digitalWrite(_pins.cs, HIGH);
        _spi->endTransaction();
    }
}

void Display::writePixel(int16_t x, int16_t y, uint16_t color) {
    if (x < 0 || y < 0 || x >= _width || y >= _height) return;
    if (_bufMode == BufferMode::Full && _buffer) {
        _buffer[(int32_t)y * _width + x] = be16(color);
        markDirty(x, y, 1, 1);
        return;
    }
    setAddrWindow(x, y, 1, 1);
    writeData16(color);
}

void Display::writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (x < 0) {
        w += x;
        x = 0;
    }
    if (y < 0) {
        h += y;
        y = 0;
    }
    if (x + w > _width) w = (int16_t)(_width - x);
    if (y + h > _height) h = (int16_t)(_height - y);
    if (w <= 0 || h <= 0) return;

    if (_bufMode == BufferMode::Full && _buffer) {
        uint16_t v = be16(color);
        for (int16_t row = 0; row < h; row++) {
            uint16_t *p = &_buffer[(int32_t)(y + row) * _width + x];
            for (int16_t col = 0; col < w; col++) {
                p[col] = v;
            }
        }
        markDirty(x, y, w, h);
        return;
    }

    setAddrWindow(x, y, w, h);
    if (_pins.dc >= 0) digitalWrite(_pins.dc, HIGH);
    uint8_t hi = (uint8_t)(color >> 8);
    uint8_t lo = (uint8_t)(color & 0xFF);
    uint32_t n = (uint32_t)w * (uint32_t)h;
    while (n--) {
        _spi->transfer(hi);
        _spi->transfer(lo);
    }
}

void Display::writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
    writeFillRect(x, y, w, 1, color);
}

void Display::writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
    writeFillRect(x, y, 1, h, color);
}

void Display::markDirty(int16_t x, int16_t y, int16_t w, int16_t h) {
    int16_t x2 = (int16_t)(x + w - 1);
    int16_t y2 = (int16_t)(y + h - 1);
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x2 > _width - 1) x2 = (int16_t)(_width - 1);
    if (y2 > _height - 1) y2 = (int16_t)(_height - 1);
    if (x2 < x || y2 < y) return;
    if (!_dirty) {
        _dx0 = x;
        _dy0 = y;
        _dx1 = x2;
        _dy1 = y2;
        _dirty = true;
    } else {
        if (x < _dx0) _dx0 = x;
        if (y < _dy0) _dy0 = y;
        if (x2 > _dx1) _dx1 = x2;
        if (y2 > _dy1) _dy1 = y2;
    }
}

void Display::flushRegion(int16_t x, int16_t y, int16_t w, int16_t h) {
    if (!_buffer) return;
    if (x < 0) {
        w += x;
        x = 0;
    }
    if (y < 0) {
        h += y;
        y = 0;
    }
    if (x + w > _width) w = (int16_t)(_width - x);
    if (y + h > _height) h = (int16_t)(_height - y);
    if (w <= 0 || h <= 0) return;

    _spi->beginTransaction(_spiSettings);
    if (_pins.cs >= 0) digitalWrite(_pins.cs, LOW);
    setAddrWindow(x, y, w, h);
    if (_pins.dc >= 0) digitalWrite(_pins.dc, HIGH);
    size_t rowBytes = (size_t)w * 2;
    for (int16_t row = 0; row < h; row++) {
        uint16_t *src = &_buffer[(int32_t)(y + row) * _width + x];
        if (_bufferDmaSafe) {
            _spi->writeBytes((uint8_t *)src, rowBytes);
        } else {
            memcpy(_lineBuf, src, rowBytes);
            _spi->writeBytes((uint8_t *)_lineBuf, rowBytes);
        }
    }
    if (_pins.cs >= 0) digitalWrite(_pins.cs, HIGH);
    _spi->endTransaction();
}

void Display::display() {
    if (_bufMode != BufferMode::Full || !_buffer || !_dirty) return;
    flushRegion(_dx0, _dy0, (int16_t)(_dx1 - _dx0 + 1), (int16_t)(_dy1 - _dy0 + 1));
    _dirty = false;
}

void Display::display(int16_t x, int16_t y, int16_t w, int16_t h) {
    if (_bufMode != BufferMode::Full || !_buffer) return;
    flushRegion(x, y, w, h);
}

bool Display::allocBuffer() {
    size_t count = (size_t)_panelW * (size_t)_panelH;
    size_t bytes = count * 2;
    if (bytes == 0) return false;
    if (_bufMaxBytes && bytes > _bufMaxBytes) return false;

#if defined(ESP32)
    _bufferDmaSafe = true;
    if (_bufMem == BufferMemory::PSRAM || _bufMem == BufferMemory::Auto) {
        _buffer = (uint16_t *)heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM);
        if (_buffer) _bufferDmaSafe = false;
    }
    if (!_buffer) {
        _buffer = (uint16_t *)heap_caps_malloc(bytes, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
        _bufferDmaSafe = true;
    }
    if (!_buffer) {
        _buffer = (uint16_t *)malloc(bytes);
        _bufferDmaSafe = true;
    }
    if (!_buffer && _opt.debug) {
        Serial.print("Lucarne: alloc failed, need ");
        Serial.print((uint32_t)bytes);
        Serial.print(" bytes, free internal ");
        Serial.print((uint32_t)heap_caps_get_free_size(MALLOC_CAP_INTERNAL));
        Serial.print(", largest internal block ");
        Serial.println((uint32_t)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
    }
#else
    _buffer = (uint16_t *)malloc(bytes);
    _bufferDmaSafe = true;
#endif
    if (!_buffer) return false;
    memset(_buffer, 0, bytes);

    if (!_bufferDmaSafe) {
        int16_t maxDim = (_panelW > _panelH) ? _panelW : _panelH;
        size_t lineBytes = (size_t)maxDim * 2;
#if defined(ESP32)
        _lineBuf = (uint16_t *)heap_caps_malloc(lineBytes, MALLOC_CAP_DMA);
        if (!_lineBuf) {
            _lineBuf = (uint16_t *)heap_caps_malloc(lineBytes, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
        }
#else
        _lineBuf = (uint16_t *)malloc(lineBytes);
#endif
        if (!_lineBuf) {
            free(_buffer);
            _buffer = nullptr;
            return false;
        }
    }
    return true;
}

void Display::freeBuffer() {
    if (_buffer) {
        free(_buffer);
        _buffer = nullptr;
    }
    if (_lineBuf) {
        free(_lineBuf);
        _lineBuf = nullptr;
    }
}

uint16_t *Display::allocFrame() {
    size_t bytes = (size_t)_width * (size_t)_height * 2;
    if (bytes == 0) return nullptr;
    uint16_t *p = nullptr;
#if defined(ESP32)
    p = (uint16_t *)heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM);
    if (!p) p = (uint16_t *)heap_caps_malloc(bytes, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
    if (!p) p = (uint16_t *)malloc(bytes);
#else
    p = (uint16_t *)malloc(bytes);
#endif
    return p;
}

void Display::freeFrame(uint16_t *p) {
    if (p) free(p);
}

void Display::snapshotFrame(uint16_t *dst) {
    if (_buffer && dst) memcpy(dst, _buffer, (size_t)_width * (size_t)_height * 2);
}

void Display::presentFull() {
    if (_bufMode != BufferMode::Full || !_buffer) return;
    flushRegion(0, 0, _width, _height);
}

}
