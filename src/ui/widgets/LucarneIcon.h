#ifndef LUCARNE_ICON_WIDGET_H
#define LUCARNE_ICON_WIDGET_H

#include "../LucarneWidget.h"

namespace lucarne {

class Icon : public Widget {
  public:
    Icon(int16_t x, int16_t y, const char *ref, uint8_t scale = 1);

    void setIconRef(const char *ref);
    void setScale(uint8_t scale);
    void setColor(uint16_t color);
    void clearColor();

    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_ref;
    uint8_t _scale;
    uint16_t _color;
    bool _hasColor;
    void syncBounds();
};

}

#endif
