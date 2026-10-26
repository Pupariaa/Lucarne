#ifndef LUCARNE_RECT_H
#define LUCARNE_RECT_H

#include <stdint.h>

namespace lucarne {

struct Rect {
    int16_t x = 0;
    int16_t y = 0;
    int16_t w = 0;
    int16_t h = 0;

    Rect() {}
    Rect(int16_t rx, int16_t ry, int16_t rw, int16_t rh) : x(rx), y(ry), w(rw), h(rh) {}

    bool empty() const { return w <= 0 || h <= 0; }
    int32_t area() const { return empty() ? 0 : (int32_t)w * (int32_t)h; }
    int16_t right() const { return (int16_t)(x + w); }
    int16_t bottom() const { return (int16_t)(y + h); }

    bool contains(int16_t px, int16_t py) const {
        return px >= x && py >= y && px < x + w && py < y + h;
    }

    bool contains(const Rect &o) const {
        if (o.empty()) return true;
        return o.x >= x && o.y >= y && o.x + o.w <= x + w && o.y + o.h <= y + h;
    }

    bool intersects(const Rect &o) const {
        if (empty() || o.empty()) return false;
        return x < o.x + o.w && o.x < x + w && y < o.y + o.h && o.y < y + h;
    }

    Rect intersect(const Rect &o) const {
        int32_t x0 = x > o.x ? x : o.x;
        int32_t y0 = y > o.y ? y : o.y;
        int32_t x1 = (int32_t)x + w < (int32_t)o.x + o.w ? (int32_t)x + w : (int32_t)o.x + o.w;
        int32_t y1 = (int32_t)y + h < (int32_t)o.y + o.h ? (int32_t)y + h : (int32_t)o.y + o.h;
        if (x1 <= x0 || y1 <= y0) return Rect();
        return Rect((int16_t)x0, (int16_t)y0, (int16_t)(x1 - x0), (int16_t)(y1 - y0));
    }

    Rect unite(const Rect &o) const {
        if (empty()) return o;
        if (o.empty()) return *this;
        int32_t x0 = x < o.x ? x : o.x;
        int32_t y0 = y < o.y ? y : o.y;
        int32_t x1 = (int32_t)x + w > (int32_t)o.x + o.w ? (int32_t)x + w : (int32_t)o.x + o.w;
        int32_t y1 = (int32_t)y + h > (int32_t)o.y + o.h ? (int32_t)y + h : (int32_t)o.y + o.h;
        return Rect((int16_t)x0, (int16_t)y0, (int16_t)(x1 - x0), (int16_t)(y1 - y0));
    }

    Rect inflate(int16_t d) const {
        if (empty()) return *this;
        return Rect((int16_t)(x - d), (int16_t)(y - d), (int16_t)(w + 2 * d), (int16_t)(h + 2 * d));
    }
};

}

#endif
