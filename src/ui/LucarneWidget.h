#ifndef LUCARNE_WIDGET_H
#define LUCARNE_WIDGET_H

#include <stdint.h>
#include "../core/LucarneGfx.h"
#include "LucarneTheme.h"
#include "LucarneStore.h"

namespace lucarne {

enum class TextAlign : uint8_t { Left, Center, Right };

class Menu;

class Widget {
  public:
    Widget(int16_t x, int16_t y, int16_t w, int16_t h);
    virtual ~Widget();

    virtual void draw(Gfx &g, const Theme &theme, Store &store) = 0;
    virtual Menu *asMenu() { return nullptr; }

    void setBounds(int16_t x, int16_t y, int16_t w, int16_t h);
    void setVisible(bool v) { visible = v; }

    int16_t x;
    int16_t y;
    int16_t w;
    int16_t h;
    bool visible;
    Widget *_next;

  protected:
    static void drawText(Gfx &g, const Theme &theme, const char *text, int16_t bx, int16_t by,
                         int16_t bw, int16_t bh, TextAlign align, uint16_t color, uint8_t size,
                         uint16_t bg, const AAFont *aafont);
    static void drawIcon(Gfx &g, const uint16_t *rows, int16_t x, int16_t y, uint8_t scale,
                         uint16_t color);
};

}

#endif
