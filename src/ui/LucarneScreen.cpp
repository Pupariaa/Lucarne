#include "LucarneScreen.h"
#include "LucarneIconDraw.h"

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

Screen::Screen(const char *name)
    : _name(name), _head(nullptr), _tail(nullptr), _cornerRadius(0), _hasCustomTheme(false) {}

void Screen::setTheme(const Theme &theme) {
    _customTheme = theme;
    _hasCustomTheme = true;
}

void Screen::clearTheme() {
    _hasCustomTheme = false;
}

const Theme *Screen::customTheme() const {
    return _hasCustomTheme ? &_customTheme : nullptr;
}

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
        if (!wgt->visible) continue;
        Icon *ic = wgt->asIcon();
        if (ic && iconWidgetIsAnim(ic)) iconAnimSnapCapture(g, ic);
        wgt->draw(g, theme, store);
    }
    if (_cornerRadius > 0) {
        maskScreenCorners(g, bezel, _cornerRadius);
    }
}

static bool rectsIntersect(int16_t ax, int16_t ay, int16_t aw, int16_t ah, int16_t bx, int16_t by,
                           int16_t bw, int16_t bh) {
    return ax < (int16_t)(bx + bw) && (int16_t)(ax + aw) > bx && ay < (int16_t)(by + bh) &&
           (int16_t)(ay + ah) > by;
}

void Screen::redrawRegion(int16_t rx, int16_t ry, int16_t rw, int16_t rh, Gfx &g, const Theme &theme,
                          Store &store) {
    if (rw < 1 || rh < 1) return;
    g.fillRect(rx, ry, rw, rh, theme.background);
    for (Widget *w = _head; w; w = w->_next) {
        if (!w->visible) continue;
        int16_t ww = w->w;
        int16_t wh = w->h;
        if (ww < 1) ww = 1;
        if (wh < 1) wh = 1;
        if (!rectsIntersect(w->x, w->y, ww, wh, rx, ry, rw, rh)) continue;
        w->draw(g, theme, store);
    }
}

}
