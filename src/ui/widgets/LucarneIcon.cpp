#include "LucarneIcon.h"
#include "../LucarneIconDraw.h"
#include <Arduino.h>

namespace lucarne {

static inline uint8_t iconScaleTenths(uint8_t raw) {
    if (raw == 0) return 10;
    if (raw <= 4) return (uint8_t)(raw * 10);
    if (raw > 40) return 40;
    return raw;
}

static int16_t iconDrawSize(const char *ref, uint8_t scaleTenths) {
    int16_t base = iconRefBaseSize(ref);
    if (base < 1) base = 16;
    return (int16_t)((base * scaleTenths + 5) / 10);
}

Icon::Icon(int16_t x, int16_t y, const char *ref, uint8_t scale)
    : Widget(x, y, 16, 16), _ref(ref), _scaleTenths(iconScaleTenths(scale)), _color(0), _hasColor(false),
      _transparent(false) {
    int16_t side = iconDrawSize(_ref, _scaleTenths);
    w = side;
    h = side;
}

void Icon::setIconRef(const char *ref) {
    _ref = ref;
}

void Icon::setScale(uint8_t scale) {
    _scaleTenths = iconScaleTenths(scale);
}

void Icon::setColor(uint16_t color) {
    _color = color;
    _hasColor = true;
}

void Icon::clearColor() { _hasColor = false; }

void Icon::setTransparent(bool transparent) { _transparent = transparent; }

void Icon::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    if (_transparent) return;
    uint16_t tint = _hasColor ? _color : theme.text;
    uint16_t bg = theme.background;
    IconAnimDrawRect dr = iconAnimDrawRect(this);
    if (iconRefIsAnim(_ref)) {
        if (iconAnimDrawInitial(g, this, dr.x, dr.y, dr.w, dr.h, bg)) {
            syncAnimFrame(0);
            markAnimShown(iconAnimClockMs());
        }
        return;
    }
    drawIconRef(g, _ref, dr.x, dr.y, dr.w, dr.h, tint, bg);
}

}
