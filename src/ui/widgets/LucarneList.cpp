#include "LucarneList.h"

namespace lucarne {

List::List(int16_t x, int16_t y, int16_t w, int16_t h)
    : Widget(x, y, w, h), _count(0), _scroll(0) {}

void List::addItem(const char *label) {
    if (_count >= MAX_ITEMS) return;
    _items[_count++] = label;
}

void List::clearItems() {
    _count = 0;
    _scroll = 0;
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
        drawText(g, theme, _items[idx], (int16_t)(x + theme.padding), ry,
                 (int16_t)(w - theme.padding * 2), rh, TextAlign::Left, theme.text, theme.textSize,
                 theme.surface, theme.font);
    }
}

}
