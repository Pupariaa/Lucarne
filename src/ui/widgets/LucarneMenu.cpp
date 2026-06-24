#include "LucarneMenu.h"

namespace lucarne {

Menu::Menu(int16_t x, int16_t y, int16_t w, int16_t h)
    : Widget(x, y, w, h), _count(0), _selected(0), _scroll(0) {}

void Menu::addItem(const char *label, IconId icon, Screen *target, Transition transition) {
    if (_count >= MAX_ITEMS) return;
    _items[_count].label = label;
    _items[_count].icon = icon;
    _items[_count].target = target;
    _items[_count].transition = transition;
    _count++;
}

void Menu::clearItems() {
    _count = 0;
    _selected = 0;
    _scroll = 0;
}

void Menu::moveNext() {
    if (_count == 0) return;
    _selected++;
    if (_selected >= _count) _selected = 0;
}

void Menu::movePrev() {
    if (_count == 0) return;
    _selected--;
    if (_selected < 0) _selected = _count - 1;
}

void Menu::setSelected(int index) {
    if (_count == 0) return;
    if (index < 0) index = 0;
    if (index >= _count) index = _count - 1;
    _selected = index;
}

Screen *Menu::selectedTarget() const {
    if (_count == 0) return nullptr;
    return _items[_selected].target;
}

Transition Menu::selectedTransition() const {
    if (_count == 0) return Transition::Inherit;
    return _items[_selected].transition;
}

const char *Menu::selectedLabel() const {
    if (_count == 0) return "";
    return _items[_selected].label;
}

void Menu::draw(Gfx &g, const Theme &theme, Store &store) {
    (void)store;
    int16_t rowH = theme.rowHeight;
    if (rowH < 16) rowH = 16;
    int16_t visible = h / rowH;
    if (visible < 1) visible = 1;

    if (_selected < _scroll) _scroll = _selected;
    if (_selected >= _scroll + visible) _scroll = _selected - visible + 1;
    if (_scroll < 0) _scroll = 0;

    int16_t gap = 3;
    for (int16_t row = 0; row < visible; row++) {
        int idx = _scroll + row;
        if (idx >= _count) break;

        int16_t ry = (int16_t)(y + row * rowH);
        int16_t rh = (int16_t)(rowH - gap);
        bool sel = (idx == _selected);

        uint16_t fill = sel ? theme.primary : theme.surface;
        uint16_t txt = sel ? theme.background : theme.text;
        g.fillRoundRect(x, ry, w, rh, theme.radius, fill);
        if (!sel) g.drawRoundRect(x, ry, w, rh, theme.radius, theme.surfaceEdge);

        int16_t pad = theme.padding;
        int16_t contentX = (int16_t)(x + pad);

        const uint16_t *icon = iconData(_items[idx].icon);
        if (icon) {
            int16_t iconY = (int16_t)(ry + (rh - (int16_t)ICON_H) / 2);
            drawIcon(g, icon, contentX, iconY, 1, txt);
            contentX += (int16_t)(ICON_W + pad);
        }

        int16_t labelW = (int16_t)(x + w - pad - contentX);
        drawText(g, theme, _items[idx].label, contentX, ry, labelW, rh, TextAlign::Left, txt,
                 theme.textSize, fill, theme.font);

        if (_items[idx].target) {
            const uint16_t *arrow = iconData(IconId::ArrowRight);
            int16_t aY = (int16_t)(ry + (rh - (int16_t)ICON_H) / 2);
            drawIcon(g, arrow, (int16_t)(x + w - pad - ICON_W), aY, 1, txt);
        }
    }
}

}
