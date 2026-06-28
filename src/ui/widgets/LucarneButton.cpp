#include "LucarneButton.h"
#include "../LucarneIconDraw.h"

namespace lucarne {

Button::Button(int16_t x, int16_t y, int16_t w, int16_t h, const char *label)
    : Widget(x, y, w, h), _label(label), _icon(nullptr), _target(nullptr),
      _transition(Transition::Inherit), _actionId(0), _isCallback(false), _fill(0), _textColor(0),
      _hasColors(false), _transparentFill(false), _transparentTextColor(false), _textAlign(TextAlign::Center) {}

void Button::setNavigate(Screen *target, Transition t) {
    _target = target;
    _transition = t;
    _isCallback = false;
    _actionId = 0;
}

void Button::setCallback(uint8_t actionId) {
    _actionId = actionId;
    _isCallback = true;
    _target = nullptr;
}

void Button::setColor(uint16_t fill, uint16_t text) {
    _fill = fill;
    _textColor = text;
    _hasColors = true;
    _transparentFill = false;
    _transparentTextColor = false;
}

void Button::setFillTransparent(bool transparent) { _transparentFill = transparent; }

void Button::setTextColorTransparent(bool transparent) { _transparentTextColor = transparent; }

void Button::setTextTransparent(bool transparent) { _textStyle.transparent = transparent; }

void Button::setTextFont(const AAFont *font) {
    _textStyle.font = font;
    _textStyle.hasFont = true;
}

void Button::setTextColor(uint16_t color) {
    _textStyle.color = color;
    _textStyle.hasColor = true;
}

void Button::setTextSize(uint8_t size) {
    _textStyle.size = size;
    _textStyle.hasSize = true;
}

void Button::setTextSpacing(int8_t spacing) {
    _textStyle.spacing = spacing;
    _textStyle.hasSpacing = true;
}

bool Button::hitTest(int16_t px, int16_t py) const {
    return px >= x && py >= y && px < x + w && py < y + h;
}

void Button::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    uint16_t fill = _hasColors ? _fill : theme.primary;
    TextStyle style = _textStyle;
    if (_hasColors && !style.hasColor && !_transparentTextColor) {
        style.color = _textColor;
        style.hasColor = true;
    }
    if (!_transparentFill) g.fillRoundRect(x, y, w, h, theme.radius, fill);
    g.drawRoundRect(x, y, w, h, theme.radius, theme.surfaceEdge);
    int16_t pad = theme.padding;
    int16_t contentX = (int16_t)(x + pad);
    uint16_t iconColor = style.hasColor ? style.color : (_hasColors ? _textColor : theme.background);
    if (iconRefValid(_icon)) {
        int16_t side = h - pad * 2;
        if (side > 20) side = 20;
        if (side < 8) side = 8;
        int16_t iy = (int16_t)(y + (h - side) / 2);
        uint16_t iconBg = _transparentFill ? theme.background : fill;
        drawIconRef(g, _icon, contentX, iy, side, side, iconColor, iconBg);
        contentX += (int16_t)(side + pad);
    }
    int16_t lw = (int16_t)(x + w - pad - contentX);
    if (!style.transparent && !_transparentTextColor) {
        uint16_t textBg = _transparentFill ? theme.background : fill;
        drawStyledText(g, theme, _label ? _label : "", contentX, y, lw, h, _textAlign, textBg, &style,
                       false);
    }
}

}
