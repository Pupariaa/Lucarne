#ifndef LUCARNE_ICON_DRAW_H
#define LUCARNE_ICON_DRAW_H

#include <stdint.h>
#include "LucarneImageAsset.h"
#include "LucarneIconAnim.h"
#include "../core/LucarneGfx.h"

namespace lucarne {

class Display;
class Screen;
class Theme;
class Store;

typedef const uint16_t *(*IconRowsLookup)(const char *ref);
typedef const ImageAsset *(*IconImageLookup)(const char *ref);
typedef const IconAnimAsset *(*IconAnimLookup)(const char *ref);

void setIconLookups(IconRowsLookup rows, IconImageLookup image, IconAnimLookup anim = nullptr);
void setIconAnimSpeedPercent(uint16_t pct);

bool iconRefValid(const char *ref);
bool iconRefIsAnim(const char *ref);
uint8_t iconRefAnimFrame(const char *ref, uint32_t ms);
bool iconAnimPlaybackActive();
bool iconAnimScreenDirty(Screen *screen);
bool iconAnimPatchScreen(Display &disp, Screen *screen, const Theme &theme, Store &store);
void iconAnimResetScreen(Screen *screen);
int16_t iconRefBaseSize(const char *ref);
void drawIconRef(Gfx &g, const char *ref, int16_t x, int16_t y, int16_t dw, int16_t dh, uint16_t tint,
                 uint16_t bg);

}

#endif
