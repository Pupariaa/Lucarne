#ifndef LUCARNE_DIRTY_REGIONS_H
#define LUCARNE_DIRTY_REGIONS_H

#include "LucarneRect.h"
#include "LucarneRenderConfig.h"

namespace lucarne {

class DirtyRegionList {
  public:
    DirtyRegionList();

    void setScreen(int16_t w, int16_t h);
    void add(const Rect &r);
    void add(int16_t x, int16_t y, int16_t w, int16_t h) { add(Rect(x, y, w, h)); }
    void addFull();
    void clear();

    uint8_t count() const { return _count; }
    const Rect &at(uint8_t i) const { return _rects[i]; }
    bool empty() const { return _count == 0; }
    bool isFull() const { return _full; }
    int32_t totalArea() const;
    Rect bounds() const;

  private:
    void mergeAllToBoundingBox();
    void absorbContained();

    Rect _screen;
    Rect _rects[kMaxDirtyRects + 1];
    uint8_t _count;
    bool _full;
};

}

#endif
