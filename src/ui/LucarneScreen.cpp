#include "LucarneScreen.h"

namespace lucarne {

Screen::Screen(const char *name) : _name(name), _head(nullptr), _tail(nullptr) {}

void Screen::add(Widget *widget) {
    if (!widget) return;
    widget->_next = nullptr;
    if (!_head) {
        _head = widget;
        _tail = widget;
    } else {
        _tail->_next = widget;
        _tail = widget;
    }
}

void Screen::draw(Gfx &g, const Theme &theme, Store &store) {
    g.fillScreen(theme.background);
    for (Widget *w = _head; w; w = w->_next) {
        if (w->visible) {
            w->draw(g, theme, store);
        }
    }
}

}
