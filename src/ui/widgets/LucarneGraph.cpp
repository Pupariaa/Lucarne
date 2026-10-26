#include "LucarneGraph.h"
#include <string.h>

namespace lucarne {

Graph::Graph(int16_t x, int16_t y, int16_t w, int16_t h)
    : Widget(x, y, w, h), _type(GraphType::Line), _mode(GraphMode::Stream), _keyCount(0),
      _streamKey(nullptr), _capacity(32), _count(0), _head(0), _min(0.0f), _max(100.0f), _color(0),
      _hideLine(false), _grid(true) {
    for (uint8_t i = 0; i < MAX_KEYS; i++) _keys[i] = nullptr;
}

void Graph::setKey(uint8_t index, const char *key) {
    markDirty();
    if (index >= MAX_KEYS) return;
    _keys[index] = key;
    if (index >= _keyCount) _keyCount = (uint8_t)(index + 1);
}

void Graph::setCapacity(uint8_t capacity) {
    markDirty();
    if (capacity < 2) capacity = 2;
    if (capacity > MAX_CAPACITY) capacity = MAX_CAPACITY;
    _capacity = capacity;
    if (_count > _capacity) {
        _count = _capacity;
        _head = 0;
    }
}

void Graph::setColor(uint16_t c) {
    markDirty();
    _color = c;
    _hideLine = false;
}

void Graph::clearColor() { markDirty(); _hideLine = true; }

void Graph::push(float value) {
    markDirty();
    if (_capacity < 2) _capacity = 32;
    _buf[_head] = value;
    _head = (uint8_t)((_head + 1) % _capacity);
    if (_count < _capacity) _count++;
}

void Graph::clear() {
    markDirty();
    _count = 0;
    _head = 0;
}

uint8_t Graph::storeKeys(const char **out, uint8_t max) const {
    if (_mode == GraphMode::Stream) return appendKey(out, 0, max, _streamKey);
    uint8_t n = 0;
    for (uint8_t i = 0; i < _keyCount; i++) n = appendKey(out, n, max, _keys[i]);
    return n;
}

void Graph::onStoreKeyChanged(const char *key, Store &store) {
    if (_mode == GraphMode::Stream && _streamKey && key &&
        (key == _streamKey || strcmp(key, _streamKey) == 0)) {
        push(store.getFloat(_streamKey, _min));
        return;
    }
    markDirty();
}

float Graph::sampleAt(uint8_t index) const {
    if (_count == 0 || index >= _count) return _min;
    uint8_t start = (uint8_t)((_head + _capacity - _count) % _capacity);
    return _buf[(start + index) % _capacity];
}

float Graph::valueAt(Store &store, uint8_t index) const {
    if (_mode == GraphMode::Stream) {
        if (_streamKey) {
            return sampleAt(index);
        }
        return sampleAt(index);
    }
    const char *k = index < _keyCount ? _keys[index] : nullptr;
    float v = k ? store.getFloat(k, _min) : _min;
    if (v < _min) v = _min;
    if (v > _max) v = _max;
    return v;
}

uint8_t Graph::sampleCount(Store &store) const {
    (void)store;
    if (_mode == GraphMode::Stream) return _count;
    return _keyCount;
}

void Graph::drawGrid(Gfx &g, int16_t gx, int16_t gy, int16_t gw, int16_t gh, uint16_t color) {
    if (gw < 4 || gh < 4) return;
    g.drawFastHLine(gx, (int16_t)(gy + gh / 2), gw, color);
    g.drawFastVLine((int16_t)(gx + gw / 2), gy, gh, color);
    g.drawFastHLine(gx, gy, gw, color);
    g.drawFastHLine(gx, (int16_t)(gy + gh - 1), gw, color);
    g.drawFastVLine(gx, gy, gh, color);
    g.drawFastVLine((int16_t)(gx + gw - 1), gy, gh, color);
}

void Graph::drawLineSeries(Gfx &g, Store &store, int16_t gx, int16_t gy, int16_t gw, int16_t gh,
                           uint16_t color, bool fillArea) {
    uint8_t n = sampleCount(store);
    if (n < 2) return;
    float span = _max - _min;
    if (span <= 0.0f) span = 1.0f;
    int16_t baseY = (int16_t)(gy + gh - 1);
    int16_t px0 = gx;
    int16_t py0 = baseY;
    bool hasPrev = false;
    for (uint8_t i = 0; i < n; i++) {
        float v = valueAt(store, i);
        if (v < _min) v = _min;
        if (v > _max) v = _max;
        float ratio = (v - _min) / span;
        int16_t px = (int16_t)(gx + (gw * i) / (n - 1));
        int16_t py = (int16_t)(gy + gh - 1 - (int16_t)((gh - 1) * ratio));
        if (hasPrev) {
            g.drawLine(px0, py0, px, py, color);
            if (fillArea) {
                if (px0 != px) {
                    int16_t xLeft = px0 < px ? px0 : px;
                    int16_t xRight = px0 < px ? px : px0;
                    int16_t yTop0 = px0 < px ? py0 : py;
                    int16_t yTop1 = px0 < px ? py : py0;
                    for (int16_t xx = xLeft; xx <= xRight; xx++) {
                        float t = xRight == xLeft ? 0.0f : (float)(xx - xLeft) / (float)(xRight - xLeft);
                        int16_t yt = (int16_t)(yTop0 + (int16_t)((yTop1 - yTop0) * t));
                        if (yt < baseY) g.drawFastVLine(xx, yt, (int16_t)(baseY - yt + 1), color);
                    }
                }
            }
        }
        px0 = px;
        py0 = py;
        hasPrev = true;
    }
}

void Graph::draw(Gfx &g, const Theme &theme, Store &store) {
    uint8_t n = sampleCount(store);
    bool spark = _type == GraphType::Sparkline;
    int16_t pad = spark ? 1 : theme.padding;
    if (n < 2 && _mode == GraphMode::Keys) {
        if (!spark) g.drawRoundRect(x, y, w, h, theme.radius, theme.surfaceEdge);
        return;
    }
    if (!spark) g.drawRoundRect(x, y, w, h, theme.radius, theme.surfaceEdge);
    if (_hideLine) return;
    uint16_t line = _color ? _color : theme.primary;
    int16_t gx = (int16_t)(x + pad);
    int16_t gy = (int16_t)(y + pad);
    int16_t gw = (int16_t)(w - pad * 2);
    int16_t gh = (int16_t)(h - pad * 2);
    if (gw < 2 || gh < 2) return;
    if (_grid && !spark) drawGrid(g, gx, gy, gw, gh, theme.surfaceEdge);
    if (n < 2) return;
    float span = _max - _min;
    if (span <= 0.0f) span = 1.0f;
    if (_type == GraphType::Bar) {
        int16_t baseY = (int16_t)(gy + gh - 1);
        int16_t barW = (int16_t)(gw / n);
        if (barW < 1) barW = 1;
        int16_t gap = barW > 2 ? 1 : 0;
        for (uint8_t i = 0; i < n; i++) {
            float v = valueAt(store, i);
            if (v < _min) v = _min;
            if (v > _max) v = _max;
            float ratio = (v - _min) / span;
            int16_t bh = (int16_t)((gh - 1) * ratio);
            if (bh < 1 && ratio > 0.0f) bh = 1;
            int16_t bx = (int16_t)(gx + i * barW);
            int16_t bw = (int16_t)(barW - gap);
            if (bw < 1) bw = 1;
            g.fillRect(bx, (int16_t)(baseY - bh + 1), bw, bh, line);
        }
        return;
    }
    bool fillArea = _type == GraphType::Area;
    drawLineSeries(g, store, gx, gy, gw, gh, line, fillArea);
}

}
