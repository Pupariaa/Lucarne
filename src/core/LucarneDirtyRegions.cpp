#include "LucarneDirtyRegions.h"

namespace lucarne {

DirtyRegionList::DirtyRegionList() : _count(0), _full(false) {}

void DirtyRegionList::setScreen(int16_t w, int16_t h) {
    _screen = Rect(0, 0, w, h);
    if (_full) {
        _rects[0] = _screen;
        _count = 1;
    }
}

void DirtyRegionList::clear() {
    _count = 0;
    _full = false;
}

void DirtyRegionList::addFull() {
    _rects[0] = _screen;
    _count = _screen.empty() ? 0 : 1;
    _full = true;
}

int32_t DirtyRegionList::totalArea() const {
    int32_t sum = 0;
    for (uint8_t i = 0; i < _count; i++) sum += _rects[i].area();
    return sum;
}

Rect DirtyRegionList::bounds() const {
    Rect b;
    for (uint8_t i = 0; i < _count; i++) b = b.unite(_rects[i]);
    return b;
}

void DirtyRegionList::mergeAllToBoundingBox() {
    Rect b = bounds();
    _rects[0] = b;
    _count = b.empty() ? 0 : 1;
}

void DirtyRegionList::absorbContained() {
    uint8_t i = 0;
    while (i < _count) {
        bool removed = false;
        for (uint8_t j = 0; j < _count; j++) {
            if (j != i && _rects[j].contains(_rects[i])) {
                _rects[i] = _rects[--_count];
                removed = true;
                break;
            }
        }
        if (!removed) i++;
    }
}

void DirtyRegionList::add(const Rect &r) {
    if (_full) return;
    Rect c = r.intersect(_screen);
    if (c.empty()) return;
    for (uint8_t i = 0; i < _count; i++) {
        if (_rects[i].contains(c)) return;
    }
    _rects[_count++] = c;
    absorbContained();
    if (_count > kMaxDirtyRects) mergeAllToBoundingBox();
    int32_t screenArea = _screen.area();
    if (screenArea > 0 && (float)totalArea() > kMergeAreaRatio * (float)screenArea) {
        addFull();
    }
}

}
