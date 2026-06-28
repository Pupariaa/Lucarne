#ifndef LUCARNE_SLIDER_H
#define LUCARNE_SLIDER_H

#include "../LucarneWidget.h"

namespace lucarne {

class Slider : public Widget {
  public:
    Slider(int16_t x, int16_t y, int16_t w, int16_t h, const char *key, float minV, float maxV);

    void setKey(const char *key) { _key = key; }
    void setRange(float minV, float maxV) {
        _min = minV;
        _max = maxV;
    }
    void setColor(uint16_t c);
    void clearColor();

    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_key;
    float _min;
    float _max;
    uint16_t _color;
    bool _hasColor;
    bool _transparentColor;
};

}

#endif
