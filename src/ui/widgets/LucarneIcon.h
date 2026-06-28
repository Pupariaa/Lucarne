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
    void setTransparent(bool transparent);

    void draw(Gfx &g, const Theme &theme, Store &store) override;
    Icon *asIcon() override { return this; }

    const char *iconRef() const { return _ref; }
    uint8_t lastAnimFrame() const { return _lastAnimFrame; }
    void syncAnimFrame(uint8_t fi) { _lastAnimFrame = fi; }

  private:
    const char *_ref;
    uint8_t _scaleTenths;
    uint16_t _color;
    bool _hasColor;
    bool _transparent;
    uint8_t _lastAnimFrame = 0xff;
};

}

#endif
