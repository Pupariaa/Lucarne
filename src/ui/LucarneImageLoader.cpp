#include "LucarneImageLoader.h"
#include "../core/LucarneGfx.h"
#include <stdlib.h>
#include <string.h>

#if defined(ESP32)
#include <SD.h>
#define LUCARNE_SD_FS 1
#else
#define LUCARNE_SD_FS 0
#endif

namespace lucarne {

static const size_t SD_CACHE_MAX_BYTES = 384 * 1024;

struct SdImageCache {
    const char *source;
    uint16_t *pixels;
    int16_t width;
    int16_t height;
};

static SdImageCache _sdCache = {nullptr, nullptr, 0, 0};

void releaseSdImageCache() {
    if (_sdCache.pixels) {
        free(_sdCache.pixels);
        _sdCache.pixels = nullptr;
    }
    _sdCache.source = nullptr;
    _sdCache.width = 0;
    _sdCache.height = 0;
}

static bool sdPathMatches(const char *a, const char *b) {
    if (!a || !b) return false;
    return strcmp(a, b) == 0;
}

static const uint16_t *sdCacheLoad(const ImageAsset *asset) {
    if (!asset || !asset->source || !asset->source[0]) return nullptr;
    if (asset->width < 1 || asset->height < 1) return nullptr;

    if (sdPathMatches(_sdCache.source, asset->source) && _sdCache.pixels &&
        _sdCache.width == asset->width && _sdCache.height == asset->height) {
        return _sdCache.pixels;
    }

    releaseSdImageCache();

    size_t bytes = (size_t)asset->width * (size_t)asset->height * 2;
    if (bytes == 0 || bytes > SD_CACHE_MAX_BYTES) return nullptr;

#if LUCARNE_SD_FS
    File f = SD.open(asset->source, FILE_READ);
    if (!f) return nullptr;
    if ((size_t)f.size() < bytes) {
        f.close();
        return nullptr;
    }

    uint16_t *buf = (uint16_t *)malloc(bytes);
    if (!buf) {
        f.close();
        return nullptr;
    }

    size_t got = f.read((uint8_t *)buf, bytes);
    f.close();
    if (got != bytes) {
        free(buf);
        return nullptr;
    }

    _sdCache.source = asset->source;
    _sdCache.pixels = buf;
    _sdCache.width = asset->width;
    _sdCache.height = asset->height;
    return _sdCache.pixels;
#else
    (void)bytes;
    return nullptr;
#endif
}

static void drawPixelsScaled(Gfx &g, const uint16_t *pix, int16_t sw, int16_t sh, int16_t x, int16_t y,
                             int16_t dw, int16_t dh) {
    if (!pix || sw < 1 || sh < 1 || dw < 1 || dh < 1) return;
    for (int16_t py = 0; py < dh; py++) {
        int16_t sy = (int16_t)((py * sh) / dh);
        for (int16_t px = 0; px < dw; px++) {
            int16_t sx = (int16_t)((px * sw) / dw);
            size_t si = (size_t)sy * (size_t)sw + (size_t)sx;
            g.drawPixel((int16_t)(x + px), (int16_t)(y + py), pix[si]);
        }
    }
}

#if LUCARNE_SD_FS
static bool drawSdStream(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw, int16_t dh) {
    if (!asset || !asset->source || !asset->source[0]) return false;
    int16_t sw = asset->width;
    int16_t sh = asset->height;
    if (sw < 1) sw = 1;
    if (sh < 1) sh = 1;

    File f = SD.open(asset->source, FILE_READ);
    if (!f) return false;

    const size_t rowBytes = (size_t)sw * 2;
    uint16_t *row = (uint16_t *)malloc(rowBytes);
    if (!row) {
        f.close();
        return false;
    }

    for (int16_t py = 0; py < dh; py++) {
        int16_t sy = (int16_t)((py * sh) / dh);
        size_t off = (size_t)sy * rowBytes;
        if (!f.seek(off) || f.read((uint8_t *)row, rowBytes) != rowBytes) break;
        for (int16_t px = 0; px < dw; px++) {
            int16_t sx = (int16_t)((px * sw) / dw);
            g.drawPixel((int16_t)(x + px), (int16_t)(y + py), row[sx]);
        }
    }

    free(row);
    f.close();
    return true;
}
#endif

bool drawImageAssetSd(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw, int16_t dh,
                      uint16_t bg) {
    (void)bg;
    if (!asset || asset->storage != ImageStorage::Sd) return false;

    const uint16_t *pix = sdCacheLoad(asset);
    if (pix) {
        drawPixelsScaled(g, pix, asset->width, asset->height, x, y, dw, dh);
        return true;
    }

#if LUCARNE_SD_FS
    return drawSdStream(g, asset, x, y, dw, dh);
#else
    return false;
#endif
}

}
