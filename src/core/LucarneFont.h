#ifndef LUCARNE_FONT_H
#define LUCARNE_FONT_H

#include <stdint.h>

namespace lucarne {

typedef struct {
    uint16_t bitmapOffset;
    uint8_t width;
    uint8_t height;
    uint8_t xAdvance;
    int8_t xOffset;
    int8_t yOffset;
} Glyph;

typedef struct {
    const uint8_t *bitmap;
    const Glyph *glyph;
    uint16_t first;
    uint16_t last;
    uint8_t yAdvance;
} Font;

extern const uint8_t LucarneClassicFont[];

}

#endif
