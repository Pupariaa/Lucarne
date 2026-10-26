#include "LucarneLabel.h"

namespace lucarne {

Label::Label(int16_t x, int16_t y, const char *text, TextAlign align)
    : Widget(x, y, 0, 0), _text(text), _align(align), _color(0), _hasColor(false), _textTransparent(false),
      _size(0), _hasSize(false), _font(nullptr), _spacing(0), _hasSpacing(false), _bg(0), _hasBg(false) {}

void Label::setText(const char *text) { markDirty(); _text = text; }

void Label::setColor(uint16_t color) {
    markDirty();
    _color = color;
    _hasColor = true;
    _textTransparent = false;
}

void Label::clearColor() { markDirty(); _hasColor = false; }

void Label::setTextTransparent(bool transparent) { markDirty(); _textTransparent = transparent; }

void Label::setSize(uint8_t size) {
    markDirty();
    _size = size;
    _hasSize = true;
}

void Label::setSpacing(int8_t spacing) {
    markDirty();
    _spacing = spacing;
    _hasSpacing = true;
}

void Label::clearSpacing() { markDirty(); _hasSpacing = false; }

TextStyle Label::style() const {
    TextStyle style;
    if (_font) {
        style.font = _font;
        style.hasFont = true;
    }
    if (_hasSize) {
        style.size = _size;
        style.hasSize = true;
    }
    if (_hasColor) {
        style.color = _color;
        style.hasColor = true;
    }
    if (_hasSpacing) {
        style.spacing = _spacing;
        style.hasSpacing = true;
    }
    return style;
}

Rect Label::textBox(Gfx &g, const Theme &theme, const TextStyle &style) const {
    int16_t bw = w;
    int16_t bh = h;
    if ((bw <= 0 || bh <= 0) && _text && _text[0]) {
        const AAFont *font = style.hasFont ? style.font : theme.font;
        uint8_t size = style.hasSize ? style.size : theme.textSize;
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
    if (bw < 0) bw = 0;
    if (bh < 0) bh = 0;
    return Rect(x, y, bw, bh);
}

Rect Label::boundsLogical(Gfx &g, const Theme &theme) const {
    TextStyle st = style();
    Rect r = textBox(g, theme, st);
    if (r.empty()) return Rect(x, y, 0, 0);
    if (st.hasSpacing && st.spacing > 0 && _text) {
        int16_t n = 0;
        for (const char *p = _text; *p; p++) {
            if (((uint8_t)*p & 0xC0) != 0x80) n++;
        }
        int16_t extra = n > 1 ? (int16_t)(st.spacing * (n - 1)) : 0;
        if (_align == TextAlign::Left) {
            r.w = (int16_t)(r.w + extra);
        } else if (_align == TextAlign::Center) {
            r.x = (int16_t)(r.x - extra / 2 - 1);
            r.w = (int16_t)(r.w + extra + 2);
        } else {
            r.x = (int16_t)(r.x - extra);
            r.w = (int16_t)(r.w + extra);
        }
    }
    return r.inflate(2);
}

void Label::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    if (_textTransparent) return;
    TextStyle st = style();
    uint16_t bg = _hasBg ? _bg : theme.background;
    Rect box = textBox(g, theme, st);
    if (g.isCharacterGrid()) {
        g.drawGridText(x, y, box.w, box.h, _text, (uint8_t)_align, false);
        return;
    }
    drawStyledText(g, theme, _text, x, y, box.w, box.h, _align, bg, &st, false);
}

}
