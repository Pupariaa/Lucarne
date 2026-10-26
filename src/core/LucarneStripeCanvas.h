#ifndef LUCARNE_STRIPE_CANVAS_H
#define LUCARNE_STRIPE_CANVAS_H

#include <stddef.h>
#include <stdint.h>
#include "LucarneGfx.h"

namespace lucarne {

class StripeCanvas : public Gfx {
  public:
    StripeCanvas(int16_t screenW, int16_t screenH);
    ~StripeCanvas() override;

    bool alloc(int16_t rows);
    bool allocPixels(size_t pixels);
    void release();
    bool allocated() const { return _buf != nullptr; }
    size_t capacity() const { return _cap; }
    int16_t rowsFor(int16_t w) const;

    bool setWindow(int16_t x, int16_t y, int16_t w, int16_t h);
    Rect window() const { return _win; }
    int16_t stride() const { return _win.w; }
    uint16_t *data() { return _buf; }
    const uint16_t *data() const { return _buf; }
    uint16_t *rowPtr(int16_t y) { return _buf + (size_t)(y - _win.y) * (size_t)_win.w; }
    const uint16_t *rowPtr(int16_t y) const { return _buf + (size_t)(y - _win.y) * (size_t)_win.w; }

    void writePixel(int16_t x, int16_t y, uint16_t color) override;
    void writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) override;
    void writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) override;
    void writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) override;

    bool canPeekPixel() const override { return _buf != nullptr; }
    uint16_t peekPixel(int16_t x, int16_t y) const override;

    void writeBufferRect(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *src) override;
    void readBufferRectNative(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t *dst) override;

  private:
    uint16_t *_buf;
    size_t _cap;
    Rect _win;
};

}

#endif
