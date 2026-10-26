#ifndef LUCARNE_DISPLAY_H
#define LUCARNE_DISPLAY_H

#include <Arduino.h>
#include <SPI.h>
#include "../core/LucarneGfx.h"
#include "../core/LucarneTypes.h"
#include "../hal/LucarneFlushBackend.h"

namespace lucarne {

class Display : public Gfx {
  public:
    Display();
    virtual ~Display();

    bool begin(const DisplayPins &pins, const DisplayOptions &options,
               const BufferOptions &buffer = BufferOptions(), SPIClass *spi = &SPI);

    void setRotation(uint8_t r);
    void applyPanelConfig(int16_t panelW, int16_t panelH, uint8_t rotation);
    void invertDisplay(bool invert);
    void backlight(bool on);

    void display();
    void display(int16_t x, int16_t y, int16_t w, int16_t h);
    void flushArea(int16_t x, int16_t y, int16_t w, int16_t h) override;

    void writeBufferRect(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *src) override;
    void writeRowRgb565Le(int16_t x, int16_t y, int16_t w, const uint16_t *srcLe) override;
    void blitBufferRect(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *srcBe16) override;
    void readBufferRectNative(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t *dst) override;

    void writePixelsFitOver(int16_t boxX, int16_t boxY, int16_t boxW, int16_t boxH, const uint16_t *pix,
                            int16_t sw, int16_t sh, const uint8_t *alpha, bool hasAlpha,
                            const uint16_t *under, int16_t underW, int16_t underH);

    bool canPeekPixel() const override;
    uint16_t peekPixel(int16_t x, int16_t y) const override;

    void writePixel(int16_t x, int16_t y, uint16_t color) override;
    void writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) override;
    void writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) override;
    void writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) override;
    void startWrite() override;
    void endWrite() override;

    uint16_t pixelFromBuffer(uint16_t stored) const override;
    uint16_t pixelToBuffer(uint16_t logical) const override;

    BufferMode bufferMode() const override { return _bufMode; }
    bool hasBuffer() const override { return _buffer != nullptr; }
    uint16_t *buffer() override { return _buffer; }

    uint16_t *allocFrame() override;
    void freeFrame(uint16_t *p) override;
    void snapshotFrame(uint16_t *dst) override;
    void presentFull() override;
    void presentDirty() override;
    void invalidateRegion(int16_t x, int16_t y, int16_t w, int16_t h) override;
    bool displayDirtyRegion(int16_t &x, int16_t &y, int16_t &w, int16_t &h) const override;

    bool flushRect(int16_t x, int16_t y, int16_t w, int16_t h) override;
    bool supportsPartialPresent() const override;
    uint16_t partialLines() const override { return _stripeLines; }
    int16_t stripeRowsFor(int16_t w) const override;
    bool beginStripe(int16_t x, int16_t y, int16_t w, int16_t h) override;
    void endStripe() override;
    void discardDirty() override { _dirty = false; }
    void flushWait() override;

  protected:
    virtual void initPanel() = 0;
    virtual void setupOffsets() = 0;
    virtual void computeRotation(uint8_t r) = 0;

    void writeCommand(uint8_t cmd);
    void writeData(uint8_t data);
    void writeData16(uint16_t data);
    void sendCommand(uint8_t cmd, const uint8_t *data, uint8_t len);
    void setAddrWindow(int16_t x, int16_t y, int16_t w, int16_t h);
    void hardwareReset();

    bool allocBuffer();
    void freeBuffer();
    bool allocStripe();
    void freeStripe();
    void markDirty(int16_t x, int16_t y, int16_t w, int16_t h);
    void flushRegion(int16_t x, int16_t y, int16_t w, int16_t h);
    void flushPixels(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *src, int16_t stride,
                     bool dmaSafe, bool async);
    void spiFlushBeginWindow(int16_t x, int16_t y, int16_t w, int16_t h);
    void spiFlushWritePixels(const uint8_t *data, size_t len);
    void spiFlushEndWindow();
    static void spiFlushBeginThunk(void *user, int16_t x, int16_t y, int16_t w, int16_t h);
    static void spiFlushWriteThunk(void *user, const uint8_t *data, size_t len);
    static void spiFlushEndThunk(void *user);

    inline bool stripeTarget() const { return _stripeActive && _stripeBuf != nullptr; }
    inline bool hasTarget() const { return (_bufMode == BufferMode::Full && _buffer) || stripeTarget(); }
    inline bool inTarget(int16_t x, int16_t y) const {
        if (!pointInClip(x, y)) return false;
        if (_bufMode == BufferMode::Full && _buffer) return true;
        if (stripeTarget()) return _stripeWin.contains(x, y);
        return true;
    }
    inline uint16_t *targetAt(int16_t x, int16_t y) const {
        if (_bufMode == BufferMode::Full && _buffer) return &_buffer[(int32_t)y * _width + x];
        return &_stripeBuf[(int32_t)(y - _stripeWin.y) * _stripeWin.w + (x - _stripeWin.x)];
    }
    inline int16_t targetStride() const {
        return (_bufMode == BufferMode::Full && _buffer) ? _width : _stripeWin.w;
    }
    bool targetRect(int16_t &x, int16_t &y, int16_t &w, int16_t &h) const;
    Rect targetBounds() const;

    SPIClass *_spi;
    DisplayPins _pins;
    DisplayOptions _opt;
    SPISettings _spiSettings;
    SpiFlushContext _flushCtx;

    BufferMode _bufMode;
    BufferMemory _bufMem;
    uint32_t _bufMaxBytes;
    uint16_t *_buffer;
    uint16_t *_lineBuf;
    bool _bufferDmaSafe;

    uint16_t *_stripes[2];
    uint8_t _stripeCount;
    uint8_t _stripeIdx;
    uint16_t *_stripeBuf;
    size_t _stripeCap;
    uint16_t _stripeLines;
    bool _stripeDmaSafe;
    uint16_t _reqLines;

    int16_t _panelW;
    int16_t _panelH;
    int16_t _colStart;
    int16_t _rowStart;
    int16_t _colStart2;
    int16_t _rowStart2;
    int16_t _xstart;
    int16_t _ystart;
    uint8_t _madctl;

    int16_t _dx0;
    int16_t _dy0;
    int16_t _dx1;
    int16_t _dy1;
    bool _dirty;
    uint8_t _txDepth;
};

}

#endif
