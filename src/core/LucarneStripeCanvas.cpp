#include "LucarneStripeCanvas.h"
#include <stdlib.h>
#include <string.h>

#if defined(ESP_PLATFORM) || defined(ARDUINO_ARCH_ESP32)
#include <esp_heap_caps.h>
#define LUCARNE_CANVAS_HEAP_CAPS 1
#endif

namespace lucarne {

static uint16_t *canvasAlloc(size_t bytes) {
#ifdef LUCARNE_CANVAS_HEAP_CAPS
    void *p = heap_caps_malloc(bytes, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    if (!p) p = heap_caps_malloc(bytes, MALLOC_CAP_8BIT);
    return (uint16_t *)p;
#else
    return (uint16_t *)malloc(bytes);
#endif
}

static void canvasFree(void *p) {
    if (!p) return;
#ifdef LUCARNE_CANVAS_HEAP_CAPS
    heap_caps_free(p);
#else
    free(p);
#endif
}

StripeCanvas::StripeCanvas(int16_t screenW, int16_t screenH)
    : Gfx(screenW, screenH), _buf(nullptr), _cap(0) {}

StripeCanvas::~StripeCanvas() { release(); }

bool StripeCanvas::alloc(int16_t rows) {
    if (rows < 1) rows = 1;
    return allocPixels((size_t)rows * (size_t)_width);
}

bool StripeCanvas::allocPixels(size_t pixels) {
    if (pixels == 0) return false;
    if (_buf && _cap >= pixels) return true;
    release();
    _buf = canvasAlloc(pixels * sizeof(uint16_t));
    if (!_buf) return false;
    _cap = pixels;
    return true;
}

void StripeCanvas::release() {
    canvasFree(_buf);
    _buf = nullptr;
    _cap = 0;
    _win = Rect();
    resetClipRect();
}

int16_t StripeCanvas::rowsFor(int16_t w) const {
    if (w < 1 || !_buf) return 0;
    size_t rows = _cap / (size_t)w;
    if (rows > (size_t)_height) rows = (size_t)_height;
    return (int16_t)rows;
}

bool StripeCanvas::setWindow(int16_t x, int16_t y, int16_t w, int16_t h) {
    Rect r = Rect(x, y, w, h).intersect(Rect(0, 0, _width, _height));
    if (r.empty() || !_buf) return false;
    if ((size_t)r.w * (size_t)r.h > _cap) return false;
    _win = r;
    setClipRect(r);
    return true;
}

void StripeCanvas::writePixel(int16_t x, int16_t y, uint16_t color) {
    if (!_buf || !pointInClip(x, y) || !_win.contains(x, y)) return;
    rowPtr(y)[x - _win.x] = color;
}

void StripeCanvas::writeFillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    if (!_buf) return;
    if (!clipToActive(x, y, w, h)) return;
    Rect r = Rect(x, y, w, h).intersect(_win);
    if (r.empty()) return;
    for (int16_t yy = r.y; yy < r.bottom(); yy++) {
        uint16_t *dst = rowPtr(yy) + (r.x - _win.x);
        for (int16_t i = 0; i < r.w; i++) dst[i] = color;
    }
}

void StripeCanvas::writeFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) {
    writeFillRect(x, y, w, 1, color);
}

void StripeCanvas::writeFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) {
    writeFillRect(x, y, 1, h, color);
}

uint16_t StripeCanvas::peekPixel(int16_t x, int16_t y) const {
    if (!_buf || !_win.contains(x, y)) return 0;
    return rowPtr(y)[x - _win.x];
}

void StripeCanvas::writeBufferRect(int16_t x, int16_t y, int16_t w, int16_t h, const uint16_t *src) {
    if (!_buf || !src || w < 1 || h < 1) return;
    Rect r = Rect(x, y, w, h).intersect(_win).intersect(clipRect());
    if (r.empty()) return;
    for (int16_t yy = r.y; yy < r.bottom(); yy++) {
        memcpy(rowPtr(yy) + (r.x - _win.x), src + (size_t)(yy - y) * (size_t)w + (size_t)(r.x - x),
               (size_t)r.w * sizeof(uint16_t));
    }
}

void StripeCanvas::readBufferRectNative(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t *dst) {
    if (!_buf || !dst || w < 1 || h < 1) return;
    Rect r = Rect(x, y, w, h).intersect(_win);
    if (r.empty()) return;
    for (int16_t yy = r.y; yy < r.bottom(); yy++) {
        memcpy(dst + (size_t)(yy - y) * (size_t)w + (size_t)(r.x - x), rowPtr(yy) + (r.x - _win.x),
               (size_t)r.w * sizeof(uint16_t));
    }
}

}
