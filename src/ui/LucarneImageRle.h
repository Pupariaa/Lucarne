#ifndef LUCARNE_IMAGE_RLE_H
#define LUCARNE_IMAGE_RLE_H

#include <stdint.h>
#include "LucarneImageAsset.h"
#include "../core/LucarneGfx.h"

namespace lucarne {

void drawImageRleFit(Gfx &g, const ImageAsset *asset, int16_t x, int16_t y, int16_t dw, int16_t dh,
                     uint16_t bg);

}

#endif
