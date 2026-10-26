#include "LucarneBar.h"
#include <stdio.h>

namespace lucarne {

Bar::Bar(int16_t x, int16_t y, int16_t w, int16_t h, const char *key, float min, float max)
    : Widget(x, y, w, h), _key(key), _min(min), _max(max), _color(0), _hasColor(false),
      _showValue(false), _transparentColor(false) {}

void Bar::setRange(float min, float max) {
    markDirty();
    _min = min;
    _max = max;
}

void Bar::setColor(uint16_t color) {
    markDirty();
    _color = color;
    _hasColor = true;
    _transparentColor = false;
}

void Bar::clearColor() { markDirty(); _transparentColor = true; _hasColor = false; }

void Bar::setValueFont(const AAFont *font) {
    markDirty();
    _valueStyle.font = font;
    _valueStyle.hasFont = true;
}

void Bar::setValueColor(uint16_t color) {
    markDirty();
    _valueStyle.color = color;
    _valueStyle.hasColor = true;
}

void Bar::setValueSize(uint8_t size) {
    markDirty();
    _valueStyle.size = size;
    _valueStyle.hasSize = true;
}

void Bar::setValueSpacing(int8_t spacing) {
    markDirty();
    _valueStyle.spacing = spacing;
    _valueStyle.hasSpacing = true;
}

void Bar::draw(Gfx &g, const Theme &theme, Store &store) {
    if (g.isCharacterGrid()) {
        float gspan = _max - _min;
        float gratio = gspan != 0.0f ? (store.getFloat(_key, _min) - _min) / gspan : 0.0f;
        if (gratio < 0.0f) gratio = 0.0f;
        if (gratio > 1.0f) gratio = 1.0f;
        g.drawGridBar(x, y, w, h, gratio);
        return;
    }
    int16_t r = h / 2;
    if (r > theme.radius) r = theme.radius;

    g.fillRoundRect(x, y, w, h, r, theme.surface);
    g.drawRoundRect(x, y, w, h, r, theme.surfaceEdge);

    float span = _max - _min;
    float ratio = span != 0.0f ? (store.getFloat(_key, _min) - _min) / span : 0.0f;
    if (ratio < 0.0f) ratio = 0.0f;
    if (ratio > 1.0f) ratio = 1.0f;

    int16_t inset = 2;
    int16_t trackW = (int16_t)(w - inset * 2);
    int16_t fillW = (int16_t)(trackW * ratio);
    uint16_t color = _hasColor ? _color : theme.primary;

    if (!_transparentColor && fillW > 0) {
        int16_t fr = (int16_t)(r - inset);
        if (fr < 0) fr = 0;
        g.fillRoundRect((int16_t)(x + inset), (int16_t)(y + inset), fillW, (int16_t)(h - inset * 2),
                        fr, color);
    }

    if (_showValue) {
        char buf[12];
        snprintf(buf, sizeof(buf), "%d%%", (int)(ratio * 100.0f + 0.5f));
        uint16_t txtBg = fillW > w / 2 ? color : theme.surface;
        drawStyledText(g, theme, buf, x, y, w, h, TextAlign::Center, txtBg, &_valueStyle, false);
    }
}

}
