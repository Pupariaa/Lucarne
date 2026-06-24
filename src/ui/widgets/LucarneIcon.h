#ifndef LUCARNE_ICON_WIDGET_H
#define LUCARNE_ICON_WIDGET_H

#include "../LucarneWidget.h"
#include "../LucarneIcons.h"

namespace lucarne {

class Icon : public Widget {
  public:
    Icon(int16_t x, int16_t y, IconId id, uint8_t scale = 1);

    void setIcon(IconId id) { _id = id; }
    void setScale(uint8_t scale);
    void setColor(uint16_t color);
    void clearColor();

    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    IconId _id;
    uint8_t _scale;
    uint16_t _color;
    bool _hasColor;
};

}

#endif
