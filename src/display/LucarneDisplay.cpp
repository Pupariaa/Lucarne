#include "LucarneDisplay.h"
#include "LucarneST77xx.h"
#include "../hal/LucarneHal.h"
#include "../hal/LucarneBlitBackend.h"
#include "../core/LucarneRenderConfig.h"
#include <stdlib.h>
#include <string.h>

#if defined(ESP32)
#include "esp_heap_caps.h"
#endif

namespace lucarne {

static inline uint16_t be16(uint16_t c) {
  return (uint16_t)((c << 8) | (c >> 8));
}

// SPIClass::writeBytes() (TX-only, no RX buffering) is an ESP32 extension, not
// part of the portable Arduino SPI API - other cores (RP2040, AVR) only offer
// transfer(), which is either single-byte or an in-place bulk transfer that
// would overwrite `data` with whatever comes back on MISO. Since `data` here
// often points straight into the framebuffer, that in-place variant is not
// safe to use; fall back to a byte-by-byte transfer instead.
static inline void spiWriteBytes(SPIClass *spi, const uint8_t *data, size_t len) {
#if defined(ESP32)
  spi->writeBytes(const_cast<uint8_t *>(data), len);
#else
  for (size_t i = 0; i < len; i++) {
    spi->transfer(data[i]);
  }
#endif
}

static void *allocDmaInternal(size_t bytes, bool &dmaSafe) {
  void *p = nullptr;
#if defined(ESP32)
  p = heap_caps_malloc(bytes, MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL);
  dmaSafe = p != nullptr;
  if (!p) {
    p = heap_caps_malloc(bytes, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
    dmaSafe = p != nullptr;
  }
#endif
  if (!p) {
    p = malloc(bytes);
    dmaSafe = true;
  }
  return p;
}

Display::Display()
    : Gfx(0, 0), _spi(nullptr), _spiSettings(27000000, MSBFIRST, SPI_MODE0),
      _bufMode(BufferMode::Full), _bufMem(BufferMemory::Auto), _bufMaxBytes(0),
      _buffer(nullptr), _lineBuf(nullptr), _bufferDmaSafe(true), _stripeCount(0),
      _stripeIdx(0), _stripeBuf(nullptr), _stripeCap(0), _stripeLines(0),
      _stripeDmaSafe(true), _reqLines(0), _panelW(0), _panelH(0), _colStart(0),
      _rowStart(0), _colStart2(0), _rowStart2(0), _xstart(0), _ystart(0), _madctl(0),
      _dx0(0), _dy0(0), _dx1(0), _dy1(0), _dirty(false), _txDepth(0) {
  _stripes[0] = nullptr;
  _stripes[1] = nullptr;
}

Display::~Display() {
  freeBuffer();
  freeStripe();
}

bool Display::begin(const DisplayPins &pins, const DisplayOptions &options,
                    const BufferOptions &buffer, SPIClass *spi) {
  _spi = spi;
  _pins = pins;
  _opt = options;
  _bufMode = buffer.mode;
  _bufMem = buffer.memory;
  _bufMaxBytes = buffer.maxBytes;
  halInit(buffer.hal);
  _reqLines = buffer.partialLineCount ? buffer.partialLineCount : halActiveProfile().stripeLines;
  freeBuffer();
  freeStripe();
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

  _flushCtx.user = this;
  _flushCtx.spi = _spi;
  _flushCtx.beginWindow = spiFlushBeginThunk;
  _flushCtx.writePixels = spiFlushWriteThunk;
  _flushCtx.endWindow = spiFlushEndThunk;
  _flushCtx.pinCs = _pins.cs;
  _flushCtx.pinDc = _pins.dc;
  _flushCtx.pinSclk = _pins.sclk;
  _flushCtx.pinMosi = _pins.mosi;
  _flushCtx.spiHz = options.spiHz;
  _flushCtx.spiMode = options.spiMode;

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

  flushWait();
#if defined(ESP32)
  _spi->end();
  delay(10);
  _spi->begin(_pins.sclk, _pins.miso, _pins.mosi, -1);
#else
  _spi->begin();
#endif

  hardwareReset();

  setupOffsets();
  if (options.colStart >= 0)
    _colStart = options.colStart;
  if (options.rowStart >= 0)
    _rowStart = options.rowStart;
  if (options.colStart2 >= 0)
    _colStart2 = options.colStart2;
  if (options.rowStart2 >= 0)
    _rowStart2 = options.rowStart2;

  _spi->beginTransaction(_spiSettings);
  if (_pins.cs >= 0)
    digitalWrite(_pins.cs, LOW);
  initPanel();
  if (_pins.cs >= 0)
    digitalWrite(_pins.cs, HIGH);
  _spi->endTransaction();

  setRotation(options.rotation);
  invertDisplay(options.invert);

  if (_bufMode == BufferMode::Full) {
    if (!allocBuffer()) {
      _bufMode = BufferMode::Partial;
      if (_opt.debug) {
        Serial.println("Lucarne: framebuffer unavailable, downgrading to partial mode");
      }
    }
  }
  if (_bufMode == BufferMode::Partial) {
    if (!allocStripe()) {
      _bufMode = BufferMode::None;
      if (_opt.debug) {
        Serial.println("Lucarne: stripe buffer unavailable, falling back to direct mode");
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
    Serial.print(_bufMode == BufferMode::Full
                     ? "full"
                     : (_bufMode == BufferMode::Partial ? "partial" : "none"));
    if (_bufMode == BufferMode::Partial) {
      Serial.print(" stripeLines=");
      Serial.print(_stripeLines);
      Serial.print(" stripes=");
      Serial.print(_stripeCount);
    }
    Serial.print(" dmaSafe=");
    Serial.print((_bufMode == BufferMode::Partial ? _stripeDmaSafe : _bufferDmaSafe) ? 1 : 0);
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
  if (_pins.rst < 0)
    return;
  digitalWrite(_pins.rst, HIGH);
  delay(20);
  digitalWrite(_pins.rst, LOW);
  delay(20);
  digitalWrite(_pins.rst, HIGH);
  delay(150);
}

void Display::writeCommand(uint8_t cmd) {
  if (_pins.dc >= 0)
    digitalWrite(_pins.dc, LOW);
  _spi->transfer(cmd);
}

void Display::writeData(uint8_t data) {
  if (_pins.dc >= 0)
    digitalWrite(_pins.dc, HIGH);
  _spi->transfer(data);
}

void Display::writeData16(uint16_t data) {
  if (_pins.dc >= 0)
    digitalWrite(_pins.dc, HIGH);
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
  flushWait();
  computeRotation((uint8_t)(r & 3));
  _opt.rotation = (uint8_t)(r & 3);
  _spi->beginTransaction(_spiSettings);
  if (_pins.cs >= 0)
    digitalWrite(_pins.cs, LOW);
  writeCommand(ST77XX_MADCTL);
  writeData(_madctl);
  if (_pins.cs >= 0)
    digitalWrite(_pins.cs, HIGH);
  _spi->endTransaction();
}

void Display::applyPanelConfig(int16_t panelW, int16_t panelH,
                               uint8_t rotation) {
  _panelW = panelW;
  _panelH = panelH;
  setupOffsets();
  if (_opt.colStart >= 0)
    _colStart = _opt.colStart;
  if (_opt.rowStart >= 0)
    _rowStart = _opt.rowStart;
  if (_opt.colStart2 >= 0)
    _colStart2 = _opt.colStart2;
  if (_opt.rowStart2 >= 0)
    _rowStart2 = _opt.rowStart2;
  setRotation(rotation);
  fillScreen(0);
  if (_bufMode == BufferMode::Full && _buffer)
    _dirty = true;
}

void Display::invertDisplay(bool invert) {
  flushWait();
  _spi->beginTransaction(_spiSettings);
  if (_pins.cs >= 0)
    digitalWrite(_pins.cs, LOW);
  writeCommand(invert ? ST77XX_INVON : ST77XX_INVOFF);
  if (_pins.cs >= 0)
    digitalWrite(_pins.cs, HIGH);
  _spi->endTransaction();
}

void Display::backlight(bool on) {
  if (_pins.bl < 0)
    return;
  bool level = on ^ _opt.blActiveLow;
  digitalWrite(_pins.bl, level ? HIGH : LOW);
}

Rect Display::targetBounds() const {
  if (_bufMode == BufferMode::Full && _buffer)
    return Rect(0, 0, _width, _height);
  if (stripeTarget())
    return _stripeWin;
  return Rect();
}

bool Display::targetRect(int16_t &x, int16_t &y, int16_t &w, int16_t &h) const {
  Rect r = Rect(x, y, w, h).intersect(clipRect());
  if (stripeTarget())
    r = r.intersect(_stripeWin);
  if (r.empty())
    return false;
  x = r.x;
  y = r.y;
  w = r.w;
  h = r.h;
  return true;
}

bool Display::canPeekPixel() const { return hasTarget(); }

uint16_t Display::peekPixel(int16_t x, int16_t y) const {
  if (!hasTarget() || !targetBounds().contains(x, y))
    return 0;
  return be16(*targetAt(x, y));
}

void Display::writeRowRgb565Le(int16_t x, int16_t y, int16_t w,
                               const uint16_t *srcLe) {
  if (!srcLe || w < 1)
    return;
  if (_bufMode == BufferMode::Full && _buffer) {
    writeBufferRect(x, y, w, 1, srcLe);
    return;
  }
  int16_t rx = x, ry = y, rw = w, rh = 1;
  if (!targetRect(rx, ry, rw, rh))
    return;
  flushWait();
  _spi->beginTransaction(_spiSettings);
  if (_pins.cs >= 0)
    digitalWrite(_pins.cs, LOW);
  setAddrWindow(rx, ry, rw, rh);
  if (_pins.dc >= 0)
    digitalWrite(_pins.dc, HIGH);
  for (int16_t col = 0; col < rw; col++)
    writeData16(srcLe[col]);
  if (_pins.cs >= 0)
    digitalWrite(_pins.cs, HIGH);
  _spi->endTransaction();
}

void Display::writeBufferRect(int16_t x, int16_t y, int16_t w, int16_t h,
                              const uint16_t *src) {
  if (!hasTarget() || !src || w < 1 || h < 1)
    return;
  int16_t rx = x, ry = y, rw = w, rh = h;
  if (!targetRect(rx, ry, rw, rh))
    return;
  for (int16_t row = 0; row < rh; row++) {
    uint16_t *dst = targetAt(rx, (int16_t)(ry + row));
    const uint16_t *srcRow =
        src + (size_t)(ry + row - y) * (size_t)w + (size_t)(rx - x);
    for (int16_t col = 0; col < rw; col++) {
      dst[col] = be16(srcRow[col]);
    }
  }
  markDirty(rx, ry, rw, rh);
}

void Display::blitBufferRect(int16_t x, int16_t y, int16_t w, int16_t h,
                             const uint16_t *srcBe16) {
  if (!hasTarget() || !srcBe16 || w < 1 || h < 1)
    return;
  int16_t rx = x, ry = y, rw = w, rh = h;
  if (!targetRect(rx, ry, rw, rh))
    return;
  for (int16_t row = 0; row < rh; row++) {
    uint16_t *dst = targetAt(rx, (int16_t)(ry + row));
    memcpy(dst,
           srcBe16 + (size_t)(ry + row - y) * (size_t)w + (size_t)(rx - x),
           (size_t)rw * 2);
  }
  markDirty(rx, ry, rw, rh);
}

void Display::readBufferRectNative(int16_t x, int16_t y, int16_t w, int16_t h,
                                   uint16_t *dst) {
  if (!hasTarget() || !dst || w < 1 || h < 1)
    return;
  Rect r = Rect(x, y, w, h).intersect(targetBounds());
  if (r.empty())
    return;
  for (int16_t row = 0; row < r.h; row++) {
    const uint16_t *src = targetAt(r.x, (int16_t)(r.y + row));
    uint16_t *out =
        dst + (size_t)(r.y + row - y) * (size_t)w + (size_t)(r.x - x);
    for (int16_t col = 0; col < r.w; col++) {
      out[col] = be16(src[col]);
    }
  }
}

void Display::writePixelsFitOver(int16_t boxX, int16_t boxY, int16_t boxW,
                                 int16_t boxH, const uint16_t *pix, int16_t sw,
                                 int16_t sh, const uint8_t *alpha,
                                 bool hasAlpha, const uint16_t *under,
                                 int16_t underW, int16_t underH) {
  if (!hasTarget() || !pix || !under || sw < 1 || sh < 1 || boxW < 1 ||
      boxH < 1 || underW < 1 || underH < 1) {
    return;
  }
  int16_t rw = boxW;
  int16_t rh = boxH;
  if (sw * boxH < sh * boxW) {
    rw = (int16_t)((sw * boxH) / sh);
    if (rw < 1)
      rw = 1;
  } else if (sh * boxW < sw * boxH) {
    rh = (int16_t)((sh * boxW) / sw);
    if (rh < 1)
      rh = 1;
  }
  int16_t ox = (int16_t)(boxX + (boxW - rw) / 2);
  int16_t oy = (int16_t)(boxY + (boxH - rh) / 2);
  for (int16_t py = 0; py < rh; py++) {
    int16_t sy = (int16_t)((py * sh) / rh);
    for (int16_t px = 0; px < rw; px++) {
      int16_t sx = (int16_t)((px * sw) / rw);
      size_t si = (size_t)sy * (size_t)sw + (size_t)sx;
      int16_t dx = (int16_t)(ox + px);
      int16_t dy = (int16_t)(oy + py);
      if (!inTarget(dx, dy))
        continue;
      int16_t lx = (int16_t)(dx - boxX);
      int16_t ly = (int16_t)(dy - boxY);
      if (lx < 0 || ly < 0 || lx >= underW || ly >= underH)
        continue;
      uint16_t bg = under[(size_t)ly * (size_t)underW + (size_t)lx];
      if (hasAlpha && alpha) {
        uint8_t a = alpha[si];
        if (a < 8)
          continue;
        uint16_t fg = pix[si];
        *targetAt(dx, dy) = be16(a >= 250 ? fg : colorBlend(bg, fg, a));
      } else {
        if (pix[si] == 0)
          continue;
        *targetAt(dx, dy) = be16(pix[si]);
      }
    }
  }
  markDirty(ox, oy, rw, rh);
}

void Display::startWrite() {
  if (hasTarget())
    return;
  if (_txDepth++ == 0) {
    flushWait();
    _spi->beginTransaction(_spiSettings);
    if (_pins.cs >= 0)
      digitalWrite(_pins.cs, LOW);
  }
}

void Display::endWrite() {
  if (hasTarget())
    return;
  if (_txDepth > 0 && --_txDepth == 0) {
    if (_pins.cs >= 0)
      digitalWrite(_pins.cs, HIGH);
    _spi->endTransaction();
  }
}

void Display::writePixel(int16_t x, int16_t y, uint16_t color) {
  if (!inTarget(x, y))
    return;
  if (hasTarget()) {
    *targetAt(x, y) = be16(color);
    markDirty(x, y, 1, 1);
    return;
  }
  setAddrWindow(x, y, 1, 1);
  writeData16(color);
}

void Display::writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h,
                            uint16_t color) {
  if (!targetRect(x, y, w, h))
    return;

  if (hasTarget()) {
    uint16_t v = be16(color);
    if ((int32_t)w * h >= 256 &&
        halBlitBackend()->fillRect565(targetAt(x, y), targetStride(), w, h, v)) {
      markDirty(x, y, w, h);
      return;
    }
    for (int16_t row = 0; row < h; row++) {
      uint16_t *p = targetAt(x, (int16_t)(y + row));
      for (int16_t col = 0; col < w; col++) {
        p[col] = v;
      }
    }
    markDirty(x, y, w, h);
    return;
  }

  setAddrWindow(x, y, w, h);
  if (_pins.dc >= 0)
    digitalWrite(_pins.dc, HIGH);
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
  if (_bufMode != BufferMode::Full || !_buffer)
    return;
  int16_t x2 = (int16_t)(x + w - 1);
  int16_t y2 = (int16_t)(y + h - 1);
  if (x < 0)
    x = 0;
  if (y < 0)
    y = 0;
  if (x2 > _width - 1)
    x2 = (int16_t)(_width - 1);
  if (y2 > _height - 1)
    y2 = (int16_t)(_height - 1);
  if (x2 < x || y2 < y)
    return;
  if (!_dirty) {
    _dx0 = x;
    _dy0 = y;
    _dx1 = x2;
    _dy1 = y2;
    _dirty = true;
  } else {
    if (x < _dx0)
      _dx0 = x;
    if (y < _dy0)
      _dy0 = y;
    if (x2 > _dx1)
      _dx1 = x2;
    if (y2 > _dy1)
      _dy1 = y2;
  }
}

void Display::spiFlushBeginWindow(int16_t x, int16_t y, int16_t w, int16_t h) {
  _spi->beginTransaction(_spiSettings);
  if (_pins.cs >= 0)
    digitalWrite(_pins.cs, LOW);
  setAddrWindow(x, y, w, h);
  if (_pins.dc >= 0)
    digitalWrite(_pins.dc, HIGH);
}

void Display::spiFlushWritePixels(const uint8_t *data, size_t len) {
  spiWriteBytes(_spi, data, len);
}

void Display::spiFlushEndWindow() {
  if (_pins.cs >= 0)
    digitalWrite(_pins.cs, HIGH);
  _spi->endTransaction();
}

void Display::spiFlushBeginThunk(void *user, int16_t x, int16_t y, int16_t w, int16_t h) {
  static_cast<Display *>(user)->spiFlushBeginWindow(x, y, w, h);
}

void Display::spiFlushWriteThunk(void *user, const uint8_t *data, size_t len) {
  static_cast<Display *>(user)->spiFlushWritePixels(data, len);
}

void Display::spiFlushEndThunk(void *user) { static_cast<Display *>(user)->spiFlushEndWindow(); }

void Display::flushPixels(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *src,
                          int16_t stride, bool dmaSafe, bool async) {
  if (!src || w <= 0 || h <= 0)
    return;
  _flushCtx.dmaSafeSrc = dmaSafe;
  _flushCtx.allowAsync = async;
  _flushCtx.stagingLine = _lineBuf;
  _flushCtx.stagingLineBytes = _lineBuf ? (size_t)((_panelW > _panelH) ? _panelW : _panelH) * 2 : 0;
  if (!halFlushRgb565Region(x, y, w, h, stride, src, &_flushCtx)) {
    spiFlushBeginWindow(x, y, w, h);
    size_t rowBytes = (size_t)w * 2;
    for (int16_t row = 0; row < h; row++) {
      const uint16_t *line = src + (int32_t)row * stride;
      if (dmaSafe || !_lineBuf) {
        spiFlushWritePixels((const uint8_t *)line, rowBytes);
      } else {
        memcpy(_lineBuf, line, rowBytes);
        spiFlushWritePixels((const uint8_t *)_lineBuf, rowBytes);
      }
    }
    spiFlushEndWindow();
  }
  if (!async)
    flushWait();
}

void Display::flushWait() { halFlushWait(); }

void Display::flushRegion(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (!_buffer)
    return;
  Rect r = Rect(x, y, w, h).intersect(Rect(0, 0, _width, _height));
  if (r.empty())
    return;
  flushPixels(r.x, r.y, r.w, r.h, &_buffer[(int32_t)r.y * _width + r.x], _width,
              _bufferDmaSafe, false);
}

void Display::display() {
  if (_bufMode != BufferMode::Full || !_buffer || !_dirty)
    return;
  flushRegion(_dx0, _dy0, (int16_t)(_dx1 - _dx0 + 1),
              (int16_t)(_dy1 - _dy0 + 1));
  _dirty = false;
}

void Display::display(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (_bufMode != BufferMode::Full || !_buffer)
    return;
  flushRegion(x, y, w, h);
}

void Display::flushArea(int16_t x, int16_t y, int16_t w, int16_t h) {
  display(x, y, w, h);
}

bool Display::flushRect(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (_bufMode != BufferMode::Full || !_buffer)
    return false;
  Rect r = Rect(x, y, w, h).intersect(Rect(0, 0, _width, _height));
  if (r.empty())
    return false;
  flushRegion(r.x, r.y, r.w, r.h);
  if (_dirty) {
    Rect d(_dx0, _dy0, (int16_t)(_dx1 - _dx0 + 1), (int16_t)(_dy1 - _dy0 + 1));
    if (r.contains(d))
      _dirty = false;
  }
  return true;
}

bool Display::supportsPartialPresent() const {
  return _bufMode == BufferMode::Partial && _stripeCount > 0;
}

int16_t Display::stripeRowsFor(int16_t w) const {
  if (_bufMode != BufferMode::Partial || _stripeCount == 0 || w <= 0)
    return _height;
  size_t rows = _stripeCap / (size_t)w;
  if (rows < 1)
    rows = 1;
  if (rows > (size_t)_height)
    rows = (size_t)_height;
  return (int16_t)rows;
}

bool Display::beginStripe(int16_t x, int16_t y, int16_t w, int16_t h) {
  if (_stripeActive)
    endStripe();
  if (_bufMode == BufferMode::Partial && _stripeCount > 0) {
    Rect r = Rect(x, y, w, h).intersect(Rect(0, 0, _width, _height));
    if (r.empty())
      return false;
    int16_t rows = stripeRowsFor(r.w);
    if (r.h > rows)
      r.h = rows;
    _stripeBuf = _stripes[_stripeIdx];
    if (_stripeCount < 2)
      flushWait();
    return Gfx::beginStripe(r.x, r.y, r.w, r.h);
  }
  _stripeBuf = nullptr;
  return Gfx::beginStripe(x, y, w, h);
}

void Display::endStripe() {
  if (!_stripeActive)
    return;
  Rect r = _stripeWin;
  if (_bufMode == BufferMode::Partial && _stripeBuf) {
    uint16_t *buf = _stripeBuf;
    _stripeActive = false;
    _stripeBuf = nullptr;
    resetClipRect();
    flushPixels(r.x, r.y, r.w, r.h, buf, r.w, _stripeDmaSafe, _stripeCount > 1);
    if (_stripeCount > 1)
      _stripeIdx = (uint8_t)(_stripeIdx ^ 1);
    return;
  }
  _stripeActive = false;
  _stripeBuf = nullptr;
  resetClipRect();
  flushRect(r.x, r.y, r.w, r.h);
}

bool Display::allocBuffer() {
  size_t count = (size_t)_width * (size_t)_height;
  size_t bytes = count * 2;
  if (bytes == 0)
    return false;
  if (_bufMaxBytes && bytes > _bufMaxBytes)
    return false;

#if defined(ESP32)
  _bufferDmaSafe = true;
  if (_bufMem == BufferMemory::Psram || _bufMem == BufferMemory::Auto) {
    _buffer = (uint16_t *)heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM);
    if (_buffer)
      _bufferDmaSafe = false;
  }
  if (!_buffer) {
    _buffer = (uint16_t *)heap_caps_malloc(bytes, MALLOC_CAP_8BIT |
                                                      MALLOC_CAP_INTERNAL);
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
    Serial.println(
        (uint32_t)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
  }
#else
  _buffer = (uint16_t *)malloc(bytes);
  _bufferDmaSafe = true;
#endif
  if (!_buffer)
    return false;
  memset(_buffer, 0, bytes);

  if (!_bufferDmaSafe) {
    int16_t maxDim = (_width > _height) ? _width : _height;
    size_t lineBytes = (size_t)maxDim * 2;
#if defined(ESP32)
    _lineBuf = (uint16_t *)heap_caps_malloc(lineBytes, MALLOC_CAP_DMA);
    if (!_lineBuf) {
      _lineBuf = (uint16_t *)heap_caps_malloc(
          lineBytes, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
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

bool Display::allocStripe() {
  freeStripe();
  int16_t maxDim = (_panelW > _panelH) ? _panelW : _panelH;
  if (maxDim <= 0)
    return false;
  uint16_t lines = _reqLines ? _reqLines : defaultStripeLines(_height);
  if (lines > (uint16_t)maxDim)
    lines = (uint16_t)maxDim;
  if (_bufMaxBytes) {
    uint32_t maxLines = _bufMaxBytes / ((uint32_t)maxDim * 2u);
    if (maxLines < 1)
      maxLines = 1;
    if (lines > maxLines)
      lines = (uint16_t)maxLines;
  }
  FlushBackend *fb = halFlushBackend();
  uint8_t wanted = (fb && fb->supportsAsync()) ? 2 : 1;
  while (lines >= 1) {
    size_t cap = (size_t)lines * (size_t)maxDim;
    bool safe0 = true;
    _stripes[0] = (uint16_t *)allocDmaInternal(cap * 2, safe0);
    if (_stripes[0]) {
      _stripeCap = cap;
      _stripeLines = lines;
      _stripeDmaSafe = safe0;
      _stripeCount = 1;
      if (wanted > 1) {
        bool safe1 = true;
        _stripes[1] = (uint16_t *)allocDmaInternal(cap * 2, safe1);
        if (_stripes[1] && safe1 == safe0)
          _stripeCount = 2;
        else if (_stripes[1]) {
          free(_stripes[1]);
          _stripes[1] = nullptr;
        }
      }
      _stripeIdx = 0;
      return true;
    }
    if (lines == 1)
      break;
    lines = (uint16_t)(lines / 2);
  }
  return false;
}

void Display::freeStripe() {
  flushWait();
  for (uint8_t i = 0; i < 2; i++) {
    if (_stripes[i]) {
      free(_stripes[i]);
      _stripes[i] = nullptr;
    }
  }
  _stripeCount = 0;
  _stripeCap = 0;
  _stripeBuf = nullptr;
}

uint16_t Display::pixelFromBuffer(uint16_t stored) const {
  return be16(stored);
}

uint16_t Display::pixelToBuffer(uint16_t logical) const {
  return be16(logical);
}

uint16_t *Display::allocFrame() {
  const HalProfile &prof = halActiveProfile();
  if (_bufMode != BufferMode::Full || !_buffer || !prof.allowRichTransitions ||
      prof.uiProfile == UiProfile::Tiny)
    return nullptr;
  size_t bytes = (size_t)_width * (size_t)_height * 2;
  if (bytes == 0)
    return nullptr;
  uint16_t *p = nullptr;
#if defined(ESP32)
  p = (uint16_t *)heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM);
  if (!p)
    p = (uint16_t *)heap_caps_malloc(bytes,
                                     MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
  if (!p)
    p = (uint16_t *)malloc(bytes);
#else
  p = (uint16_t *)malloc(bytes);
#endif
  return p;
}

void Display::freeFrame(uint16_t *p) {
  if (p)
    free(p);
}

void Display::snapshotFrame(uint16_t *dst) {
#if !defined(LUCARNE_DEBUG_SNAPSHOT)
  if (halActiveProfile().uiProfile == UiProfile::Tiny)
    return;
#endif
  if (_buffer && dst)
    memcpy(dst, _buffer, (size_t)_width * (size_t)_height * 2);
}

void Display::presentFull() {
  if (_bufMode != BufferMode::Full || !_buffer)
    return;
  flushRegion(0, 0, _width, _height);
  _dirty = false;
}

void Display::presentDirty() {
  if (_bufMode != BufferMode::Full || !_buffer) {
    flushWait();
    return;
  }
  display();
}

void Display::invalidateRegion(int16_t x, int16_t y, int16_t w, int16_t h) { markDirty(x, y, w, h); }

bool Display::displayDirtyRegion(int16_t &x, int16_t &y, int16_t &w, int16_t &h) const {
  if (!_dirty)
    return false;
  x = _dx0;
  y = _dy0;
  w = (int16_t)(_dx1 - _dx0 + 1);
  h = (int16_t)(_dy1 - _dy0 + 1);
  return true;
}

} // namespace lucarne
