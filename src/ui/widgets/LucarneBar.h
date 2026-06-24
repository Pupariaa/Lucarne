#ifndef LUCARNE_BAR_H
#define LUCARNE_BAR_H

#include "../LucarneWidget.h"

namespace lucarne {

class Bar : public Widget {
  public:
    Bar(int16_t x, int16_t y, int16_t w, int16_t h, const char *key, float min = 0.0f,
        float max = 1.0f);

    void setRange(float min, float max);
    void setColor(uint16_t color);
    void clearColor();
    void setShowValue(bool show) { _showValue = show; }

    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_key;
    float _min;
    float _max;
    uint16_t _color;
    bool _hasColor;
    bool _showValue;
};

}

#endif
