#include "LucarneMetric.h"
#include <stdio.h>
#include <string.h>

namespace lucarne {

Metric::Metric(int16_t x, int16_t y, int16_t w, int16_t h, const char *label, const char *key,
               const char *unit)
    : Widget(x, y, w, h), _label(label), _key(key), _unit(unit ? unit : ""), _decimals(1),
      _accent(0), _hasAccent(false) {}

void Metric::setAccent(uint16_t color) {
    _accent = color;
    _hasAccent = true;
}

void Metric::clearAccent() { _hasAccent = false; }

void Metric::formatValue(const Store &store, char *out, uint8_t outLen) const {
    ValueType t = store.typeOf(_key);
    if (t == ValueType::String) {
        snprintf(out, outLen, "%s", store.getString(_key, "--"));
        return;
    }
    if (t == ValueType::None) {
        snprintf(out, outLen, "--%s", _unit);
        return;
    }
    if (t == ValueType::Bool) {
        snprintf(out, outLen, "%s", store.getBool(_key) ? "ON" : "OFF");
        return;
    }
    if (_decimals == 0) {
        snprintf(out, outLen, "%ld%s", store.getInt(_key), _unit);
    } else {
        snprintf(out, outLen, "%.*f%s", (int)_decimals, store.getFloat(_key), _unit);
    }
}

void Metric::draw(Gfx &g, const Theme &theme, Store &store) {
    int16_t r = theme.radius;
    g.fillRoundRect(x, y, w, h, r, theme.surface);
    g.drawRoundRect(x, y, w, h, r, theme.surfaceEdge);

    uint16_t accent = _hasAccent ? _accent : theme.primary;
    int16_t barW = 4;
    int16_t barH = (int16_t)(h - theme.padding);
    int16_t barY = (int16_t)(y + (h - barH) / 2);
    g.fillRoundRect((int16_t)(x + 3), barY, barW, barH, 2, accent);

    int16_t pad = theme.padding;
    int16_t contentX = (int16_t)(x + 3 + barW + pad);
    int16_t contentW = (int16_t)(w - (3 + barW + pad) - pad);

    int16_t labelW = (int16_t)(contentW * 6 / 10);
    int16_t valueW = (int16_t)(contentW - labelW);

    drawText(g, theme, _label, contentX, y, labelW, h, TextAlign::Left, theme.textDim,
             theme.textSize, theme.surface, theme.font);

    char buf[40];
    formatValue(store, buf, sizeof(buf));
    drawText(g, theme, buf, (int16_t)(contentX + labelW), y, valueW, h, TextAlign::Right, theme.text,
             theme.textSize, theme.surface, theme.font);
}

}
