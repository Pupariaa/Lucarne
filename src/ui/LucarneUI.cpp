#include "LucarneUI.h"
#include "../core/LucarneColor.h"
#include <Arduino.h>
#include <string.h>

namespace lucarne {

UI::UI(Display &display)
    : _display(display), _current(nullptr), _activeMenu(nullptr), _stackTop(0),
      _defaultTransition(Transition::None), _transitionMs(220), _dirty(true), _menuHandler(nullptr),
      _pendingMenuAction(0), _splashNext(nullptr), _splashDuration(0), _splashProgress(false),
      _splashActive(false), _splashStart(0) {}

void UI::setTheme(const Theme &theme) {
    _theme = theme;
    _dirty = true;
}

void UI::setTransition(Transition def, uint16_t durationMs) {
    _defaultTransition = def;
    _transitionMs = durationMs;
}

void UI::scanActiveMenu() {
    _activeMenu = nullptr;
    if (!_current) return;
    for (Widget *w = _current->first(); w; w = w->_next) {
        Menu *m = w->asMenu();
        if (m) {
            _activeMenu = m;
            return;
        }
    }
}

void UI::show(Screen *screen) {
    if (_current == screen) return;
    _current = screen;
    scanActiveMenu();
    _dirty = true;
}

void UI::navigate(Screen *screen, Transition transition) {
    if (!screen || screen == _current) return;
    Transition t = (transition == Transition::Inherit) ? _defaultTransition : transition;
    if (_current && _stackTop < STACK_SIZE) {
        _stack[_stackTop].screen = _current;
        _stack[_stackTop].trans = t;
        _stackTop++;
    }
    runTransition(screen, t);
}

void UI::back() {
    if (_stackTop == 0) return;
    StackEntry e = _stack[--_stackTop];
    runTransition(e.screen, reverseTransition(e.trans));
}

void UI::next() {
    if (!_activeMenu) return;
    _activeMenu->moveNext();
    _dirty = true;
}

void UI::prev() {
    if (!_activeMenu) return;
    _activeMenu->movePrev();
    _dirty = true;
}

void UI::setSplash(Screen *next, uint16_t durationMs, bool showProgress) {
    _splashNext = next;
    _splashDuration = durationMs;
    _splashProgress = showProgress;
    _splashStart = millis();
    _splashActive = (next != nullptr && durationMs > 0);
    _dirty = true;
}

void UI::select() {
    if (!_activeMenu) return;
    if (_activeMenu->selectedKind() == MenuItemKind::Callback) {
        uint8_t id = _activeMenu->selectedActionId();
        if (id) _pendingMenuAction = id;
        if (_menuHandler) _menuHandler(id);
        return;
    }
    Screen *target = _activeMenu->selectedTarget();
    if (target) navigate(target, _activeMenu->selectedTransition());
}

uint8_t UI::pollMenuAction() {
    uint8_t id = _pendingMenuAction;
    _pendingMenuAction = 0;
    return id;
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

void UI::composeFrame(uint16_t *fb, const uint16_t *a, const uint16_t *b, int16_t w, int16_t h,
                      Transition t, float p) {
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    size_t rowBytes = (size_t)w * 2;

    if (t == Transition::Fade) {
        uint8_t mix = (uint8_t)(p * 255.0f);
        size_t n = (size_t)w * h;
        for (size_t i = 0; i < n; i++) fb[i] = colorBlend(a[i], b[i], mix);
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

void UI::runTransition(Screen *toScreen, Transition t) {
    bool canAnimate = (t != Transition::None && t != Transition::Inherit) &&
                      _display.bufferMode() == BufferMode::Full && _display.hasBuffer();

    uint16_t *a = nullptr;
    uint16_t *b = nullptr;
    if (canAnimate) {
        a = _display.allocFrame();
        b = _display.allocFrame();
        if (!a || !b) {
            _display.freeFrame(a);
            _display.freeFrame(b);
            canAnimate = false;
        }
    }

    if (!canAnimate) {
        _current = toScreen;
        scanActiveMenu();
        _current->draw(_display, _theme, _store);
        _display.display();
        _store.clearDirty();
        _dirty = false;
        return;
    }

    int16_t w = _display.width();
    int16_t h = _display.height();

    _display.snapshotFrame(a);

    _current = toScreen;
    scanActiveMenu();
    _current->draw(_display, _theme, _store);
    _display.snapshotFrame(b);

    uint16_t *fb = _display.buffer();
    uint16_t frameMs = 16;
    uint16_t steps = _transitionMs / frameMs;
    if (steps < 1) steps = 1;

    for (uint16_t s = 1; s <= steps; s++) {
        float p = (float)s / (float)steps;
        float e = 1.0f - (1.0f - p) * (1.0f - p) * (1.0f - p);
        composeFrame(fb, a, b, w, h, t, e);
        _display.presentFull();
        delay(frameMs);
    }

    memcpy(fb, b, (size_t)w * h * 2);
    _display.presentFull();

    _display.freeFrame(a);
    _display.freeFrame(b);
    _store.clearDirty();
    _dirty = false;
}

void UI::begin() {
    _dirty = true;
    render();
}

void UI::render() {
    if (!_current) return;
    _current->draw(_display, _theme, _store);
    if (_splashActive && _splashProgress) {
        drawSplashProgress((uint32_t)(millis() - _splashStart));
    }
    _display.display();
    _store.clearDirty();
    _dirty = false;
}

void UI::drawSplashProgress(uint32_t elapsedMs) {
    if (!_splashActive || _splashDuration == 0) return;
    float ratio = (float)elapsedMs / (float)_splashDuration;
    if (ratio < 0.0f) ratio = 0.0f;
    if (ratio > 1.0f) ratio = 1.0f;
    int16_t sw = _display.width();
    int16_t sh = _display.height();
    int16_t barH = 6;
    int16_t margin = _theme.padding;
    int16_t trackW = (int16_t)(sw - margin * 2);
    int16_t fillW = (int16_t)(trackW * ratio);
    int16_t y = (int16_t)(sh - margin - barH);
    _display.fillRoundRect(margin, y, trackW, barH, 3, _theme.surface);
    if (fillW > 0) {
        _display.fillRoundRect(margin, y, fillW, barH, 3, _theme.primary);
    }
}

void UI::update() {
    if (_splashActive) {
        uint32_t elapsed = (uint32_t)(millis() - _splashStart);
        if (elapsed >= _splashDuration) {
            _splashActive = false;
            if (_splashNext) navigate(_splashNext, Transition::Fade);
            return;
        }
        if (_splashProgress) _dirty = true;
    }
    if (_dirty || _store.dirty()) {
        render();
    }
}

void UI::setFloat(const char *key, float v) { _store.setFloat(key, v); }
void UI::setInt(const char *key, long v) { _store.setInt(key, v); }
void UI::setBool(const char *key, bool v) { _store.setBool(key, v); }
void UI::setString(const char *key, const char *v) { _store.setString(key, v); }

}
