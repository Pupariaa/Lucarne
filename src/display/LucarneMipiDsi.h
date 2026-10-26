#ifndef LUCARNE_MIPI_DSI_H
#define LUCARNE_MIPI_DSI_H

#include "../core/LucarneGfx.h"
#include "../core/LucarneTypes.h"

namespace lucarne {

class MipiDisplay : public Gfx {
  public:
    MipiDisplay();
    ~MipiDisplay() override;

    bool begin(const MipiDisplayConfig &cfg, const BufferOptions &buffer = BufferOptions(),
               uint8_t rotation = 0);

    void setRotation(uint8_t rotation);
    uint8_t rotation() const { return _rotation; }
    void logicalFromNative(int16_t px, int16_t py, int16_t &lx, int16_t &ly) const;

    void display();
    void display(int16_t x, int16_t y, int16_t w, int16_t h);
    void backlight(bool on);

    void writePixel(int16_t x, int16_t y, uint16_t color) override;
    void writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) override;
    void writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) override;
    void writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) override;
    void startWrite() override;
    void endWrite() override;

    bool canPeekPixel() const override;
    uint16_t peekPixel(int16_t x, int16_t y) const override;

    BufferMode bufferMode() const override { return _bufMode; }
    bool hasBuffer() const override { return _buffer != nullptr; }
    uint16_t *buffer() override { return _buffer; }

    void presentFull() override;
    void presentDirty() override;
    void invalidateRegion(int16_t x, int16_t y, int16_t w, int16_t h) override;
    bool displayDirtyRegion(int16_t &x, int16_t &y, int16_t &w, int16_t &h) const override;
    void flushArea(int16_t x, int16_t y, int16_t w, int16_t h) override;
    void writeBufferRect(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *src) override;
    void blitBufferRect(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *srcPacked) override;
    void readBufferRectNative(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t *dst) override;
    uint16_t *allocFrame() override;
    void freeFrame(uint16_t *p) override;
    void snapshotFrame(uint16_t *dst) override;

    bool flushRect(int16_t x, int16_t y, int16_t w, int16_t h) override;
    bool supportsPartialPresent() const override;
    uint16_t partialLines() const override { return _stripeLines; }
    int16_t stripeRowsFor(int16_t w) const override;
    bool beginStripe(int16_t x, int16_t y, int16_t w, int16_t h) override;
    void endStripe() override;
    void discardDirty() override { _dirty = false; }
    void flushWait() override;

    void *i2cBus() const { return _i2cBus; }

  private:
    bool i2cWriteReg(uint8_t addr, uint8_t reg, uint8_t value);
    bool initPanel();
    bool initBacklight();
    bool setBacklightLevel(uint8_t level);
    bool allocBuffer();
    void freeBuffer();
    bool allocStripe();
    void freeStripe();
    bool allocBlocks(size_t pixels);
    void freeBlocks();
    void markDirty(int16_t x, int16_t y, int16_t w, int16_t h);
    void flushRegion(int16_t x, int16_t y, int16_t w, int16_t h);
    void flushLogical(const uint16_t *src, int16_t srcStride, int16_t picH, int16_t x, int16_t y, int16_t w,
                      int16_t h, bool async);
    void rotateChunkSw(const uint16_t *src, int16_t srcStride, int16_t w, int16_t h, uint16_t *dst);
    void fillDirect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
    void applyRotation(uint8_t rotation);
    void nativeFromLogical(int16_t lx, int16_t ly, int16_t &px, int16_t &py) const;
    void nativeRectFromLogical(int16_t x, int16_t y, int16_t w, int16_t h, int16_t &nx, int16_t &ny,
                               int16_t &nw, int16_t &nh) const;
    uint16_t *nextBlock();

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
    bool targetRect(int16_t &x, int16_t &y, int16_t &w, int16_t &h) const;
    Rect targetBounds() const;

    MipiDisplayConfig _cfg;
    int16_t _panelW;
    int16_t _panelH;
    uint8_t _rotation;
    BufferMode _bufMode;
    BufferMemory _bufMem;
    uint32_t _bufMaxBytes;
    uint16_t _reqLines;

    uint16_t *_buffer;

    uint16_t *_stripes[2];
    uint8_t _stripeCount;
    uint8_t _stripeIdx;
    uint16_t *_stripeBuf;
    size_t _stripeCap;
    uint16_t _stripeLines;

    uint16_t *_blocks[2];
    size_t _blockCap;
    uint8_t _blockIdx;

    int16_t _dx0;
    int16_t _dy0;
    int16_t _dx1;
    int16_t _dy1;
    bool _dirty;

    void *_panel;
    void *_panelIo;
    void *_dsiBus;
    void *_i2cBus;
    uint8_t _blLevel;
};

}

#endif
