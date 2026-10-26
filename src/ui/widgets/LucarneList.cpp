#include "LucarneList.h"
#include <string.h>

namespace lucarne {

List::List(int16_t x, int16_t y, int16_t w, int16_t h)
    : Widget(x, y, w, h), _count(0), _selected(0), _scroll(0), _focused(false), _editing(false) {
    memset(_itemStyles, 0, sizeof(_itemStyles));
}

void List::addItem(const char *label) {
    markDirty();
    if (_count >= MAX_ITEMS) return;
    _items[_count++] = label;
}

void List::setItemStyle(uint8_t index, const TextStyle &style) {
    markDirty();
    if (index >= _count) return;
    _itemStyles[index] = style;
}

void List::setTextFont(const AAFont *font) {
    markDirty();
    _textStyle.font = font;
    _textStyle.hasFont = true;
}

void List::setTextColor(uint16_t color) {
    markDirty();
    _textStyle.color = color;
    _textStyle.hasColor = true;
    _textStyle.transparent = false;
}

void List::setTextTransparent(bool transparent) { markDirty(); _textStyle.transparent = transparent; }

void List::setTextSize(uint8_t size) {
    markDirty();
    _textStyle.size = size;
    _textStyle.hasSize = true;
}

void List::setTextSpacing(int8_t spacing) {
    markDirty();
    _textStyle.spacing = spacing;
    _textStyle.hasSpacing = true;
}

void List::clearItems() {
    markDirty();
    _count = 0;
    _selected = 0;
    _scroll = 0;
    memset(_itemStyles, 0, sizeof(_itemStyles));
}

void List::moveSelection(int direction) {
    markDirty();
    if (_count == 0) return;
    _selected += direction > 0 ? 1 : -1;
    if (_selected < 0) _selected = _count - 1;
    if (_selected >= _count) _selected = 0;
}

void List::setSelected(int index) {
    markDirty();
    if (_count == 0) return;
    if (index < 0) index = 0;
    if (index >= _count) index = _count - 1;
    _selected = index;
}

const char *List::selectedLabel() const {
    if (_count == 0 || _selected < 0 || _selected >= _count) return "";
    return _items[_selected];
}

int List::rowAt(int16_t py, int16_t rowHeight) const {
    if (_count == 0 || rowHeight <= 0) return -1;
    int row = (int)((py - y) / rowHeight);
    int idx = _scroll + row;
    if (idx < 0 || idx >= _count) return -1;
    return idx;
}

void List::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    if (_count == 0) return;
    if (g.isCharacterGrid()) {
        int16_t cellH = g.gridCellHeight();
        if (cellH < 1) cellH = 1;
        int16_t lines = h / cellH;
        if (lines < 1) lines = 1;
        if (_selected < _scroll) _scroll = _selected;
        if (_selected >= _scroll + lines) _scroll = _selected - lines + 1;
        if (_scroll < 0) _scroll = 0;
        for (int16_t row = 0; row < lines; row++) {
            int idx = _scroll + row;
            if (idx >= _count) break;
            g.drawGridText(x, (int16_t)(y + row * cellH), w, cellH, _items[idx], (uint8_t)TextAlign::Left,
                           idx == _selected && (_focused || _editing));
        }
        return;
    }
    int16_t rowH = theme.rowHeight;
    if (rowH < 14) rowH = 14;
    int16_t visible = h / rowH;
    if (visible < 1) visible = 1;

    if (_selected < _scroll) _scroll = _selected;
    if (_selected >= _scroll + visible) _scroll = _selected - visible + 1;
    if (_scroll < 0) _scroll = 0;

    int16_t gap = 2;
    for (int16_t row = 0; row < visible; row++) {
        int idx = _scroll + row;
        if (idx >= _count) break;
        bool sel = (idx == _selected);
        int16_t ry = (int16_t)(y + row * rowH);
        int16_t rh = (int16_t)(rowH - gap);
        uint16_t fill = (sel && _editing) ? theme.primary : theme.surface;
        g.fillRoundRect(x, ry, w, rh, theme.radius, fill);
        g.drawRoundRect(x, ry, w, rh, theme.radius, sel ? theme.primary : theme.surfaceEdge);
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
        if (sel && _editing) {
            style.color = theme.background;
            style.hasColor = true;
        }
        drawStyledText(g, theme, _items[idx], (int16_t)(x + theme.padding), ry,
                         (int16_t)(w - theme.padding * 2), rh, TextAlign::Left, fill,
                         &style, false);
    }

    if (_focused) {
        g.drawRoundRect(x, y, w, h, theme.radius, theme.primary);
        g.drawRoundRect((int16_t)(x + 1), (int16_t)(y + 1), (int16_t)(w - 2), (int16_t)(h - 2),
                        theme.radius, theme.primary);
    }
}

}
