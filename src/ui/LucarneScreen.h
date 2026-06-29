#ifndef LUCARNE_SCREEN_H
#define LUCARNE_SCREEN_H

#include "LucarneWidget.h"

namespace lucarne {

class Screen {
  public:
    Screen(const char *name = nullptr);

    void add(Widget *widget);
    void draw(Gfx &g, const Theme &theme, Store &store);
    void redrawRegion(int16_t rx, int16_t ry, int16_t rw, int16_t rh, Gfx &g, const Theme &theme,
                      Store &store);
    const char *name() const { return _name; }
    Widget *first() const { return _head; }

    void setCornerRadius(uint8_t r) { _cornerRadius = r; }
    uint8_t cornerRadius() const { return _cornerRadius; }

  private:
    const char *_name;
    Widget *_head;
    Widget *_tail;
    uint8_t _cornerRadius;
};

}

#endif
