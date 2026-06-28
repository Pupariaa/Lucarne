#ifndef LUCARNE_ICON_ANIM_H
#define LUCARNE_ICON_ANIM_H

#include <stdint.h>
#include "LucarneImageAsset.h"

#if defined(ESP32)
#include <pgmspace.h>
#endif

namespace lucarne {

struct IconAnimAsset {
    int16_t width;
    int16_t height;
    uint8_t frameCount;
    uint16_t numPlays;
    const uint16_t *delaysMs;
    const ImageAsset *const *frames;
};

inline uint8_t iconAnimFrameCount(const IconAnimAsset *anim) {
    if (!anim) return 0;
#if defined(ESP32)
    return pgm_read_byte(&anim->frameCount);
#else
    return anim->frameCount;
#endif
}

inline const uint16_t *iconAnimDelaysPtr(const IconAnimAsset *anim) {
    if (!anim) return nullptr;
#if defined(ESP32)
    return (const uint16_t *)pgm_read_ptr(&anim->delaysMs);
#else
    return anim->delaysMs;
#endif
}

inline const ImageAsset *const *iconAnimFramesPtr(const IconAnimAsset *anim) {
    if (!anim) return nullptr;
#if defined(ESP32)
    return (const ImageAsset *const *)pgm_read_ptr(&anim->frames);
#else
    return anim->frames;
#endif
}

inline uint16_t iconAnimDelayMs(const IconAnimAsset *anim, uint8_t index) {
    const uint16_t *delays = iconAnimDelaysPtr(anim);
    if (!delays) return 42;
#if defined(ESP32)
    const uint16_t PROGMEM *pd = (const uint16_t PROGMEM *)delays;
    uint16_t d = pgm_read_word(&pd[index]);
#else
    uint16_t d = delays[index];
#endif
    return d > 0 ? d : 42;
}

inline const ImageAsset *iconAnimFramePtr(const IconAnimAsset *anim, uint8_t index) {
    const ImageAsset *const *frames = iconAnimFramesPtr(anim);
    if (!frames) return nullptr;
#if defined(ESP32)
    const ImageAsset *const PROGMEM *pf = (const ImageAsset *const PROGMEM *)frames;
    return (const ImageAsset *)pgm_read_ptr(&pf[index]);
#else
    return frames[index];
#endif
}

inline uint8_t iconAnimFrameAt(const IconAnimAsset *anim, uint32_t ms) {
    uint8_t frameCount = iconAnimFrameCount(anim);
    if (!frameCount || !iconAnimFramesPtr(anim)) return 0;
    const uint16_t *delays = iconAnimDelaysPtr(anim);
    if (!delays) {
        return (uint8_t)((ms / 42) % (uint32_t)frameCount);
    }
    uint32_t total = 0;
    for (uint8_t i = 0; i < frameCount; i++) {
        total += (uint32_t)iconAnimDelayMs(anim, i);
    }
    if (total < 1) total = (uint32_t)frameCount * 42;
    uint32_t t = ms % total;
    uint32_t elapsed = 0;
    for (uint8_t i = 0; i < frameCount; i++) {
        elapsed += (uint32_t)iconAnimDelayMs(anim, i);
        if (t < elapsed) return i;
    }
    return (uint8_t)(frameCount - 1);
}

}

#endif
