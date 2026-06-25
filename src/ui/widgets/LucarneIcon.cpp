#include "LucarneIcon.h"
#include "../LucarneIconDraw.h"

namespace lucarne {

Icon::Icon(int16_t x, int16_t y, const char *ref, uint8_t scale)
    : Widget(x, y, 16, 16), _ref(ref), _scale(scale < 1 ? 1 : scale), _color(0), _hasColor(false) {
    syncBounds();
}

void Icon::setIconRef(const char *ref) {
    _ref = ref;
    syncBounds();
}

void Icon::setScale(uint8_t scale) {
    _scale = scale < 1 ? 1 : scale;
    syncBounds();
}

void Icon::syncBounds() {
    int16_t base = iconRefBaseSize(_ref);
    if (base < 1) base = 16;
    w = (int16_t)(base * _scale);
    h = (int16_t)(base * _scale);
}

void Icon::setColor(uint16_t color) {
    _color = color;
    _hasColor = true;
}

void Icon::clearColor() { _hasColor = false; }

void Icon::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    uint16_t tint = _hasColor ? _color : theme.text;
    uint16_t bg = theme.background;
    drawIconRef(g, _ref, x, y, w, h, tint, bg);
}

}
