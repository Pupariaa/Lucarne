#ifndef LUCARNE_IMAGE_ASSET_H
#define LUCARNE_IMAGE_ASSET_H

#include <stdint.h>

namespace lucarne {

enum class ImageStorage : uint8_t {
    Flash = 0,
    Sd,
    Web,
    Psrav,
};

struct ImageAsset {
    const uint16_t *data;
    const uint8_t *alpha;
    int16_t width;
    int16_t height;
    ImageStorage storage;
    const char *source;
};

}

#endif
