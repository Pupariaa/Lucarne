#ifndef LUCARNE_IMAGE_LOADER_H
#define LUCARNE_IMAGE_LOADER_H

#include "LucarneImageAsset.h"
#include "LucarneIconAnim.h"

namespace lucarne {

class Gfx;

enum class SdImageFail : uint8_t {
    None = 0,
    NoPath,
    NotMounted,
    Open,
    Size,
    Read,
    Memory,
    AlphaOpen,
    AlphaSize,
    AlphaRead,
};

class Display;

void releaseSdImageCache();
void setSdCacheMaxBytes(size_t bytes);
SdImageFail sdImageLastFail();
const char *sdImageLastPath();
void sdImageClearFail();
bool sdCacheEnsure(const ImageAsset *asset);
void sdCacheWarmAnim(const IconAnimAsset *anim, uint8_t maxFrames = 0);
bool sdBuildDisplayFrame(const ImageAsset *asset, int16_t boxW, int16_t boxH,
                         const uint16_t *underNative, uint16_t *outBe16);
bool imageAssetDrawReady(const ImageAsset *asset);
bool drawImageAssetSd(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw, int16_t dh,
                      uint16_t bg);
bool drawImageAssetSdNative(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t srcOx,
                            int16_t srcOy, int16_t viewW, int16_t viewH, uint16_t bg);
bool drawImageAssetSdFitOver(Display &disp, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw,
                             int16_t dh, const uint16_t *under, int16_t uw, int16_t uh);

// PSRAM asset cache: for images marked ImageStorage::Psram, copies the flash-
// embedded pixel/alpha data into a heap_caps_malloc(MALLOC_CAP_SPIRAM) buffer
// once (typically during screenPrefetchAssets), so repeated blits read from
// fast PSRAM instead of the flash-mapped PROGMEM array. No-op (returns false)
// on boards without PSRAM, in which case drawing transparently falls back to
// the flash-embedded pixels.
bool psramCacheEnsure(const ImageAsset *asset);
const uint16_t *psramCacheData(const ImageAsset *asset);
const uint8_t *psramCacheAlpha(const ImageAsset *asset);

}

#endif
