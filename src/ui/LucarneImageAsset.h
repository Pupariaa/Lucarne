#ifndef LUCARNE_IMAGE_ASSET_H
#define LUCARNE_IMAGE_ASSET_H

#include <stdint.h>
#include <stddef.h>

#if defined(ESP32)
#include <pgmspace.h>
#endif

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

#if defined(ESP32)

inline int16_t imageAssetWidth(const ImageAsset *asset) {
    return asset ? asset->width : 0;
}

inline int16_t imageAssetHeight(const ImageAsset *asset) {
    return asset ? asset->height : 0;
}

inline ImageStorage imageAssetStorage(const ImageAsset *asset) {
    return asset ? asset->storage : ImageStorage::Flash;
}

inline const uint16_t *imageAssetData(const ImageAsset *asset) {
    return asset ? asset->data : nullptr;
}

inline const uint8_t *imageAssetAlpha(const ImageAsset *asset) {
    return asset ? asset->alpha : nullptr;
}

inline uint8_t imageAssetAlphaAt(const uint8_t *alpha, size_t index) {
    if (!alpha) return 255;
    return pgm_read_byte(alpha + index);
}

inline uint16_t imageAssetPixel565(const uint16_t *pixels, size_t index) {
    return pgm_read_word(pixels + index);
}

#else

inline int16_t imageAssetWidth(const ImageAsset *asset) {
    return asset ? asset->width : 0;
}

inline int16_t imageAssetHeight(const ImageAsset *asset) {
    return asset ? asset->height : 0;
}

inline ImageStorage imageAssetStorage(const ImageAsset *asset) {
    return asset ? asset->storage : ImageStorage::Flash;
}

inline const uint16_t *imageAssetData(const ImageAsset *asset) {
    return asset ? asset->data : nullptr;
}

inline const uint8_t *imageAssetAlpha(const ImageAsset *asset) {
    return asset ? asset->alpha : nullptr;
}

inline uint8_t imageAssetAlphaAt(const uint8_t *alpha, size_t index) {
    return alpha ? alpha[index] : 255;
}

inline uint16_t imageAssetPixel565(const uint16_t *pixels, size_t index) {
    return pixels[index];
}

#endif

}

#endif
