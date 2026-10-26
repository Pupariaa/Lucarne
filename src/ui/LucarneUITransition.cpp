#include "LucarneUI.h"
#include "LucarneIconDraw.h"
#include "LucarneImageLoader.h"
#include "../core/LucarneColor.h"
#include "../core/LucarneStripeCanvas.h"
#include "../hal/LucarneHal.h"
#include <Arduino.h>
#include <string.h>

namespace lucarne {

static inline float easeOutCubic(float p) {
    float q = 1.0f - p;
    return 1.0f - q * q * q;
}
Transition UI::reverseTransition(Transition t) {
    switch (t) {
        case Transition::SlideLeft:
        case Transition::Push:
            return Transition::SlideRight;
        case Transition::SlideRight:
            return Transition::SlideLeft;
        case Transition::SlideUp:
            return Transition::SlideDown;
        case Transition::SlideDown:
            return Transition::SlideUp;
        default:
            return t;
    }
}

void UI::composeFrame(Gfx &g, uint16_t *fb, const uint16_t *a, const uint16_t *b, int16_t w, int16_t h,
                      Transition t, float p) {
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    size_t rowBytes = (size_t)w * 2;

    if (t == Transition::Fade) {
        uint8_t mix = (uint8_t)(p * 255.0f);
        size_t n = (size_t)w * h;
        for (size_t i = 0; i < n; i++) {
            uint16_t ca = g.pixelFromBuffer(a[i]);
            uint16_t cb = g.pixelFromBuffer(b[i]);
            fb[i] = g.pixelToBuffer(colorBlend(ca, cb, mix));
        }
        return;
    }

    if (t == Transition::Cover) {
        int o = (int)(p * w);
        if (o > w) o = w;
        for (int y = 0; y < h; y++) {
            uint16_t *row = fb + (size_t)y * w;
            memcpy(row, a + (size_t)y * w, rowBytes);
            if (o > 0) memcpy(row + (w - o), b + (size_t)y * w, (size_t)o * 2);
        }
        return;
    }

    if (t == Transition::SlideLeft || t == Transition::Push) {
        int o = (int)(p * w);
        if (o > w) o = w;
        int keep = w - o;
        for (int y = 0; y < h; y++) {
            uint16_t *row = fb + (size_t)y * w;
            const uint16_t *ar = a + (size_t)y * w;
            const uint16_t *br = b + (size_t)y * w;
            if (keep > 0) memcpy(row, ar + o, (size_t)keep * 2);
            if (o > 0) memcpy(row + keep, br, (size_t)o * 2);
        }
        return;
    }

    if (t == Transition::SlideRight) {
        int o = (int)(p * w);
        if (o > w) o = w;
        for (int y = 0; y < h; y++) {
            uint16_t *row = fb + (size_t)y * w;
            const uint16_t *ar = a + (size_t)y * w;
            const uint16_t *br = b + (size_t)y * w;
            if (o > 0) memcpy(row, br + (w - o), (size_t)o * 2);
            if (w - o > 0) memcpy(row + o, ar, (size_t)(w - o) * 2);
        }
        return;
    }

    if (t == Transition::SlideUp) {
        int o = (int)(p * h);
        if (o > h) o = h;
        for (int y = 0; y < h - o; y++) {
            memcpy(fb + (size_t)y * w, a + (size_t)(y + o) * w, rowBytes);
        }
        for (int k = 0; k < o; k++) {
            memcpy(fb + (size_t)(h - o + k) * w, b + (size_t)k * w, rowBytes);
        }
        return;
    }

    if (t == Transition::SlideDown) {
        int o = (int)(p * h);
        if (o > h) o = h;
        for (int k = 0; k < o; k++) {
            memcpy(fb + (size_t)k * w, b + (size_t)(h - o + k) * w, rowBytes);
        }
        for (int y = o; y < h; y++) {
            memcpy(fb + (size_t)y * w, a + (size_t)(y - o) * w, rowBytes);
        }
        return;
    }
}


Transition UI::resolveTransition(Transition t) const {
    if (t == Transition::Inherit) t = _defaultTransition;
    if (t == Transition::Inherit || t == Transition::None) return Transition::None;
    BufferMode mode = _display.bufferMode();
    if (mode == BufferMode::None || _display.isCharacterGrid()) return Transition::None;
    switch (halProfile().uiProfile) {
        case UiProfile::Tiny:
            return t == Transition::Fade ? Transition::Fade : Transition::None;
        case UiProfile::LowRam:
            if (t == Transition::Push || t == Transition::Cover) return Transition::None;
            return t;
        default:
            return t;
    }
}

uint8_t UI::transitionBandCount() const {
    switch (halProfile().uiProfile) {
        case UiProfile::Psram: return kTransitionBandsPsram;
        case UiProfile::MipiHighRes: return kTransitionBandsMipi;
        default: return kTransitionBandsLow;
    }
}

void UI::runTransition(Screen *toScreen, Transition t) {
    if (!toScreen) return;
    Screen *from = _current;
    Transition eff = from ? resolveTransition(t) : Transition::None;
    if (eff != Transition::None) {
        if (runRichTransition(from, toScreen, eff)) return;
        if (runBandTransition(from, toScreen, eff)) return;
    }
    enterScreen(toScreen, 0);
    patchStoreBindings(millis(), true);
    invalidate();
    renderInternal();
}

void UI::pushCanvasRect(StripeCanvas &canvas, int16_t dx, int16_t dy) {
    Rect win = canvas.window();
    if (win.empty()) return;
    const uint16_t *src = canvas.data();
    int16_t rows = _display.stripeRowsFor(win.w);
    if (rows < 1) rows = 1;
    int16_t r = 0;
    while (r < win.h) {
        int16_t h = (int16_t)(win.h - r);
        if (h > rows) h = rows;
        if (_display.beginStripe(dx, (int16_t)(dy + r), win.w, h)) {
            Rect s = _display.stripeRect();
            int16_t got = s.h > 0 && s.h < h ? s.h : h;
            _display.writeBufferRect(dx, (int16_t)(dy + r), win.w, got, src + (size_t)r * (size_t)win.w);
            _display.endStripe();
            r = (int16_t)(r + got);
        } else {
            r = (int16_t)(r + h);
        }
    }
}

bool UI::runBandTransition(Screen *from, Screen *to, Transition t) {
    BufferMode mode = _display.bufferMode();
    if (mode != BufferMode::Full && mode != BufferMode::Partial) return false;
    if (_display.isCharacterGrid()) return false;
    int16_t W = _display.width();
    int16_t H = _display.height();
    if (W < 1 || H < 1) return false;

    uint8_t bands = transitionBandCount();
    if (bands < 1) bands = 1;
    int16_t bandH = (int16_t)((H + bands - 1) / bands);
    if (mode == BufferMode::Partial) {
        int16_t dr = _display.stripeRowsFor(W);
        if (dr > 0 && bandH > dr) bandH = dr;
    }
    if (bandH < 1) bandH = 1;

    StripeCanvas ca(W, H);
    StripeCanvas cb(W, H);
    for (;;) {
        if (ca.alloc(bandH) && cb.alloc(bandH)) break;
        ca.release();
        cb.release();
        if (bandH <= 1) return false;
        bandH = (int16_t)(bandH / 2);
    }

    const Theme &fromTheme = themeFor(from);
    _current = to;
    scanActiveMenu();
    scanActiveFocusGroup();
    iconAnimResetScreen(to);
    screenPrefetchAssets(to, 0);
    _autoStale = true;
    patchStoreBindings(millis(), true);
    const Theme &toTheme = themeFor(to);

    uint16_t ms = _transitionMs ? _transitionMs : kTransitionMsDefault;
    uint16_t steps = (uint16_t)((ms + 29) / 30);
    if (steps > kTransitionStepsMax) steps = kTransitionStepsMax;
    if (steps < 2) steps = 2;
    bool fullFade = t == Transition::Fade && mode == BufferMode::Full && _display.hasBuffer();
    uint32_t start = millis();
    float prevE = 0.0f;

    for (uint16_t s = 1; s < steps; s++) {
        float p = (float)s / (float)steps;
        float tp = (float)(millis() - start) / (float)ms;
        if (tp > p) p = tp;
        if (p >= 1.0f) break;
        float e = easeOutCubic(p);
        uint8_t mix = (uint8_t)(e * 255.0f);
        if (fullFade) {
            float k = prevE < 1.0f ? (e - prevE) / (1.0f - prevE) : 1.0f;
            if (k < 0.0f) k = 0.0f;
            if (k > 1.0f) k = 1.0f;
            mix = (uint8_t)(k * 255.0f + 0.5f);
        }
        for (int16_t by = 0; by < H; by = (int16_t)(by + bandH)) {
            int16_t bh = (int16_t)(H - by);
            if (bh > bandH) bh = bandH;
            switch (t) {
                case Transition::Fade: {
                    if (!cb.setWindow(0, by, W, bh) || !ca.setWindow(0, by, W, bh)) break;
                    to->drawClipped(cb, toTheme, _store, cb.window());
                    if (fullFade) {
                        _display.readBufferRectNative(0, by, W, bh, ca.data());
                    } else {
                        from->drawClipped(ca, fromTheme, _store, ca.window());
                    }
                    uint16_t *pa = ca.data();
                    uint16_t *pb = cb.data();
                    size_t n = (size_t)W * (size_t)bh;
                    for (size_t i = 0; i < n; i++) pb[i] = colorBlend(pa[i], pb[i], mix);
                    pushCanvasRect(cb, 0, by);
                    break;
                }
                case Transition::SlideLeft:
                case Transition::Push: {
                    int16_t o = (int16_t)(e * W);
                    if (o > W) o = W;
                    if (W - o > 0 && ca.setWindow(o, by, (int16_t)(W - o), bh)) {
                        from->drawClipped(ca, fromTheme, _store, ca.window());
                        pushCanvasRect(ca, 0, by);
                    }
                    if (o > 0 && cb.setWindow(0, by, o, bh)) {
                        to->drawClipped(cb, toTheme, _store, cb.window());
                        pushCanvasRect(cb, (int16_t)(W - o), by);
                    }
                    break;
                }
                case Transition::SlideRight: {
                    int16_t o = (int16_t)(e * W);
                    if (o > W) o = W;
                    if (o > 0 && cb.setWindow((int16_t)(W - o), by, o, bh)) {
                        to->drawClipped(cb, toTheme, _store, cb.window());
                        pushCanvasRect(cb, 0, by);
                    }
                    if (W - o > 0 && ca.setWindow(0, by, (int16_t)(W - o), bh)) {
                        from->drawClipped(ca, fromTheme, _store, ca.window());
                        pushCanvasRect(ca, o, by);
                    }
                    break;
                }
                case Transition::Cover: {
                    int16_t o = (int16_t)(e * W);
                    if (o > W) o = W;
                    if (o > 0 && cb.setWindow(0, by, o, bh)) {
                        to->drawClipped(cb, toTheme, _store, cb.window());
                        pushCanvasRect(cb, (int16_t)(W - o), by);
                    }
                    break;
                }
                case Transition::SlideUp: {
                    int16_t o = (int16_t)(e * H);
                    if (o > H) o = H;
                    int16_t split = (int16_t)(H - o);
                    int16_t aEnd = (int16_t)(by + bh) < split ? (int16_t)(by + bh) : split;
                    if (aEnd > by && ca.setWindow(0, (int16_t)(by + o), W, (int16_t)(aEnd - by))) {
                        from->drawClipped(ca, fromTheme, _store, ca.window());
                        pushCanvasRect(ca, 0, by);
                    }
                    int16_t bStart = by > split ? by : split;
                    if ((int16_t)(by + bh) > bStart &&
                        cb.setWindow(0, (int16_t)(bStart - split), W, (int16_t)(by + bh - bStart))) {
                        to->drawClipped(cb, toTheme, _store, cb.window());
                        pushCanvasRect(cb, 0, bStart);
                    }
                    break;
                }
                case Transition::SlideDown: {
                    int16_t o = (int16_t)(e * H);
                    if (o > H) o = H;
                    int16_t aEnd = (int16_t)(by + bh) < o ? (int16_t)(by + bh) : o;
                    if (aEnd > by && cb.setWindow(0, (int16_t)(by + H - o), W, (int16_t)(aEnd - by))) {
                        to->drawClipped(cb, toTheme, _store, cb.window());
                        pushCanvasRect(cb, 0, by);
                    }
                    int16_t bStart = by > o ? by : o;
                    if ((int16_t)(by + bh) > bStart &&
                        ca.setWindow(0, (int16_t)(bStart - o), W, (int16_t)(by + bh - bStart))) {
                        from->drawClipped(ca, fromTheme, _store, ca.window());
                        pushCanvasRect(ca, 0, bStart);
                    }
                    break;
                }
                default:
                    break;
            }
        }
        prevE = e;
    }

    _display.flushWait();
    ca.release();
    cb.release();
    releaseSdImageCache();
    screenPrefetchAssets(to, 0);
    invalidate();
    renderInternal();
    return true;
}

bool UI::runRichTransition(Screen *from, Screen *to, Transition t) {
    const HalProfile &prof = halProfile();
    if (!prof.preferRichTransitions || !prof.allowRichTransitions) return false;
    if (prof.uiProfile != UiProfile::Psram && prof.uiProfile != UiProfile::MipiHighRes) return false;
    if (_display.bufferMode() != BufferMode::Full || !_display.hasBuffer()) return false;

    uint16_t *a = _display.allocFrame();
    uint16_t *b = _display.allocFrame();
    if (!a || !b) {
        _display.freeFrame(a);
        _display.freeFrame(b);
        return false;
    }

    int16_t w = _display.width();
    int16_t h = _display.height();
    Rect full(0, 0, w, h);

    iconAnimResetScreen(from);
    screenPrefetchAssets(from, 0);
    from->drawClipped(_display, themeFor(from), _store, full);
    _display.snapshotFrame(a);

    enterScreen(to, 0);
    patchStoreBindings(millis(), true);
    _current->drawClipped(_display, activeTheme(), _store, full);
    _display.snapshotFrame(b);

    uint16_t *fb = _display.buffer();
    uint16_t ms = _transitionMs ? _transitionMs : kTransitionMsDefault;
    uint16_t steps = (uint16_t)((ms + 24) / 25);
    if (steps > kTransitionStepsMax) steps = kTransitionStepsMax;
    if (steps < 2) steps = 2;

    for (uint16_t s = 1; s <= steps; s++) {
        float p = (float)s / (float)steps;
        composeFrame(_display, fb, a, b, w, h, t, easeOutCubic(p));
        _display.invalidateRegion(0, 0, w, h);
        _display.presentDirty();
    }

    memcpy(fb, b, (size_t)w * h * 2);
    _display.freeFrame(a);
    _display.freeFrame(b);
    _display.discardDirty();
    _display.flushWait();
    _invalid.clear();
    _current->clearAllDirty(_display, activeTheme());
    return true;
}

}