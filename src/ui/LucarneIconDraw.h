#ifndef LUCARNE_ICON_DRAW_H
#define LUCARNE_ICON_DRAW_H

#include <stdint.h>
#include "LucarneImageAsset.h"
#include "../core/LucarneGfx.h"

namespace lucarne {

typedef const uint16_t *(*IconRowsLookup)(const char *ref);
typedef const ImageAsset *(*IconImageLookup)(const char *ref);

void setIconLookups(IconRowsLookup rows, IconImageLookup image);

bool iconRefValid(const char *ref);
int16_t iconRefBaseSize(const char *ref);
void drawIconRef(Gfx &g, const char *ref, int16_t x, int16_t y, int16_t dw, int16_t dh, uint16_t tint,
                 uint16_t bg);

}

#endif
