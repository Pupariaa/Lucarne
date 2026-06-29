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
bool drawImageAssetSd(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw, int16_t dh,
                      uint16_t bg);
bool drawImageAssetSdFitOver(Display &disp, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw,
                             int16_t dh, const uint16_t *under, int16_t uw, int16_t uh);

}

#endif
