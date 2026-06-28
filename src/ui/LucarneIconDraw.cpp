#include "LucarneIconDraw.h"
#include "LucarneIconAnim.h"
#include "LucarneIcons.h"
#include "LucarneScreen.h"
#include "LucarneWidget.h"
#include "widgets/LucarneIcon.h"
#include "../core/LucarneColor.h"
#include "../display/LucarneDisplay.h"
#include <Arduino.h>
#include <string.h>

#if defined(ESP32)
#include <pgmspace.h>
#endif

namespace lucarne {

static IconRowsLookup _rowsLookup = nullptr;
static IconImageLookup _imageLookup = nullptr;
static IconAnimLookup _animLookup = nullptr;
static uint16_t _animSpeedPercent = 100;

static uint32_t animScaledMs(uint32_t ms) {
    return (uint32_t)((uint64_t)ms * 100ULL / (uint64_t)_animSpeedPercent);
}

static const size_t kAnimPixelCap = 64 * 64;
static uint16_t _animPxBuf[kAnimPixelCap];
static uint8_t _animAlBuf[kAnimPixelCap];

static bool refEmpty(const char *ref) {
    return !ref || !ref[0] || strcmp(ref, "none") == 0;
}

static const IconAnimAsset *lookupAnimRef(const char *ref) {
    if (refEmpty(ref) || !_animLookup) return nullptr;
    const IconAnimAsset *anim = _animLookup(ref);
    if (anim) return anim;
#if defined(ESP32)
    if (strcmp_P(ref, PSTR("emoji:1f329-fe0f")) == 0) {
        return _animLookup("emoji:1f329-fe0f");
    }
#endif
    return nullptr;
}

void setIconLookups(IconRowsLookup rows, IconImageLookup image, IconAnimLookup anim) {
    _rowsLookup = rows;
    _imageLookup = image;
    _animLookup = anim;
}

void setIconAnimSpeedPercent(uint16_t pct) {
    if (pct < 50) pct = 50;
    if (pct > 400) pct = 400;
    _animSpeedPercent = pct;
}

bool iconAnimPlaybackActive() { return _animLookup != nullptr; }

bool iconRefIsAnim(const char *ref) {
    const IconAnimAsset *anim = lookupAnimRef(ref);
    return anim && iconAnimFrameCount(anim) > 0 && iconAnimFramesPtr(anim);
}

bool iconAnimScreenDirty(Screen *screen) {
    if (!screen || !_animLookup) return false;
    uint32_t ms = millis();
    for (Widget *w = screen->first(); w; w = w->_next) {
        Icon *ic = w->asIcon();
        if (!ic || !ic->visible) continue;
        const char *ref = ic->iconRef();
        if (!iconRefIsAnim(ref)) continue;
        if (iconRefAnimFrame(ref, ms) != ic->lastAnimFrame()) return true;
    }
    return false;
}

uint8_t iconRefAnimFrame(const char *ref, uint32_t ms) {
    if (!iconRefIsAnim(ref)) return 0;
    return iconAnimFrameAt(lookupAnimRef(ref), animScaledMs(ms));
}

static bool drawAnimFrameFit(Gfx &g, const ImageAsset *frame, int16_t x, int16_t y, int16_t dw,
                             int16_t dh, uint16_t bg) {
    ImageAsset local;
#if defined(ESP32)
    memcpy_P(&local, frame, sizeof(ImageAsset));
#else
    local = *frame;
#endif
    const uint16_t *src = local.data;
    if (!src) return false;
    int16_t sw = local.width;
    int16_t sh = local.height;
    if (sw < 1 || sh < 1) return false;
    size_t n = (size_t)sw * (size_t)sh;
    if (n > kAnimPixelCap) return false;
#if defined(ESP32)
    memcpy_P(_animPxBuf, src, n * sizeof(uint16_t));
    if (local.alpha) {
        memcpy_P(_animAlBuf, local.alpha, n);
    } else {
        memset(_animAlBuf, 255, n);
    }
#else
    memcpy(_animPxBuf, src, n * sizeof(uint16_t));
    if (local.alpha) {
        memcpy(_animAlBuf, local.alpha, n);
    } else {
        memset(_animAlBuf, 255, n);
    }
#endif
    Widget::drawRamImageFit(g, _animPxBuf, _animAlBuf, sw, sh, x, y, dw, dh, bg);
    return true;
}

bool iconAnimPatchScreen(Display &disp, Screen *screen, const Theme &theme, Store &store) {
    (void)store;
    if (!screen || !_animLookup) return false;
    uint32_t ms = millis();
    bool patched = false;
    int16_t x0 = 32767;
    int16_t y0 = 32767;
    int16_t x1 = -32768;
    int16_t y1 = -32768;
    for (Widget *w = screen->first(); w; w = w->_next) {
        Icon *ic = w->asIcon();
        if (!ic || !ic->visible) continue;
        const char *ref = ic->iconRef();
        const IconAnimAsset *anim = lookupAnimRef(ref);
        if (!anim || iconAnimFrameCount(anim) < 1) continue;
        const ImageAsset *frame = iconAnimFramePtr(anim, iconAnimFrameAt(anim, animScaledMs(ms)));
        if (!frame) continue;
        int16_t px = ic->x;
        int16_t py = ic->y;
        int16_t pw = ic->w > 0 ? ic->w : ic->h;
        int16_t ph = ic->h > 0 ? ic->h : pw;
        if (pw < 1) pw = 1;
        if (ph < 1) ph = 1;
        disp.fillRect(px, py, pw, ph, theme.background);
        if (!drawAnimFrameFit(disp, frame, px, py, pw, ph, theme.background)) continue;
        ic->syncAnimFrame(iconAnimFrameAt(anim, animScaledMs(ms)));
        patched = true;
        if (px < x0) x0 = px;
        if (py < y0) y0 = py;
        if (px + pw - 1 > x1) x1 = px + pw - 1;
        if (py + ph - 1 > y1) y1 = py + ph - 1;
    }
    if (patched) {
        disp.display(x0, y0, (int16_t)(x1 - x0 + 1), (int16_t)(y1 - y0 + 1));
    }
    return patched;
}

void iconAnimResetScreen(Screen *screen) {
    if (!screen) return;
    for (Widget *w = screen->first(); w; w = w->_next) {
        Icon *ic = w->asIcon();
        if (ic) ic->syncAnimFrame(0xff);
    }
}

bool iconRefValid(const char *ref) {
    if (refEmpty(ref)) return false;
    if (iconFromName(ref) != IconId::None) return true;
    if (_rowsLookup && _rowsLookup(ref)) return true;
    if (_animLookup && lookupAnimRef(ref)) return true;
    if (_imageLookup && _imageLookup(ref)) return true;
    return false;
}

int16_t iconRefBaseSize(const char *ref) {
    if (refEmpty(ref)) return 0;
    if (_animLookup) {
        const IconAnimAsset *anim = lookupAnimRef(ref);
        if (anim && iconAnimFrameCount(anim)) {
            const ImageAsset *frame = iconAnimFramePtr(anim, 0);
            if (frame && imageAssetData(frame)) {
                int16_t aw = imageAssetWidth(frame);
                return aw > 0 ? aw : 16;
            }
            return anim->width > 0 ? anim->width : 16;
        }
    }
    if (_imageLookup) {
        const ImageAsset *img = _imageLookup(ref);
        if (img && imageAssetData(img)) {
            int16_t iw = imageAssetWidth(img);
            return iw > 0 ? iw : 16;
        }
    }
    return 16;
}

void drawIconRef(Gfx &g, const char *ref, int16_t x, int16_t y, int16_t dw, int16_t dh, uint16_t tint,
                 uint16_t bg) {
    (void)tint;
    if (refEmpty(ref) || dw < 1 || dh < 1) return;

    if (_animLookup) {
        const IconAnimAsset *anim = lookupAnimRef(ref);
        if (anim && iconAnimFrameCount(anim) && iconAnimFramesPtr(anim)) {
            uint8_t fi = iconAnimFrameAt(anim, animScaledMs(millis()));
            const ImageAsset *frame = iconAnimFramePtr(anim, fi);
            if (frame && drawAnimFrameFit(g, frame, x, y, dw, dh, bg)) {
                return;
            }
        }
    }

    IconId id = iconFromName(ref);
    if (id != IconId::None) {
        const uint16_t *rows = iconData(id);
        if (dw == 16 && dh == 16) {
            Widget::drawIcon(g, rows, x, y, 1, tint);
        } else {
            Widget::drawIconFit(g, rows, x, y, dw, dh, tint);
        }
        return;
    }

    if (_rowsLookup) {
        const uint16_t *rows = _rowsLookup(ref);
        if (rows) {
            if (dw == 16 && dh == 16) {
                Widget::drawIcon(g, rows, x, y, 1, tint);
            } else {
                Widget::drawIconFit(g, rows, x, y, dw, dh, tint);
            }
            return;
        }
    }

    if (_imageLookup) {
        const ImageAsset *img = _imageLookup(ref);
        if (img && imageAssetData(img)) {
            Widget::drawImageAsset(g, img, x, y, dw, dh, bg);
        }
    }
}

}
