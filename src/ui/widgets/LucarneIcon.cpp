#include "LucarneIcon.h"

namespace lucarne {

Icon::Icon(int16_t x, int16_t y, IconId id, uint8_t scale)
    : Widget(x, y, (int16_t)(ICON_W * (scale < 1 ? 1 : scale)),
             (int16_t)(ICON_H * (scale < 1 ? 1 : scale))),
      _id(id), _scale(scale < 1 ? 1 : scale), _color(0), _hasColor(false) {}

void Icon::setScale(uint8_t scale) {
    _scale = scale < 1 ? 1 : scale;
    w = (int16_t)(ICON_W * _scale);
    h = (int16_t)(ICON_H * _scale);
}

void Icon::setColor(uint16_t color) {
    _color = color;
    _hasColor = true;
}

void Icon::clearColor() { _hasColor = false; }

void Icon::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    uint16_t color = _hasColor ? _color : theme.text;
    drawIcon(g, iconData(_id), x, y, _scale, color);
}

}
