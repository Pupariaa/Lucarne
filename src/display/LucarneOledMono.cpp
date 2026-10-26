#include "LucarneOledMono.h"
#include <stdlib.h>
#include <string.h>

namespace lucarne {

OledMono::OledMono()
    : Gfx(0, 0), _wire(nullptr), _spi(nullptr), _useSpi(false), _buf(nullptr), _pw(0), _ph(0), _rot(0), _dx0(0),
      _dy0(0), _dx1(0), _dy1(0), _dirty(false) {}

OledMono::~OledMono() {
    if (_buf) free(_buf);
}

bool OledMono::colorIsOn(uint16_t color) {
    uint32_t r = (uint32_t)((color >> 11) & 0x1F) << 1;
    uint32_t g = (uint32_t)((color >> 5) & 0x3F);
    uint32_t b = (uint32_t)(color & 0x1F) << 1;
    return r * 299u + g * 587u + b * 114u >= 31500u;
}

OledOptions OledMono::optionsFrom(const DisplayOptions &options) {
    OledOptions o;
    if (options.panelWidth > 0) o.panelWidth = options.panelWidth;
    if (options.panelHeight > 0) o.panelHeight = options.panelHeight;
    o.invert = options.invert;
    return o;
}

bool OledMono::begin(const I2cDisplayPins &pins, const OledOptions &options, TwoWire *wire) {
    _useSpi = false;
    _wire = wire ? wire : &Wire;
    _i2cPins = pins;
    _opt = options;
#if defined(ARDUINO_ARCH_ESP32) || defined(ESP32)
    if (pins.sda >= 0 && pins.scl >= 0) {
        _wire->begin((int)pins.sda, (int)pins.scl);
    } else {
        _wire->begin();
    }
#elif defined(ARDUINO_ARCH_RP2040)
    if (pins.sda >= 0) _wire->setSDA(pins.sda);
    if (pins.scl >= 0) _wire->setSCL(pins.scl);
    _wire->begin();
#else
    _wire->begin();
#endif
    _wire->setClock(400000);
#if defined(ARDUINO_ARCH_ESP32) || defined(ESP32)
    _wire->setTimeOut(20);
#endif
    hardwareReset(pins.rst);
    return setup();
}

bool OledMono::begin(const I2cDisplayPins &pins, const DisplayOptions &options, TwoWire *wire) {
    _rot = (uint8_t)(options.rotation & 3);
    return begin(pins, optionsFrom(options), wire);
}

bool OledMono::beginSpi(const DisplayPins &pins, const OledOptions &options, SPIClass *spi, uint32_t spiHz) {
    _useSpi = true;
    _spi = spi ? spi : &SPI;
    _spiPins = pins;
    _opt = options;
    _spiSettings = SPISettings(spiHz, MSBFIRST, SPI_MODE0);
    if (pins.cs >= 0) {
        pinMode(pins.cs, OUTPUT);
        digitalWrite(pins.cs, HIGH);
    }
    if (pins.dc >= 0) {
        pinMode(pins.dc, OUTPUT);
        digitalWrite(pins.dc, LOW);
    }
    _spi->begin();
    hardwareReset(pins.rst);
    return setup();
}

bool OledMono::begin(const DisplayPins &pins, const DisplayOptions &options, SPIClass *spi) {
    _rot = (uint8_t)(options.rotation & 3);
    uint32_t hz = options.spiHz > 0 && options.spiHz < 10000000u ? options.spiHz : 8000000u;
    return beginSpi(pins, optionsFrom(options), spi, hz);
}

void OledMono::hardwareReset(int8_t rst) {
    if (rst < 0) return;
    pinMode(rst, OUTPUT);
    digitalWrite(rst, HIGH);
    delay(1);
    digitalWrite(rst, LOW);
    delay(10);
    digitalWrite(rst, HIGH);
    delay(10);
}

void OledMono::applyRotation() {
    if (transposed()) {
        WIDTH = _ph;
        HEIGHT = _pw;
    } else {
        WIDTH = _pw;
        HEIGHT = _ph;
    }
    _width = WIDTH;
    _height = HEIGHT;
}

bool OledMono::setup() {
    int16_t w = _opt.panelWidth > 0 ? _opt.panelWidth : 128;
    int16_t h = _opt.panelHeight > 0 ? _opt.panelHeight : 64;
    h = (int16_t)((h + 7) & ~7);
    _pw = w;
    _ph = h;
    applyRotation();
    if (_buf) free(_buf);
    _buf = (uint8_t *)malloc((size_t)w * (size_t)(h / 8));
    if (!_buf) return false;
    memset(_buf, 0, (size_t)w * (size_t)(h / 8));
    initController();
    if (_opt.invert) command(0xA7);
    _dirty = false;
    presentFull();
    return true;
}

void OledMono::setRotation(uint8_t r) {
    _rot = (uint8_t)(r & 3);
    if (!_buf) return;
    applyRotation();
    initController();
    if (_opt.invert) command(0xA7);
    memset(_buf, 0, (size_t)_pw * (size_t)(_ph / 8));
    _dirty = false;
    presentFull();
}

void OledMono::command(uint8_t c) {
    if (_useSpi) {
        _spi->beginTransaction(_spiSettings);
        if (_spiPins.dc >= 0) digitalWrite(_spiPins.dc, LOW);
        if (_spiPins.cs >= 0) digitalWrite(_spiPins.cs, LOW);
        _spi->transfer(c);
        if (_spiPins.cs >= 0) digitalWrite(_spiPins.cs, HIGH);
        _spi->endTransaction();
        return;
    }
    _wire->beginTransmission(_i2cPins.addr);
    _wire->write((uint8_t)0x00);
    _wire->write(c);
    _wire->endTransmission();
}

void OledMono::commandList(const uint8_t *list, uint8_t count) {
    for (uint8_t i = 0; i < count; i++) command(list[i]);
}

void OledMono::sendData(const uint8_t *data, size_t len) {
    if (!data || len == 0) return;
    if (_useSpi) {
        _spi->beginTransaction(_spiSettings);
        if (_spiPins.dc >= 0) digitalWrite(_spiPins.dc, HIGH);
        if (_spiPins.cs >= 0) digitalWrite(_spiPins.cs, LOW);
        for (size_t i = 0; i < len; i++) _spi->transfer(data[i]);
        if (_spiPins.cs >= 0) digitalWrite(_spiPins.cs, HIGH);
        _spi->endTransaction();
        return;
    }
    size_t off = 0;
    while (off < len) {
        size_t n = len - off;
        if (n > LUCARNE_OLED_I2C_CHUNK) n = LUCARNE_OLED_I2C_CHUNK;
        _wire->beginTransmission(_i2cPins.addr);
        _wire->write((uint8_t)0x40);
        _wire->write(data + off, n);
        _wire->endTransmission();
        off += n;
    }
}

void OledMono::setContrast(uint8_t contrast) {
    command(0x81);
    command(contrast);
}

void OledMono::invertDisplay(bool invert) {
    _opt.invert = invert;
    command(invert ? 0xA7 : 0xA6);
}

void OledMono::displayOn(bool on) { command(on ? 0xAF : 0xAE); }

void OledMono::clear() {
    if (!_buf) return;
    memset(_buf, 0, (size_t)_pw * (size_t)(_ph / 8));
    markDirty(0, 0, _width, _height);
}

void OledMono::markDirty(int16_t x, int16_t y, int16_t w, int16_t h) {
    if (w < 1 || h < 1) return;
    int16_t x1 = (int16_t)(x + w - 1);
    int16_t y1 = (int16_t)(y + h - 1);
    if (!_dirty) {
        _dx0 = x;
        _dy0 = y;
        _dx1 = x1;
        _dy1 = y1;
        _dirty = true;
        return;
    }
    if (x < _dx0) _dx0 = x;
    if (y < _dy0) _dy0 = y;
    if (x1 > _dx1) _dx1 = x1;
    if (y1 > _dy1) _dy1 = y1;
}

Rect OledMono::physicalRect(const Rect &logical) const {
    if (!transposed()) return logical;
    return Rect((int16_t)(_pw - logical.bottom()), logical.x, logical.h, logical.w);
}

void OledMono::setBit(int16_t px, int16_t py, bool on) {
    uint8_t *p = &_buf[(size_t)(py >> 3) * (size_t)_pw + (size_t)px];
    uint8_t mask = (uint8_t)(1u << (py & 7));
    if (on) {
        *p |= mask;
    } else {
        *p &= (uint8_t)~mask;
    }
}

void OledMono::writePixel(int16_t x, int16_t y, uint16_t color) {
    if (!_buf || !pointInClip(x, y)) return;
    if (transposed()) {
        setBit((int16_t)(_pw - 1 - y), x, colorIsOn(color));
    } else {
        setBit(x, y, colorIsOn(color));
    }
    markDirty(x, y, 1, 1);
}

void OledMono::writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (!_buf) return;
    if (!clipToActive(x, y, w, h)) return;
    bool on = colorIsOn(color);
    Rect pr = physicalRect(Rect(x, y, w, h));
    for (int16_t yy = pr.y; yy < pr.bottom(); yy++) {
        uint8_t mask = (uint8_t)(1u << (yy & 7));
        uint8_t *row = &_buf[(size_t)(yy >> 3) * (size_t)_pw];
        if (on) {
            for (int16_t xx = pr.x; xx < pr.right(); xx++) row[xx] |= mask;
        } else {
            uint8_t inv = (uint8_t)~mask;
            for (int16_t xx = pr.x; xx < pr.right(); xx++) row[xx] &= inv;
        }
    }
    markDirty(x, y, w, h);
}

void OledMono::writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) { writeFillRect(x, y, w, 1, color); }

void OledMono::writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) { writeFillRect(x, y, 1, h, color); }

void OledMono::writeRowRgb565Le(int16_t x, int16_t y, int16_t w, const uint16_t *srcLe) {
    if (!srcLe || w <= 0) return;
    for (int16_t i = 0; i < w; i++)
        writePixel((int16_t)(x + i), y, srcLe[i]);
}

uint16_t OledMono::peekPixel(int16_t x, int16_t y) const {
    if (!_buf || x < 0 || y < 0 || x >= _width || y >= _height) return 0;
    int16_t px = x;
    int16_t py = y;
    if (transposed()) {
        px = (int16_t)(_pw - 1 - y);
        py = x;
    }
    uint8_t v = _buf[(size_t)(py >> 3) * (size_t)_pw + (size_t)px];
    return (v & (1u << (py & 7))) ? 0xFFFF : 0x0000;
}

bool OledMono::flushRect(int16_t x, int16_t y, int16_t w, int16_t h) {
    if (!_buf) return false;
    Rect r = Rect(x, y, w, h).intersect(Rect(0, 0, _width, _height));
    if (r.empty()) return false;
    Rect pr = physicalRect(r);
    uint8_t p0 = (uint8_t)(pr.y >> 3);
    uint8_t p1 = (uint8_t)((pr.bottom() - 1) >> 3);
    sendPages(p0, p1, pr.x, (int16_t)(pr.right() - 1));
    if (_dirty) {
        Rect d(_dx0, _dy0, (int16_t)(_dx1 - _dx0 + 1), (int16_t)(_dy1 - _dy0 + 1));
        if (r.contains(d)) _dirty = false;
    }
    return true;
}

void OledMono::flushArea(int16_t x, int16_t y, int16_t w, int16_t h) { flushRect(x, y, w, h); }

void OledMono::display() {
    if (!_dirty) return;
    flushRect(_dx0, _dy0, (int16_t)(_dx1 - _dx0 + 1), (int16_t)(_dy1 - _dy0 + 1));
    _dirty = false;
}

void OledMono::presentFull() {
    if (!_buf) return;
    sendPages(0, (uint8_t)((_ph >> 3) - 1), 0, (int16_t)(_pw - 1));
    _dirty = false;
}

void OledMono::presentDirty() { display(); }

void OledMono::invalidateRegion(int16_t x, int16_t y, int16_t w, int16_t h) {
    Rect r = Rect(x, y, w, h).intersect(Rect(0, 0, _width, _height));
    if (!r.empty()) markDirty(r.x, r.y, r.w, r.h);
}

void SSD1306::initController() {
    uint8_t multiplex = (uint8_t)(panelHeight() - 1);
    uint8_t comPins = panelHeight() > 32 ? 0x12 : 0x02;
    const uint8_t init[] = {0xAE, 0xD5, 0x80, 0xA8, multiplex, 0xD3, 0x00, 0x40, 0x8D, 0x14, 0x20, 0x00,
                            (uint8_t)(flipped() ? 0xA0 : 0xA1), (uint8_t)(flipped() ? 0xC0 : 0xC8), 0xDA,
                            comPins, 0x81, 0xCF, 0xD9, 0xF1, 0xDB, 0x40, 0x2E, 0xA4, 0xA6, 0xAF};
    commandList(init, (uint8_t)sizeof(init));
}

void SSD1306::sendPages(uint8_t p0, uint8_t p1, int16_t c0, int16_t c1) {
    const uint8_t window[] = {0x21, (uint8_t)c0, (uint8_t)c1, 0x22, p0, p1};
    commandList(window, (uint8_t)sizeof(window));
    size_t n = (size_t)(c1 - c0 + 1);
    for (uint8_t p = p0; p <= p1; p++) sendData(pageRow(p) + c0, n);
}

void SH1106::initController() {
    uint8_t multiplex = (uint8_t)(panelHeight() - 1);
    const uint8_t init[] = {0xAE, 0xD5, 0x80, 0xA8, multiplex, 0xD3, 0x00, 0x40, 0xAD, 0x8B,
                            (uint8_t)(flipped() ? 0xA0 : 0xA1), (uint8_t)(flipped() ? 0xC0 : 0xC8), 0xDA,
                            0x12, 0x81, 0x80, 0xD9, 0x22, 0xDB, 0x35, 0x32, 0xA4, 0xA6, 0xAF};
    commandList(init, (uint8_t)sizeof(init));
}

void SH1106::sendPages(uint8_t p0, uint8_t p1, int16_t c0, int16_t c1) {
    size_t n = (size_t)(c1 - c0 + 1);
    uint8_t col = (uint8_t)(c0 + 2);
    for (uint8_t p = p0; p <= p1; p++) {
        command((uint8_t)(0xB0 | p));
        command((uint8_t)(0x00 | (col & 0x0F)));
        command((uint8_t)(0x10 | (col >> 4)));
        sendData(pageRow(p) + c0, n);
    }
}

}
