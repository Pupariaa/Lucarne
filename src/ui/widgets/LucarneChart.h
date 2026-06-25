#ifndef LUCARNE_CHART_H
#define LUCARNE_CHART_H

#include "../LucarneWidget.h"

namespace lucarne {

class Chart : public Widget {
  public:
    static const uint8_t MAX_KEYS = 8;

    Chart(int16_t x, int16_t y, int16_t w, int16_t h);

    void setKey(uint8_t index, const char *key);
    void setRange(float minV, float maxV) {
        _min = minV;
        _max = maxV;
    }
    void setColor(uint16_t c) { _color = c; }

    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_keys[MAX_KEYS];
    uint8_t _keyCount;
    float _min;
    float _max;
    uint16_t _color;
};

}

#endif
