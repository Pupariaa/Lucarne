#include "LucarneChart.h"

namespace lucarne {

Chart::Chart(int16_t x, int16_t y, int16_t w, int16_t h)
    : Widget(x, y, w, h), _keyCount(0), _min(0.0f), _max(1.0f), _color(0) {
    for (uint8_t i = 0; i < MAX_KEYS; i++) _keys[i] = nullptr;
}

void Chart::setKey(uint8_t index, const char *key) {
    if (index >= MAX_KEYS) return;
    _keys[index] = key;
    if (index >= _keyCount) _keyCount = (uint8_t)(index + 1);
}

void Chart::draw(Gfx &g, const Theme &theme, Store &store) {
    if (_keyCount < 2) return;
    uint16_t line = _color ? _color : theme.primary;
    g.drawRoundRect(x, y, w, h, theme.radius, theme.surfaceEdge);
    int16_t pad = theme.padding;
    int16_t gx = (int16_t)(x + pad);
    int16_t gy = (int16_t)(y + pad);
    int16_t gw = (int16_t)(w - pad * 2);
    int16_t gh = (int16_t)(h - pad * 2);
    if (gw < 2 || gh < 2) return;
    float span = _max - _min;
    if (span <= 0.0f) span = 1.0f;
    int16_t px0 = gx;
    int16_t py0 = gy;
    for (uint8_t i = 0; i < _keyCount; i++) {
        float v = _keys[i] ? store.getFloat(_keys[i], _min) : _min;
        if (v < _min) v = _min;
        if (v > _max) v = _max;
        float ratio = (v - _min) / span;
        int16_t px = (int16_t)(gx + (gw * i) / (_keyCount - 1));
        int16_t py = (int16_t)(gy + gh - (int16_t)(gh * ratio));
        if (i > 0) g.drawLine(px0, py0, px, py, line);
        px0 = px;
        py0 = py;
    }
}

}
