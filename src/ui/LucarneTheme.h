#ifndef LUCARNE_THEME_H
#define LUCARNE_THEME_H

#include <stdint.h>
#include "../core/LucarneColor.h"
#include "../core/LucarneFont.h"

namespace lucarne {

struct Theme {
    uint16_t background = color565(8, 12, 20);
    uint16_t surface = color565(20, 28, 40);
    uint16_t surfaceEdge = color565(50, 64, 90);
    uint16_t text = color565(230, 240, 255);
    uint16_t textDim = color565(140, 160, 190);
    uint16_t primary = color565(94, 150, 255);
    uint16_t success = color565(94, 232, 140);
    uint16_t warning = color565(246, 183, 55);
    uint16_t danger = color565(246, 86, 86);
    int16_t radius = 8;
    int16_t padding = 8;
    int16_t rowHeight = 30;
    const AAFont *font = nullptr;
    const AAFont *fontTitle = nullptr;
    uint8_t textSize = 1;
};

}

#endif
