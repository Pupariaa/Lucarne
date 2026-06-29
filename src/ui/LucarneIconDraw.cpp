#include "LucarneIconDraw.h"
#include "LucarneIconAnim.h"
#include "LucarneIcons.h"
#include "LucarneImageLoader.h"
#include "LucarneScreen.h"
#include "LucarneWidget.h"
#include "widgets/LucarneIcon.h"
#include "../core/LucarneColor.h"
#include "../display/LucarneDisplay.h"
#include <Arduino.h>
#include <string.h>

#if defined(ESP32)
#include <pgmspace.h>
#include <esp_heap_caps.h>
#endif

namespace lucarne {

static IconRowsLookup _rowsLookup = nullptr;
static IconImageLookup _imageLookup = nullptr;
static IconAnimLookup _animLookup = nullptr;
static uint16_t _animSpeedPercent = 100;
static size_t _animReadyBudgetBytes = 0;
static size_t _animReadyBytesUsed = 0;

struct AnimSnapSlot {
    Icon *ic;
    int16_t x;
    int16_t y;
    int16_t w;
    int16_t h;
    uint16_t *buf;
    size_t count;
    uint16_t **ready;
    bool *readyBuilt;
    uint8_t readyFc;
};

static const uint8_t kMaxAnimSnaps = 6;
static AnimSnapSlot _animSnaps[kMaxAnimSnaps];

static uint16_t *snapAllocBuf(size_t pixels) {
    if (!pixels) return nullptr;
    size_t bytes = pixels * 2;
#if defined(ESP32)
    uint16_t *p = (uint16_t *)heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!p) p = (uint16_t *)malloc(bytes);
    return p;
#else
    return (uint16_t *)malloc(bytes);
#endif
}

static void snapFreeReady(AnimSnapSlot &slot) {
    if (slot.ready) {
        for (uint8_t i = 0; i < slot.readyFc; i++) {
            if (slot.ready[i]) {
                if (_animReadyBytesUsed >= slot.count * 2) _animReadyBytesUsed -= slot.count * 2;
                else _animReadyBytesUsed = 0;
                free(slot.ready[i]);
            }
        }
        free(slot.ready);
    }
    if (slot.readyBuilt) free(slot.readyBuilt);
    slot.ready = nullptr;
    slot.readyBuilt = nullptr;
    slot.readyFc = 0;
}

static size_t animReadyBudgetLimit() {
#if defined(ESP32)
    if (_animReadyBudgetBytes > 0) return _animReadyBudgetBytes;
    size_t psram = ESP.getPsramSize();
    if (psram >= 6 * 1024 * 1024) return psram / 2;
    if (psram >= 2 * 1024 * 1024) return psram / 4;
    if (psram > 0) return psram / 5;
#endif
    return 384 * 1024;
}

static void logAnimReadyFailOnce() {
#if defined(ESP32)
    static bool logged;
    if (logged) return;
    logged = true;
    Serial.print(F("Lucarne anim: ready alloc failed, free PSRAM "));
    Serial.println((uint32_t)ESP.getFreePsram());
#endif
}

void setAnimReadyBudget(size_t bytes) { _animReadyBudgetBytes = bytes; }

static bool snapEnsureReadyMeta(AnimSnapSlot *slot, uint8_t fc) {
    if (!slot || fc < 1) return false;
    if (slot->readyFc == fc && slot->ready && slot->readyBuilt) return true;
    snapFreeReady(*slot);
    slot->ready = (uint16_t **)calloc(fc, sizeof(uint16_t *));
    slot->readyBuilt = (bool *)calloc(fc, sizeof(bool));
    if (!slot->ready || !slot->readyBuilt) {
        snapFreeReady(*slot);
        logAnimReadyFailOnce();
        return false;
    }
    slot->readyFc = fc;
    return true;
}

static bool snapEnsureReadyFrame(AnimSnapSlot *slot, uint8_t fi) {
    if (!slot || fi >= slot->readyFc || !slot->ready || slot->count < 1) return false;
    if (slot->ready[fi]) return true;
    size_t bytes = slot->count * 2;
    if (_animReadyBytesUsed + bytes > animReadyBudgetLimit()) {
        logAnimReadyFailOnce();
        return false;
    }
    slot->ready[fi] = snapAllocBuf(slot->count);
    if (!slot->ready[fi]) {
        logAnimReadyFailOnce();
        return false;
    }
    _animReadyBytesUsed += bytes;
    return true;
}

static void snapFreeAll() {
    for (uint8_t i = 0; i < kMaxAnimSnaps; i++) {
        if (_animSnaps[i].buf) free(_animSnaps[i].buf);
        snapFreeReady(_animSnaps[i]);
        _animSnaps[i] = {};
    }
}

static AnimSnapSlot *snapFind(Icon *ic) {
    if (!ic) return nullptr;
    for (uint8_t i = 0; i < kMaxAnimSnaps; i++) {
        if (_animSnaps[i].ic == ic) return &_animSnaps[i];
    }
    return nullptr;
}

static AnimSnapSlot *snapAlloc(Icon *ic) {
    AnimSnapSlot *slot = snapFind(ic);
    if (slot) return slot;
    for (uint8_t i = 0; i < kMaxAnimSnaps; i++) {
        if (!_animSnaps[i].ic) {
            _animSnaps[i].ic = ic;
            return &_animSnaps[i];
        }
    }
    return nullptr;
}

static bool buildAnimReady(AnimSnapSlot *slot, const IconAnimAsset *anim, uint8_t fi) {
    if (!slot || !anim || !slot->buf) return false;
    uint8_t fc = iconAnimFrameCount(anim);
    if (fc < 1 || !snapEnsureReadyMeta(slot, fc)) return false;
    if (fi >= slot->readyFc || !slot->ready || !slot->readyBuilt) return false;
    if (slot->readyBuilt[fi]) return true;
    if (!snapEnsureReadyFrame(slot, fi)) return false;
    const ImageAsset *frame = iconAnimFramePtr(anim, fi);
    if (!frame) return false;
    slot->readyBuilt[fi] = sdBuildDisplayFrame(frame, slot->w, slot->h, slot->buf, slot->ready[fi]);
    return slot->readyBuilt[fi];
}

static uint32_t animScaledMs(uint32_t ms) {
    return (uint32_t)((uint64_t)ms * 100ULL / (uint64_t)_animSpeedPercent);
}

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

uint32_t iconAnimClockMs() { return animScaledMs(millis()); }

bool iconAnimPlaybackActive() { return _animLookup != nullptr; }

bool iconRefIsAnim(const char *ref) {
    const IconAnimAsset *anim = lookupAnimRef(ref);
    return anim && iconAnimFrameCount(anim) > 0 && iconAnimFramesPtr(anim);
}

bool iconWidgetIsAnim(Icon *ic) {
    return ic && ic->visible && iconRefIsAnim(ic->iconRef());
}

static void drawAnimFrameFit(Gfx &g, const ImageAsset *frame, int16_t x, int16_t y, int16_t dw,
                             int16_t dh, uint16_t bg) {
    if (!frame || dw < 1 || dh < 1) return;
    Widget::drawImageAssetFit(g, frame, x, y, dw, dh, bg);
}

static int16_t iconDrawSizeFor(Icon *ic) {
    int16_t base = iconRefBaseSize(ic->iconRef());
    if (base < 1) base = 16;
    uint8_t st = ic->scaleTenths();
    if (st == 0) st = 10;
    return (int16_t)((base * st + 5) / 10);
}

bool iconAnimScreenDirty(Screen *screen) {
    if (!screen || !_animLookup) return false;
    uint32_t ms = animScaledMs(millis());
    for (Widget *w = screen->first(); w; w = w->_next) {
        Icon *ic = w->asIcon();
        if (!ic || !ic->visible) continue;
        const char *ref = ic->iconRef();
        if (!iconRefIsAnim(ref)) continue;
        const IconAnimAsset *anim = lookupAnimRef(ref);
        if (!anim) continue;
        uint8_t cur = ic->lastAnimFrame();
        if (cur == 0xff) return true;
        if ((uint32_t)(ms - ic->animShowMs()) >= (uint32_t)iconAnimDelayMs(anim, cur)) return true;
    }
    return false;
}

uint8_t iconRefAnimFrame(const char *ref, uint32_t ms) {
    if (!iconRefIsAnim(ref)) return 0;
    return iconAnimFrameAt(lookupAnimRef(ref), animScaledMs(ms));
}

bool iconAnimBlitReady(Display &disp, Icon *ic, uint8_t frameIndex) {
    AnimSnapSlot *slot = snapFind(ic);
    if (!slot || !slot->ready || frameIndex >= slot->readyFc || !slot->readyBuilt[frameIndex] ||
        !slot->ready[frameIndex]) {
        return false;
    }
    disp.blitBufferRect(slot->x, slot->y, slot->w, slot->h, slot->ready[frameIndex]);
    return true;
}

void iconAnimDrawInitial(Gfx &g, Icon *ic, int16_t x, int16_t y, int16_t bw, int16_t bh, uint16_t bg) {
    if (g.canPeekPixel()) {
        Display &disp = static_cast<Display &>(g);
        if (iconAnimBlitReady(disp, ic, 0)) return;
    }
    drawIconAnimFrame(g, ic->iconRef(), 0, x, y, bw, bh, bg);
}

bool iconAnimPatchScreen(Display &disp, Screen *screen, const Theme &theme, Store &store) {
    (void)store;
    if (!screen || !_animLookup || !disp.canPeekPixel() || !disp.hasBuffer()) return false;
    if (disp.bufferMode() != BufferMode::Full) return false;
    uint32_t ms = animScaledMs(millis());
    bool any = false;
    bool haveFlush = false;
    int16_t fx0 = 0;
    int16_t fy0 = 0;
    int16_t fx1 = 0;
    int16_t fy1 = 0;
    for (Widget *w = screen->first(); w; w = w->_next) {
        Icon *ic = w->asIcon();
        if (!ic || !ic->visible) continue;
        const char *ref = ic->iconRef();
        if (!iconRefIsAnim(ref)) continue;
        const IconAnimAsset *anim = lookupAnimRef(ref);
        if (!anim) continue;
        uint8_t cur = ic->lastAnimFrame();
        if (cur == 0xff) continue;
        uint8_t fc = iconAnimFrameCount(anim);
        if (fc < 1) continue;
        if ((uint32_t)(ms - ic->animShowMs()) < (uint32_t)iconAnimDelayMs(anim, cur)) continue;
        uint8_t fi = (uint8_t)((cur + 1) % fc);
        AnimSnapSlot *slot = snapFind(ic);
        if (!slot || !slot->buf || slot->w < 1 || slot->h < 1) continue;
        int16_t side = iconDrawSizeFor(ic);
        int16_t boxW = ic->w > 0 ? ic->w : side;
        int16_t boxH = ic->h > 0 ? ic->h : side;
        const ImageAsset *frame = iconAnimFramePtr(anim, fi);
        if (buildAnimReady(slot, anim, fi)) {
            disp.blitBufferRect(slot->x, slot->y, slot->w, slot->h, slot->ready[fi]);
        } else {
            disp.writeBufferRect(slot->x, slot->y, slot->w, slot->h, slot->buf);
            if (frame) {
                drawAnimFrameFit(disp, frame, ic->x, ic->y, boxW, boxH, theme.background);
            } else {
                continue;
            }
        }
        ic->syncAnimFrame(fi);
        ic->markAnimShown(ms);
        uint8_t ni = (uint8_t)((fi + 1) % fc);
        buildAnimReady(slot, anim, ni);
        if (!haveFlush) {
            fx0 = slot->x;
            fy0 = slot->y;
            fx1 = (int16_t)(slot->x + slot->w - 1);
            fy1 = (int16_t)(slot->y + slot->h - 1);
            haveFlush = true;
        } else {
            if (slot->x < fx0) fx0 = slot->x;
            if (slot->y < fy0) fy0 = slot->y;
            int16_t x2 = (int16_t)(slot->x + slot->w - 1);
            int16_t y2 = (int16_t)(slot->y + slot->h - 1);
            if (x2 > fx1) fx1 = x2;
            if (y2 > fy1) fy1 = y2;
        }
        any = true;
    }
    if (haveFlush) {
        disp.display(fx0, fy0, (int16_t)(fx1 - fx0 + 1), (int16_t)(fy1 - fy0 + 1));
    }
    return any;
}

void iconAnimSnapCapture(Gfx &g, Icon *ic) {
    if (!ic || !g.canPeekPixel()) return;
    int16_t bx = ic->x;
    int16_t by = ic->y;
    int16_t bw = ic->w;
    int16_t bh = ic->h;
    if (bw < 1 || bh < 1) return;
    size_t n = (size_t)bw * (size_t)bh;
    AnimSnapSlot *slot = snapAlloc(ic);
    if (!slot) return;
    if (!slot->buf || slot->count != n || slot->x != bx || slot->y != by || slot->w != bw || slot->h != bh) {
        if (slot->buf) free(slot->buf);
        snapFreeReady(*slot);
        slot->buf = snapAllocBuf(n);
        slot->count = n;
    }
    if (!slot->buf) return;
    slot->x = bx;
    slot->y = by;
    slot->w = bw;
    slot->h = bh;
    Display &disp = static_cast<Display &>(g);
    disp.readBufferRectNative(bx, by, bw, bh, slot->buf);
    const IconAnimAsset *anim = lookupAnimRef(ic->iconRef());
    if (anim) {
        uint8_t fc = iconAnimFrameCount(anim);
        sdCacheWarmAnim(anim, 0);
        if (snapEnsureReadyMeta(slot, fc)) {
            buildAnimReady(slot, anim, 0);
        }
    }
}

void iconAnimResetScreen(Screen *screen) {
    snapFreeAll();
    if (!screen) return;
    for (Widget *w = screen->first(); w; w = w->_next) {
        Icon *ic = w->asIcon();
        if (ic) ic->resetAnimPlayback();
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
#if defined(ESP32)
            int16_t aw = (int16_t)pgm_read_word(&anim->width);
#else
            int16_t aw = anim->width;
#endif
            if (aw > 0) return aw;
            return 16;
        }
    }
    if (_imageLookup) {
        const ImageAsset *img = _imageLookup(ref);
        if (img) {
            int16_t iw = imageAssetWidth(img);
            if (iw > 0) return iw;
        }
    }
    return 16;
}

void drawIconAnimFrame(Gfx &g, const char *ref, uint8_t frameIndex, int16_t x, int16_t y, int16_t dw,
                       int16_t dh, uint16_t bg) {
    if (refEmpty(ref) || dw < 1 || dh < 1) return;
    const IconAnimAsset *anim = lookupAnimRef(ref);
    if (!anim) return;
    const ImageAsset *frame = iconAnimFramePtr(anim, frameIndex);
    if (frame) drawAnimFrameFit(g, frame, x, y, dw, dh, bg);
}

void drawIconRef(Gfx &g, const char *ref, int16_t x, int16_t y, int16_t dw, int16_t dh, uint16_t tint,
                 uint16_t bg) {
    (void)tint;
    if (refEmpty(ref) || dw < 1 || dh < 1) return;

    if (iconRefIsAnim(ref)) {
        const IconAnimAsset *anim = lookupAnimRef(ref);
        if (anim && iconAnimFrameCount(anim) && iconAnimFramesPtr(anim)) {
            uint8_t fi = iconAnimFrameAt(anim, animScaledMs(millis()));
            const ImageAsset *frame = iconAnimFramePtr(anim, fi);
            if (frame) {
                drawAnimFrameFit(g, frame, x, y, dw, dh, bg);
            }
        }
        return;
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
        if (img && (imageAssetData(img) || isFileBackedStorage(imageAssetStorage(img)))) {
            Widget::drawImageAsset(g, img, x, y, dw, dh, bg);
        }
    }
}

}
