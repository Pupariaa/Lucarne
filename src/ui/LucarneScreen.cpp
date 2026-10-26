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

void maskCorner(Gfx &g, uint16_t bezel, int16_t r, const Rect &corner, const Rect &clip) {
    Rect c = corner.intersect(clip);
    if (c.empty()) return;
    int16_t w = g.width();
    int16_t h = g.height();
    for (int16_t y = c.y; y < c.bottom(); y++) {
        for (int16_t x = c.x; x < c.right(); x++) {
            if (!insideRoundRect(x, y, w, h, r)) {
                g.drawPixel(x, y, bezel);
            }
        }
    }
}

void maskScreenCorners(Gfx &g, uint16_t bezel, int16_t r, const Rect &clip) {
    if (r <= 0) return;
    int16_t w = g.width();
    int16_t h = g.height();
    maskCorner(g, bezel, r, Rect(0, 0, r, r), clip);
    maskCorner(g, bezel, r, Rect((int16_t)(w - r), 0, r, r), clip);
    maskCorner(g, bezel, r, Rect(0, (int16_t)(h - r), r, r), clip);
    maskCorner(g, bezel, r, Rect((int16_t)(w - r), (int16_t)(h - r), r, r), clip);
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
    Rect full(0, 0, g.width(), g.height());
    drawClipped(g, theme, store, g.clipActive() ? g.clipRect() : full);
}

void Screen::drawClipped(Gfx &g, const Theme &theme, Store &store, const Rect &clipIn) {
    Rect screenRect(0, 0, g.width(), g.height());
    Rect clip = clipIn.intersect(screenRect);
    if (clip.empty()) return;
    bool hadClip = g.clipActive();
    Rect prevClip = g.clipRect();
    Rect eff = hadClip ? clip.intersect(prevClip) : clip;
    if (eff.empty()) return;
    g.setClipRect(eff);

    uint16_t bezel = theme.surfaceEdge;
    int16_t r = _cornerRadius;
    if (g.isCharacterGrid()) {
        g.fillRect(eff.x, eff.y, eff.w, eff.h, theme.background);
    } else if (r == 0) {
        g.fillRect(eff.x, eff.y, eff.w, eff.h, theme.background);
    } else {
        int16_t w = g.width();
        int16_t h = g.height();
        Rect inner((int16_t)r, (int16_t)r, (int16_t)(w - 2 * r), (int16_t)(h - 2 * r));
        if (inner.contains(eff)) {
            g.fillRect(eff.x, eff.y, eff.w, eff.h, theme.background);
        } else {
            g.fillRect(eff.x, eff.y, eff.w, eff.h, bezel);
            g.fillRoundRect(0, 0, w, h, r, theme.background);
        }
    }

    for (Widget *wgt = _head; wgt; wgt = wgt->_next) {
        if (!wgt->visible) continue;
        Rect b = wgt->boundsLogical(g, theme);
        if (b.empty()) b = Rect(wgt->x, wgt->y, wgt->w > 0 ? wgt->w : 1, wgt->h > 0 ? wgt->h : 1);
        if (!b.intersects(eff)) continue;
        Icon *ic = wgt->asIcon();
        if (ic && iconWidgetIsAnim(ic) && g.hasBuffer()) {
            IconAnimDrawRect dr = iconAnimDrawRect(ic);
            if (eff.contains(Rect(dr.x, dr.y, dr.w, dr.h))) iconAnimSnapCapture(g, ic);
        }
        wgt->draw(g, theme, store);
    }
    if (r > 0 && !g.isCharacterGrid()) {
        maskScreenCorners(g, bezel, r, eff);
    }

    if (hadClip) {
        g.setClipRect(prevClip);
    } else {
        g.resetClipRect();
    }
}

void Screen::markAllDirty() {
    for (Widget *w = _head; w; w = w->_next) w->markDirty();
}

void Screen::clearAllDirty(Gfx &g, const Theme &theme) {
    for (Widget *w = _head; w; w = w->_next) {
        w->clearDirty();
        w->setLastBounds(w->visible ? w->boundsLogical(g, theme) : Rect());
    }
}

}
