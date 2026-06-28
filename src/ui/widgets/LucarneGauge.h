#ifndef LUCARNE_GAUGE_H
#define LUCARNE_GAUGE_H

#include "../LucarneWidget.h"

namespace lucarne {

class Gauge : public Widget {
  public:
    Gauge(int16_t x, int16_t y, int16_t w, int16_t h, const char *label, const char *key,
          float minV, float maxV);

    void setAccent(uint16_t c);
    void clearAccent();
    void setLabelFont(const AAFont *font);
    void setLabelColor(uint16_t color);
    void setLabelTransparent(bool transparent);
    void setLabelSize(uint8_t size);
    void setLabelSpacing(int8_t spacing);
    void setValueFont(const AAFont *font);
    void setValueColor(uint16_t color);
    void setValueTransparent(bool transparent);
    void setValueSize(uint8_t size);
    void setValueSpacing(int8_t spacing);

    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    const char *_label;
    const char *_key;
    float _min;
    float _max;
    uint16_t _accent;
    bool _hasAccent;
    TextStyle _labelStyle;
    TextStyle _valueStyle;
};

}

#endif
