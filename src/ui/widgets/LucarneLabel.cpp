#include "LucarneLabel.h"

namespace lucarne {

Label::Label(int16_t x, int16_t y, const char *text, TextAlign align)
    : Widget(x, y, 0, 0), _text(text), _align(align), _color(0), _hasColor(false), _size(0),
      _hasSize(false), _font(nullptr), _bg(0), _hasBg(false) {}

void Label::setText(const char *text) { _text = text; }

void Label::setColor(uint16_t color) {
    _color = color;
    _hasColor = true;
}

void Label::clearColor() { _hasColor = false; }

void Label::setSize(uint8_t size) {
    _size = size;
    _hasSize = true;
}

void Label::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    uint8_t size = _hasSize ? _size : theme.textSize;
    uint16_t color = _hasColor ? _color : theme.text;
    uint16_t bg = _hasBg ? _bg : theme.background;
    const AAFont *font = _font ? _font : theme.font;

    int16_t bw = w;
    int16_t bh = h;
    if (bw <= 0 || bh <= 0) {
        if (font) {
            int16_t minx = 0;
            int16_t miny = 0;
            int16_t tw = 0;
            int16_t th = 0;
            g.getAATextBounds(font, _text, &minx, &miny, &tw, &th);
            if (bw <= 0) bw = tw;
            if (bh <= 0) bh = th;
        } else {
            g.setFont(nullptr);
            g.setTextSize(size);
            int16_t tx1 = 0;
            int16_t ty1 = 0;
            uint16_t tw = 0;
            uint16_t th = 0;
            g.getTextBounds(_text, 0, 0, &tx1, &ty1, &tw, &th);
            if (bw <= 0) bw = (int16_t)tw;
            if (bh <= 0) bh = (int16_t)th;
        }
    }

    drawText(g, theme, _text, x, y, bw, bh, _align, color, size, bg, font);
}

}
