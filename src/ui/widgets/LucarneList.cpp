#include "LucarneList.h"
#include <string.h>

namespace lucarne {

List::List(int16_t x, int16_t y, int16_t w, int16_t h)
    : Widget(x, y, w, h), _count(0), _scroll(0) {
    memset(_itemStyles, 0, sizeof(_itemStyles));
}

void List::addItem(const char *label) {
    if (_count >= MAX_ITEMS) return;
    _items[_count++] = label;
}

void List::setItemStyle(uint8_t index, const TextStyle &style) {
    if (index >= _count) return;
    _itemStyles[index] = style;
}

void List::setTextFont(const AAFont *font) {
    _textStyle.font = font;
    _textStyle.hasFont = true;
}

void List::setTextColor(uint16_t color) {
    _textStyle.color = color;
    _textStyle.hasColor = true;
    _textStyle.transparent = false;
}

void List::setTextTransparent(bool transparent) { _textStyle.transparent = transparent; }

void List::setTextSize(uint8_t size) {
    _textStyle.size = size;
    _textStyle.hasSize = true;
}

void List::setTextSpacing(int8_t spacing) {
    _textStyle.spacing = spacing;
    _textStyle.hasSpacing = true;
}

void List::clearItems() {
    _count = 0;
    _scroll = 0;
    memset(_itemStyles, 0, sizeof(_itemStyles));
}

void List::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    if (_count == 0) return;
    int16_t rowH = theme.rowHeight;
    if (rowH < 14) rowH = 14;
    int16_t visible = h / rowH;
    if (visible < 1) visible = 1;
    if (_scroll < 0) _scroll = 0;
    int16_t gap = 2;
    for (int16_t row = 0; row < visible; row++) {
        int idx = _scroll + row;
        if (idx >= _count) break;
        int16_t ry = (int16_t)(y + row * rowH);
        int16_t rh = (int16_t)(rowH - gap);
        g.fillRoundRect(x, ry, w, rh, theme.radius, theme.surface);
        g.drawRoundRect(x, ry, w, rh, theme.radius, theme.surfaceEdge);
        TextStyle style = _textStyle;
        const TextStyle &item = _itemStyles[idx];
        if (item.hasFont) {
            style.font = item.font;
            style.hasFont = true;
        }
        if (item.hasColor) {
            style.color = item.color;
            style.hasColor = true;
        }
        if (item.hasSize) {
            style.size = item.size;
            style.hasSize = true;
        }
        if (item.hasSpacing) {
            style.spacing = item.spacing;
            style.hasSpacing = true;
        }
        drawStyledText(g, theme, _items[idx], (int16_t)(x + theme.padding), ry,
                         (int16_t)(w - theme.padding * 2), rh, TextAlign::Left, theme.surface,
                         &style, false);
    }
}

}
