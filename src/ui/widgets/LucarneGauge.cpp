#include "LucarneGauge.h"
#include <math.h>
#include <stdio.h>

namespace lucarne {

Gauge::Gauge(int16_t x, int16_t y, int16_t w, int16_t h, const char *label, const char *key,
             float minV, float maxV)
    : Widget(x, y, w, h), _label(label), _key(key), _min(minV), _max(maxV), _accent(0), _hasAccent(false) {}

void Gauge::setAccent(uint16_t c) {
    _accent = c;
    _hasAccent = true;
}

void Gauge::clearAccent() { _hasAccent = false; }

void Gauge::setLabelFont(const AAFont *font) {
    _labelStyle.font = font;
    _labelStyle.hasFont = true;
}

void Gauge::setLabelColor(uint16_t color) {
    _labelStyle.color = color;
    _labelStyle.hasColor = true;
    _labelStyle.transparent = false;
}

void Gauge::setLabelTransparent(bool transparent) { _labelStyle.transparent = transparent; }

void Gauge::setLabelSize(uint8_t size) {
    _labelStyle.size = size;
    _labelStyle.hasSize = true;
}

void Gauge::setLabelSpacing(int8_t spacing) {
    _labelStyle.spacing = spacing;
    _labelStyle.hasSpacing = true;
}

void Gauge::setValueFont(const AAFont *font) {
    _valueStyle.font = font;
    _valueStyle.hasFont = true;
}

void Gauge::setValueColor(uint16_t color) {
    _valueStyle.color = color;
    _valueStyle.hasColor = true;
    _valueStyle.transparent = false;
}

void Gauge::setValueTransparent(bool transparent) { _valueStyle.transparent = transparent; }

void Gauge::setValueSize(uint8_t size) {
    _valueStyle.size = size;
    _valueStyle.hasSize = true;
}

void Gauge::setValueSpacing(int8_t spacing) {
    _valueStyle.spacing = spacing;
    _valueStyle.hasSpacing = true;
}

void Gauge::draw(Gfx &g, const Theme &theme, Store &store) {
    float v = _key ? store.getFloat(_key, _min) : _min;
    if (v < _min) v = _min;
    if (v > _max) v = _max;
    float span = _max - _min;
    float ratio = span > 0.0f ? (v - _min) / span : 0.0f;
    uint16_t accent = _hasAccent ? _accent : theme.primary;
    int16_t cx = (int16_t)(x + w / 2);
    int16_t cy = (int16_t)(y + h * 55 / 100);
    int16_t r = w / 3;
    if (r > h / 2) r = h / 2;
    if (r < 8) r = 8;
    g.drawCircle(cx, cy, r, theme.surfaceEdge);
    if (_hasAccent) {
        int16_t arcEnd = (int16_t)(180.0f * ratio);
        for (int16_t a = 0; a <= arcEnd; a++) {
            float rad = (float)(180 - a) * 3.14159265f / 180.0f;
            int16_t px = (int16_t)(cx + cosf(rad) * r);
            int16_t py = (int16_t)(cy - sinf(rad) * r);
            g.drawPixel(px, py, accent);
        }
    }
    char buf[16];
    snprintf(buf, sizeof(buf), "%.1f", (double)v);
    drawStyledText(g, theme, _label ? _label : "", x, (int16_t)(y + 2), w, (int16_t)(h / 3),
                   TextAlign::Center, theme.background, &_labelStyle, true);
    drawStyledText(g, theme, buf, x, (int16_t)(cy + r / 2), w, (int16_t)(h / 3), TextAlign::Center,
                   theme.background, &_valueStyle, false);
}

}
