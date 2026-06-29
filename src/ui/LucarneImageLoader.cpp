#include "LucarneImageLoader.h"
#include "../core/LucarneGfx.h"
#include "../core/LucarneColor.h"
#include "../display/LucarneDisplay.h"
#include "LucarneIconAnim.h"
#include "LucarneVolume.h"
#include "../LucarneStorageConfig.h"
#include <stdlib.h>
#include <string.h>

#if defined(ESP32)
#include <Arduino.h>
#if LUCARNE_ENABLE_SD
#include <SD.h>
#endif
#include <pgmspace.h>
#include <esp_heap_caps.h>
#endif

namespace lucarne {

static size_t _sdCacheMaxBytes = 2 * 1024 * 1024;
static bool _sdCacheMaxExplicit = false;
static const uint8_t SD_CACHE_MAX_SLOTS = 32;

struct SdFrameSlot {
    char path[96];
    uint16_t *pixels;
    uint8_t *alpha;
    int16_t width;
    int16_t height;
    bool hasAlpha;
    bool used;
    uint32_t lru;
};

static SdFrameSlot _sdSlots[SD_CACHE_MAX_SLOTS];
static size_t _sdCacheBytes = 0;
static uint32_t _sdCacheGen = 0;
static SdImageFail _lastFail = SdImageFail::None;
static char _lastPath[96] = {0};

static void sdSetFail(SdImageFail code, const char *path, ImageStorage st = ImageStorage::Flash) {
    _lastFail = code;
    if (path) {
#if defined(ESP32)
        strncpy_P(_lastPath, path, sizeof(_lastPath) - 1);
#else
        strncpy(_lastPath, path, sizeof(_lastPath) - 1);
#endif
        _lastPath[sizeof(_lastPath) - 1] = '\0';
    } else {
        _lastPath[0] = '\0';
    }
#if LUCARNE_FILE_FS
    static bool logged;
    if (!logged) {
        logged = true;
        Serial.print(F("Lucarne asset: "));
        if (st == ImageStorage::Volume) Serial.print(F("volume "));
        else if (st == ImageStorage::Sd) Serial.print(F("SD "));
        if (code == SdImageFail::NotMounted) {
            if (st == ImageStorage::Volume) Serial.print(F("not mounted"));
            else Serial.print(F("card not mounted"));
        } else if (code == SdImageFail::Open) Serial.print(F("file not found"));
        else if (code == SdImageFail::Size) Serial.print(F("bad file size"));
        else if (code == SdImageFail::Read) Serial.print(F("read failed"));
        else if (code == SdImageFail::Memory) Serial.print(F("out of memory"));
        else {
            Serial.print(F("fail "));
            Serial.print((int)code);
        }
        Serial.print(F(" — "));
        Serial.println(path ? path : "?");
    }
#endif
}

SdImageFail sdImageLastFail() { return _lastFail; }

const char *sdImageLastPath() { return _lastPath[0] ? _lastPath : nullptr; }

void sdImageClearFail() {
    _lastFail = SdImageFail::None;
    _lastPath[0] = '\0';
}

static void *sdAllocBytes(size_t bytes) {
    if (!bytes) return nullptr;
#if defined(ESP32)
    void *p = heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!p) p = malloc(bytes);
    return p;
#else
    return malloc(bytes);
#endif
}

static void sdFreeSlot(SdFrameSlot &slot) {
    if (slot.pixels) {
        size_t pxBytes = (size_t)slot.width * (size_t)slot.height * 2;
        if (slot.alpha) pxBytes += (size_t)slot.width * (size_t)slot.height;
        if (_sdCacheBytes >= pxBytes) _sdCacheBytes -= pxBytes;
        else _sdCacheBytes = 0;
        free(slot.pixels);
    }
    if (slot.alpha) free(slot.alpha);
    slot = {};
}

void releaseSdImageCache() {
    for (uint8_t i = 0; i < SD_CACHE_MAX_SLOTS; i++) {
        if (_sdSlots[i].used) sdFreeSlot(_sdSlots[i]);
    }
    _sdCacheBytes = 0;
}

void setSdCacheMaxBytes(size_t bytes) {
    if (bytes < 64 * 1024) bytes = 64 * 1024;
    _sdCacheMaxBytes = bytes;
    _sdCacheMaxExplicit = true;
}

static void sdApplyDefaultCacheBudget() {
    static bool done;
    if (done) return;
    done = true;
    if (_sdCacheMaxExplicit) return;
#if defined(ESP32)
    size_t psram = ESP.getPsramSize();
    if (psram <= 2 * 1024 * 1024) _sdCacheMaxBytes = 512 * 1024;
    else if (psram < 6 * 1024 * 1024) _sdCacheMaxBytes = 1024 * 1024;
#endif
}

static void sdCopyPath(char *dst, size_t dstLen, const char *path) {
    if (!dst || dstLen < 2 || !path) {
        if (dst && dstLen) dst[0] = '\0';
        return;
    }
#if defined(ESP32)
    strncpy_P(dst, path, dstLen - 1);
#else
    strncpy(dst, path, dstLen - 1);
#endif
    dst[dstLen - 1] = '\0';
}

static bool sdPathEqSlot(const SdFrameSlot &slot, const char *path) {
    if (!slot.used || !path || !slot.path[0]) return false;
#if defined(ESP32)
    return strcmp_P(slot.path, path) == 0;
#else
    return strcmp(slot.path, path) == 0;
#endif
}

#if LUCARNE_FILE_FS
static bool fileStorageReady(ImageStorage st) {
#if LUCARNE_ENABLE_SD
    if (st == ImageStorage::Sd) return SD.cardType() != CARD_NONE;
#endif
#if LUCARNE_ENABLE_VOLUME
    if (st == ImageStorage::Volume) return volumeMounted();
#endif
    return false;
}

static File openFileStorage(const char *pathBuf, ImageStorage st) {
#if LUCARNE_ENABLE_SD
    if (st == ImageStorage::Sd) return SD.open(pathBuf, FILE_READ);
#endif
#if LUCARNE_ENABLE_VOLUME
    if (st == ImageStorage::Volume) {
        fs::FS *vfs = volumeFs();
        if (!vfs) return File();
        return vfs->open(pathBuf, FILE_READ);
    }
#endif
    return File();
}
#endif

static bool alphaPathForRgb(const char *rgbPath, char *out, size_t outLen) {
    if (!rgbPath || !out || outLen < 8) return false;
#if defined(ESP32)
    size_t n = strlen_P(rgbPath);
    const char *suffix = ".rgb565";
    size_t sl = strlen(suffix);
    if (n < sl) return false;
    char tail[8];
    strncpy_P(tail, rgbPath + n - sl, sl);
    tail[sl] = '\0';
    if (strcmp(tail, suffix) != 0) return false;
    size_t baseLen = n - sl;
    if (baseLen + 7 >= outLen) return false;
    strncpy_P(out, rgbPath, baseLen);
    memcpy(out + baseLen, ".alpha", 7);
    out[baseLen + 6] = '\0';
    return true;
#else
    size_t n = strlen(rgbPath);
    const char *suffix = ".rgb565";
    size_t sl = strlen(suffix);
    if (n < sl || strcmp(rgbPath + n - sl, suffix) != 0) return false;
    size_t baseLen = n - sl;
    if (baseLen + 7 >= outLen) return false;
    memcpy(out, rgbPath, baseLen);
    memcpy(out + baseLen, ".alpha", 7);
    out[baseLen + 6] = '\0';
    return true;
#endif
}

static size_t sdSlotFootprint(int16_t w, int16_t h, bool withAlpha) {
    size_t n = (size_t)w * (size_t)h;
    return n * 2 + (withAlpha ? n : 0);
}

static SdFrameSlot *sdCacheFind(const char *path, int16_t w, int16_t h) {
    for (uint8_t i = 0; i < SD_CACHE_MAX_SLOTS; i++) {
        SdFrameSlot &s = _sdSlots[i];
        if (s.used && s.pixels && s.width == w && s.height == h && sdPathEqSlot(s, path)) {
            s.lru = ++_sdCacheGen;
            return &s;
        }
    }
    return nullptr;
}

static SdFrameSlot *sdCachePickVictim() {
    SdFrameSlot *empty = nullptr;
    SdFrameSlot *lru = nullptr;
    for (uint8_t i = 0; i < SD_CACHE_MAX_SLOTS; i++) {
        SdFrameSlot &s = _sdSlots[i];
        if (!s.used || !s.pixels) {
            if (!empty) empty = &s;
            continue;
        }
        if (!lru || s.lru < lru->lru) lru = &s;
    }
    return empty ? empty : lru;
}

static SdFrameSlot *sdCacheLoadSlot(const ImageAsset *asset, bool *hasAlphaOut) {
    if (hasAlphaOut) *hasAlphaOut = false;
    const char *path = imageAssetSource(asset);
    if (!path || !path[0]) {
        sdSetFail(SdImageFail::NoPath, nullptr);
        return nullptr;
    }
    int16_t aw = imageAssetWidth(asset);
    int16_t ah = imageAssetHeight(asset);
    if (aw < 1 || ah < 1) {
        sdSetFail(SdImageFail::Size, path);
        return nullptr;
    }

    SdFrameSlot *hit = sdCacheFind(path, aw, ah);
    if (hit) {
        if (hasAlphaOut) *hasAlphaOut = hit->hasAlpha;
        return hit;
    }

    size_t pxBytes = (size_t)aw * (size_t)ah * 2;
    sdApplyDefaultCacheBudget();
    if (pxBytes == 0 || pxBytes > _sdCacheMaxBytes) {
        sdSetFail(SdImageFail::Size, path);
        return nullptr;
    }

    size_t need = sdSlotFootprint(aw, ah, true);
    while (_sdCacheBytes + need > _sdCacheMaxBytes) {
        SdFrameSlot *victim = sdCachePickVictim();
        if (!victim || !victim->used || !victim->pixels) break;
        sdFreeSlot(*victim);
    }

    SdFrameSlot *slot = sdCachePickVictim();
    if (!slot) {
        sdSetFail(SdImageFail::Memory, path);
        return nullptr;
    }
    if (slot->used) sdFreeSlot(*slot);

#if LUCARNE_FILE_FS
    char pathBuf[96];
    sdCopyPath(pathBuf, sizeof(pathBuf), path);
    ImageStorage st = imageAssetStorage(asset);
    if (!isFileBackedStorage(st)) {
        sdSetFail(SdImageFail::Open, path, st);
        return nullptr;
    }
    if (!fileStorageReady(st)) {
        sdSetFail(SdImageFail::NotMounted, path, st);
        return nullptr;
    }
    File f = openFileStorage(pathBuf, st);
    if (!f) {
        sdSetFail(SdImageFail::Open, path, st);
        return nullptr;
    }
    if ((size_t)f.size() < pxBytes) {
        f.close();
        sdSetFail(SdImageFail::Size, path);
        return nullptr;
    }

    uint16_t *buf = (uint16_t *)sdAllocBytes(pxBytes);
    if (!buf) {
        f.close();
        sdSetFail(SdImageFail::Memory, path);
        return nullptr;
    }

    size_t got = f.read((uint8_t *)buf, pxBytes);
    f.close();
    if (got != pxBytes) {
        free(buf);
        sdSetFail(SdImageFail::Read, path);
        return nullptr;
    }

    uint8_t *abuf = nullptr;
    bool hasAlpha = false;
    char alphaPath[96];
    if (alphaPathForRgb(path, alphaPath, sizeof(alphaPath))) {
        char alphaBuf[96];
        sdCopyPath(alphaBuf, sizeof(alphaBuf), alphaPath);
        File af = openFileStorage(alphaBuf, st);
        if (!af) {
            sdSetFail(SdImageFail::AlphaOpen, alphaPath);
        } else {
            size_t aBytes = (size_t)aw * (size_t)ah;
            if ((size_t)af.size() < aBytes) {
                sdSetFail(SdImageFail::AlphaSize, alphaPath);
            } else {
                abuf = (uint8_t *)sdAllocBytes(aBytes);
                if (!abuf) {
                    sdSetFail(SdImageFail::Memory, alphaPath);
                } else if (af.read(abuf, aBytes) != aBytes) {
                    free(abuf);
                    abuf = nullptr;
                    sdSetFail(SdImageFail::AlphaRead, alphaPath);
                } else {
                    hasAlpha = true;
                }
            }
            af.close();
        }
    }

    sdCopyPath(slot->path, sizeof(slot->path), path);
    slot->pixels = buf;
    slot->alpha = abuf;
    slot->width = aw;
    slot->height = ah;
    slot->hasAlpha = hasAlpha;
    slot->used = true;
    slot->lru = ++_sdCacheGen;
    _sdCacheBytes += sdSlotFootprint(aw, ah, hasAlpha);
    if (hasAlphaOut) *hasAlphaOut = hasAlpha;
    return slot;
#else
    (void)slot;
    (void)pxBytes;
    sdSetFail(SdImageFail::Open, path);
    return nullptr;
#endif
}

bool sdCacheEnsure(const ImageAsset *asset) {
    return sdCacheLoadSlot(asset, nullptr) != nullptr;
}

void sdCacheWarmAnim(const IconAnimAsset *anim, uint8_t maxFrames) {
    if (!anim) return;
    uint8_t n = iconAnimFrameCount(anim);
    if (maxFrames > 0 && maxFrames < n) n = maxFrames;
    for (uint8_t i = 0; i < n; i++) {
        const ImageAsset *frame = iconAnimFramePtr(anim, i);
        if (frame) sdCacheEnsure(frame);
    }
}

static inline uint16_t pxBe16(uint16_t c) { return (uint16_t)((c << 8) | (c >> 8)); }

static void fitBoxDims(int16_t boxW, int16_t boxH, int16_t sw, int16_t sh, int16_t *rw, int16_t *rh,
                       int16_t *ox, int16_t *oy) {
    *rw = boxW;
    *rh = boxH;
    if (sw * boxH < sh * boxW) {
        *rw = (int16_t)((sw * boxH) / sh);
        if (*rw < 1) *rw = 1;
    } else if (sh * boxW < sw * boxH) {
        *rh = (int16_t)((sh * boxW) / sw);
        if (*rh < 1) *rh = 1;
    }
    *ox = (int16_t)((boxW - *rw) / 2);
    *oy = (int16_t)((boxH - *rh) / 2);
}

bool sdBuildDisplayFrame(const ImageAsset *asset, int16_t boxW, int16_t boxH, const uint16_t *underNative,
                         uint16_t *outBe16) {
    if (!asset || !underNative || !outBe16 || boxW < 1 || boxH < 1) return false;
    size_t n = (size_t)boxW * (size_t)boxH;
    for (size_t i = 0; i < n; i++) {
        outBe16[i] = pxBe16(underNative[i]);
    }
    if (imageAssetStorage(asset) != ImageStorage::Sd && imageAssetStorage(asset) != ImageStorage::Volume)
        return false;

    bool hasAlpha = false;
    SdFrameSlot *slot = sdCacheLoadSlot(asset, &hasAlpha);
    if (!slot || !slot->pixels) return false;

    int16_t sw = slot->width;
    int16_t sh = slot->height;
    int16_t rw, rh, ox, oy;
    fitBoxDims(boxW, boxH, sw, sh, &rw, &rh, &ox, &oy);

    for (int16_t py = 0; py < rh; py++) {
        int16_t sy = (int16_t)((py * sh) / rh);
        for (int16_t px = 0; px < rw; px++) {
            int16_t sx = (int16_t)((px * sw) / rw);
            size_t si = (size_t)sy * (size_t)sw + (size_t)sx;
            int16_t lx = (int16_t)(ox + px);
            int16_t ly = (int16_t)(oy + py);
            size_t di = (size_t)ly * (size_t)boxW + (size_t)lx;
            uint16_t bg = underNative[di];
            if (hasAlpha && slot->alpha) {
                uint8_t a = slot->alpha[si];
                if (a < 8) continue;
                uint16_t fg = slot->pixels[si];
                uint16_t out = a >= 250 ? fg : colorBlend(bg, fg, a);
                outBe16[di] = pxBe16(out);
            } else {
                outBe16[di] = pxBe16(slot->pixels[si]);
            }
        }
    }
    return true;
}

static void drawPixelsFit(Gfx &g, const uint16_t *pix, const uint8_t *alpha, bool hasAlpha, int16_t sw,
                          int16_t sh, int16_t x, int16_t y, int16_t dw, int16_t dh, uint16_t bg) {
    if (!pix || sw < 1 || sh < 1 || dw < 1 || dh < 1) return;
    int16_t rw = dw;
    int16_t rh = dh;
    if (sw * dh < sh * dw) {
        rw = (int16_t)((sw * dh) / sh);
        if (rw < 1) rw = 1;
    } else if (sh * dw < sw * dh) {
        rh = (int16_t)((sh * dw) / sw);
        if (rh < 1) rh = 1;
    }
    int16_t ox = (int16_t)(x + (dw - rw) / 2);
    int16_t oy = (int16_t)(y + (dh - rh) / 2);
    for (int16_t py = 0; py < rh; py++) {
        int16_t sy = (int16_t)((py * sh) / rh);
        for (int16_t px = 0; px < rw; px++) {
            int16_t sx = (int16_t)((px * sw) / rw);
            size_t si = (size_t)sy * (size_t)sw + (size_t)sx;
            int16_t dx = (int16_t)(ox + px);
            int16_t dy = (int16_t)(oy + py);
            uint16_t fg = pix[si];
            if (hasAlpha && alpha) {
                uint8_t a = alpha[si];
                if (a < 8) continue;
                uint16_t under = g.canPeekPixel() ? g.peekPixel(dx, dy) : bg;
                g.writePixel(dx, dy, a >= 250 ? fg : colorBlend(under, fg, a));
            } else {
                g.drawPixel(dx, dy, fg);
            }
        }
    }
}

#if LUCARNE_FILE_FS
static bool drawSdStreamFit(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw, int16_t dh,
                            uint16_t bg) {
    const char *path = imageAssetSource(asset);
    if (!path || !path[0]) {
        sdSetFail(SdImageFail::NoPath, nullptr);
        return false;
    }
    char pathBuf[96];
    sdCopyPath(pathBuf, sizeof(pathBuf), path);
    int16_t sw = imageAssetWidth(asset);
    int16_t sh = imageAssetHeight(asset);
    if (sw < 1) sw = 1;
    if (sh < 1) sh = 1;

    int16_t rw = dw;
    int16_t rh = dh;
    if (sw * dh < sh * dw) {
        rw = (int16_t)((sw * dh) / sh);
        if (rw < 1) rw = 1;
    } else if (sh * dw < sw * dh) {
        rh = (int16_t)((sh * dw) / sw);
        if (rh < 1) rh = 1;
    }
    int16_t ox = (int16_t)(x + (dw - rw) / 2);
    int16_t oy = (int16_t)(y + (dh - rh) / 2);

    ImageStorage st = imageAssetStorage(asset);
    if (!isFileBackedStorage(st) || !fileStorageReady(st)) {
        sdSetFail(SdImageFail::NotMounted, path, st);
        return false;
    }
    File f = openFileStorage(pathBuf, st);
    if (!f) {
        sdSetFail(SdImageFail::Open, path, st);
        return false;
    }

    const size_t rowBytes = (size_t)sw * 2;
    uint16_t *row = (uint16_t *)malloc(rowBytes);
    if (!row) {
        f.close();
        sdSetFail(SdImageFail::Memory, path);
        return false;
    }

    char alphaPath[96];
    bool hasAlphaFile = alphaPathForRgb(path, alphaPath, sizeof(alphaPath));
    File af;
    uint8_t *arow = nullptr;
    if (hasAlphaFile) {
        char alphaBuf[96];
        sdCopyPath(alphaBuf, sizeof(alphaBuf), alphaPath);
        af = openFileStorage(alphaBuf, st);
        if (af) arow = (uint8_t *)malloc((size_t)sw);
        else sdSetFail(SdImageFail::AlphaOpen, alphaPath);
    }

    for (int16_t py = 0; py < rh; py++) {
        int16_t sy = (int16_t)((py * sh) / rh);
        size_t off = (size_t)sy * rowBytes;
        if (!f.seek(off) || f.read((uint8_t *)row, rowBytes) != rowBytes) break;
        if (arow && af) {
            size_t aoff = (size_t)sy * (size_t)sw;
            if (!af.seek(aoff) || af.read(arow, (size_t)sw) != (size_t)sw) {
                for (int16_t px = 0; px < rw; px++) {
                    int16_t sx = (int16_t)((px * sw) / rw);
                    g.drawPixel((int16_t)(ox + px), (int16_t)(oy + py), row[sx]);
                }
                continue;
            }
        }
        for (int16_t px = 0; px < rw; px++) {
            int16_t sx = (int16_t)((px * sw) / rw);
            int16_t dx = (int16_t)(ox + px);
            int16_t dy = (int16_t)(oy + py);
            if (arow && af) {
                uint8_t a = arow[sx];
                if (a < 8) continue;
                uint16_t under = g.canPeekPixel() ? g.peekPixel(dx, dy) : bg;
                g.writePixel(dx, dy, a >= 250 ? row[sx] : colorBlend(under, row[sx], a));
            } else {
                g.drawPixel(dx, dy, row[sx]);
            }
        }
    }

    if (arow) free(arow);
    if (af) af.close();
    free(row);
    f.close();
    return true;
}
#endif

bool drawImageAssetSd(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw, int16_t dh,
                      uint16_t bg) {
    if (!asset || !isFileBackedStorage(imageAssetStorage(asset))) return false;

    bool hasAlpha = false;
    SdFrameSlot *slot = sdCacheLoadSlot(asset, &hasAlpha);
    if (slot && slot->pixels) {
        drawPixelsFit(g, slot->pixels, slot->alpha, hasAlpha, slot->width, slot->height, x, y, dw, dh, bg);
        return true;
    }

#if LUCARNE_FILE_FS
    return drawSdStreamFit(g, asset, x, y, dw, dh, bg);
#else
    return false;
#endif
}

bool drawImageAssetSdFitOver(Display &disp, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw,
                             int16_t dh, const uint16_t *under, int16_t uw, int16_t uh) {
    if (!asset || !isFileBackedStorage(imageAssetStorage(asset)) || !under) return false;

    bool hasAlpha = false;
    SdFrameSlot *slot = sdCacheLoadSlot(asset, &hasAlpha);
    if (!slot || !slot->pixels) return false;

    disp.writePixelsFitOver(x, y, dw, dh, slot->pixels, slot->width, slot->height, slot->alpha,
                            hasAlpha, under, uw, uh);
    return true;
}

}
