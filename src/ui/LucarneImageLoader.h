#ifndef LUCARNE_IMAGE_LOADER_H
#define LUCARNE_IMAGE_LOADER_H

#include "LucarneImageAsset.h"

namespace lucarne {

class Gfx;

void releaseSdImageCache();
bool drawImageAssetSd(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw, int16_t dh,
                      uint16_t bg);

}

#endif
