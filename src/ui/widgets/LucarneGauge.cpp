#include "LucarneGauge.h"
#include <math.h>

namespace lucarne {

Gauge::Gauge(int16_t x, int16_t y, int16_t w, int16_t h, const char *label, const char *key,
             float minV, float maxV)
    : Widget(x, y, w, h), _label(label), _key(key), _min(minV), _max(maxV), _accent(0) {}

void Gauge::draw(Gfx &g, const Theme &theme, Store &store) {
    float v = _key ? store.getFloat(_key, _min) : _min;
    if (v < _min) v = _min;
    if (v > _max) v = _max;
    float span = _max - _min;
    float ratio = span > 0.0f ? (v - _min) / span : 0.0f;
    uint16_t accent = _accent ? _accent : theme.primary;
    int16_t cx = (int16_t)(x + w / 2);
    int16_t cy = (int16_t)(y + h * 55 / 100);
    int16_t r = w / 3;
    if (r > h / 2) r = h / 2;
    if (r < 8) r = 8;
    g.drawCircle(cx, cy, r, theme.surfaceEdge);
    int16_t arcEnd = (int16_t)(180.0f * ratio);
    for (int16_t a = 0; a <= arcEnd; a++) {
        float rad = (float)(180 - a) * 3.14159265f / 180.0f;
        int16_t px = (int16_t)(cx + cosf(rad) * r);
        int16_t py = (int16_t)(cy - sinf(rad) * r);
        g.drawPixel(px, py, accent);
    }
    char buf[16];
    dtostrf(v, 0, 1, buf);
    drawText(g, theme, _label ? _label : "", x, (int16_t)(y + 2), w, (int16_t)(h / 3),
             TextAlign::Center, theme.textDim, theme.textSize, theme.background, theme.font);
    drawText(g, theme, buf, x, (int16_t)(cy + r / 2), w, (int16_t)(h / 3), TextAlign::Center,
             theme.text, theme.textSize, theme.background, theme.font);
}

}
