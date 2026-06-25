#include "LucarneScreen.h"

namespace lucarne {

namespace {

bool insideRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t r) {
    if (r <= 0) return true;
    if (x >= r && x < w - r) return true;
    if (y >= r && y < h - r) return true;
    int16_t cx = (x < r) ? r : (int16_t)(w - r - 1);
    int16_t cy = (y < r) ? r : (int16_t)(h - r - 1);
    int32_t dx = (int32_t)x - (int32_t)cx;
    int32_t dy = (int32_t)y - (int32_t)cy;
    int32_t rr = (int32_t)r * (int32_t)r;
    return dx * dx + dy * dy <= rr;
}

void maskScreenCorners(Gfx &g, uint16_t bezel, int16_t r) {
    if (r <= 0) return;
    int16_t w = g.width();
    int16_t h = g.height();
    for (int16_t y = 0; y < h; y++) {
        for (int16_t x = 0; x < w; x++) {
            if (!insideRoundRect(x, y, w, h, r)) {
                g.drawPixel(x, y, bezel);
            }
        }
    }
}

}

Screen::Screen(const char *name) : _name(name), _head(nullptr), _tail(nullptr), _cornerRadius(0) {}

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
    int16_t w = g.width();
    int16_t h = g.height();
    uint16_t bezel = theme.surfaceEdge;
    if (_cornerRadius == 0) {
        g.fillScreen(theme.background);
    } else {
        g.fillScreen(bezel);
        g.fillRoundRect(0, 0, w, h, _cornerRadius, theme.background);
    }
    for (Widget *wgt = _head; wgt; wgt = wgt->_next) {
        if (wgt->visible) {
            wgt->draw(g, theme, store);
        }
    }
    if (_cornerRadius > 0) {
        maskScreenCorners(g, bezel, _cornerRadius);
    }
}

}
